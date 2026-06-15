/**
 * buildMessages — assembles the four layers of a state call:
 *   [SYSTEM] PERSONA_BLOCK + STATE_INSTRUCTION (+ OUTPUT_CONTRACT carried separately as jsonSchema)
 *   [USER]   CONTEXT_PAYLOAD: brand_memory projection + state inputs + optional revision block
 */
import type { LlmMessage } from "@/lib/providers/types";
import type { BrandMemory } from "@/lib/brand-memory";
import { PERSONA_BLOCK, REVISION_PREAMBLE } from "./persona";
import { STATE_PROMPTS, type BrandMemoryKey, type ModelClass } from "./states";

export interface BuildMessagesArgs {
  stateNo: number;
  brandMemory?: Partial<BrandMemory>;
  /** Upstream approved outputs this state consumes (e.g. approved hook + script). */
  stateInputs?: Record<string, unknown>;
  /** When revising: the previous output + the user's feedback. */
  revision?: { priorOutput: unknown; feedback: string };
}

export interface BuiltCall {
  system: string;
  messages: LlmMessage[];
  modelClass: ModelClass;
}

export function buildMessages(args: BuildMessagesArgs): BuiltCall {
  const sp = STATE_PROMPTS[args.stateNo];
  if (!sp) throw new Error(`No prompt template for state ${args.stateNo}`);

  const system = `${PERSONA_BLOCK}\n\n--- CURRENT STATE (${args.stateNo}) ---\n${sp.instruction}`;

  const payload: Record<string, unknown> = {
    brand_memory: projectBrandMemory(args.brandMemory, sp.projection),
    state_inputs: args.stateInputs ?? {},
  };

  const userParts: string[] = [JSON.stringify(payload)];
  if (args.revision) {
    userParts.push(
      `\n\n${REVISION_PREAMBLE}\n\nPREVIOUS_OUTPUT:\n<<<JSON\n${JSON.stringify(
        args.revision.priorOutput
      )}\nJSON>>>\n\nUSER_FEEDBACK:\n"${args.revision.feedback}"`
    );
  }

  return {
    system,
    messages: [{ role: "user", content: userParts.join("") }],
    modelClass: sp.modelClass,
  };
}

/** Inject only the relevant brand_memory slices for this state (token-thrift). */
function projectBrandMemory(
  bm: Partial<BrandMemory> | undefined,
  keys: BrandMemoryKey[]
): Partial<BrandMemory> {
  if (!bm || keys.length === 0) return {};
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in bm) out[k] = (bm as Record<string, unknown>)[k];
  }
  return out as Partial<BrandMemory>;
}
