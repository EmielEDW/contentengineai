import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, ProviderContext, ProviderResult, LlmOutput } from "../types";

const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Anthropic Claude LLM provider. When a jsonSchema is supplied we force a single
 * tool call whose input_schema IS the contract, then return the validated input
 * as the JSON output — the most reliable structured-output path for Claude.
 */
export class AnthropicLlm implements LlmProvider {
  id = "anthropic";
  modality = "llm" as const;
  capabilities = { vision: true, maxContextTokens: 200_000, json: true };

  async complete(
    req: {
      system?: string;
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      jsonSchema?: object;
      jsonSchemaName?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    ctx: ProviderContext
  ): Promise<ProviderResult<LlmOutput>> {
    if (!ctx.key.secret) {
      return { ok: false, error: { code: "no_key", message: "No Anthropic API key resolved", retryable: false } };
    }
    const client = new Anthropic({ apiKey: ctx.key.secret });
    const model = req.model ?? DEFAULT_MODEL;
    const messages = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    try {
      if (req.jsonSchema) {
        const toolName = req.jsonSchemaName ?? "respond";
        const res = await client.messages.create({
          model,
          max_tokens: req.maxTokens ?? 8192,
          temperature: req.temperature ?? 0.7,
          system: req.system,
          tools: [
            {
              name: toolName,
              description: "Return the response strictly matching this schema.",
              input_schema: req.jsonSchema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: toolName },
          messages,
        });
        const toolUse = res.content.find((c) => c.type === "tool_use");
        const json = toolUse && "input" in toolUse ? toolUse.input : undefined;
        return {
          ok: true,
          data: { text: JSON.stringify(json), json, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens },
          costCents: estimateCostCents(model, res.usage.input_tokens, res.usage.output_tokens),
        };
      }

      const res = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? 8192,
        temperature: req.temperature ?? 0.7,
        system: req.system,
        messages,
      });
      const text = res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n");
      return {
        ok: true,
        data: { text, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens },
        costCents: estimateCostCents(model, res.usage.input_tokens, res.usage.output_tokens),
      };
    } catch (e) {
      const status = (e as { status?: number }).status;
      return {
        ok: false,
        error: {
          code: status ? `http_${status}` : "error",
          message: (e as Error).message,
          retryable: status === 429 || (status !== undefined && status >= 500),
          raw: e,
        },
      };
    }
  }
}

// Rough cost; validate against live pricing. Opus ~ $15/Mtok in, $75/Mtok out (placeholder).
function estimateCostCents(_model: string, tin: number, tout: number): number {
  return Math.round(((tin / 1_000_000) * 1500 + (tout / 1_000_000) * 7500));
}
