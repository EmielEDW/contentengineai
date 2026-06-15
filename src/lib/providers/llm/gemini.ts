import type { LlmProvider, ProviderContext, ProviderResult, LlmOutput } from "../types";

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Google Gemini LLM provider. For structured output we set responseMimeType to
 * application/json and embed the JSON Schema in the system instruction, then parse
 * the returned JSON (runState validates it with Zod). This is more robust across
 * our varied schemas than Gemini's stricter responseSchema field.
 */
export class GeminiLlm implements LlmProvider {
  id = "gemini";
  modality = "llm" as const;
  capabilities = { vision: true, maxContextTokens: 1_000_000, json: true };

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
      return { ok: false, error: { code: "no_key", message: "No Gemini API key resolved", retryable: false } };
    }
    const model = req.model ?? DEFAULT_MODEL;
    const system = [
      req.system ?? "",
      req.jsonSchema
        ? `\n\nReturn ONLY a single JSON object that conforms to this JSON Schema. No markdown, no commentary:\n${JSON.stringify(
            req.jsonSchema
          )}`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 8192,
        ...(req.jsonSchema ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.key.secret}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        return {
          ok: false,
          error: { code: `http_${res.status}`, message: await res.text(), retryable: res.status === 429 || res.status >= 500 },
        };
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      let json: unknown;
      if (req.jsonSchema) {
        try {
          json = JSON.parse(stripFences(text));
        } catch {
          return { ok: false, error: { code: "bad_json", message: "Model did not return valid JSON", retryable: true } };
        }
      }
      return {
        ok: true,
        data: {
          text,
          json,
          tokensIn: data.usageMetadata?.promptTokenCount,
          tokensOut: data.usageMetadata?.candidatesTokenCount,
        },
      };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message, retryable: true, raw: e } };
    }
  }
}

function stripFences(t: string): string {
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1]! : t).trim();
}
