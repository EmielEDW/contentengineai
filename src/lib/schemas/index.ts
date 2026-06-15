/**
 * Registry mapping each structured state to its Zod schema + the asset_type it
 * produces, plus a helper to turn a Zod schema into a JSON Schema for the
 * OUTPUT_CONTRACT block of an LLM call.
 */
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as S from "./states";

export type AssetType =
  | "channel_name"
  | "branding_prompt"
  | "topic_idea"
  | "channel_analysis"
  | "style_dna"
  | "audience_psychology"
  | "hook"
  | "script"
  | "script_audit"
  | "visual_style"
  | "scene_prompt"
  | "motion_prompt"
  | "thumbnail_analysis"
  | "thumbnail_concept"
  | "seo"
  | "ab_variant"
  | "calendar"
  | "export_bundle";

export interface StateSchemaEntry {
  schema: z.ZodTypeAny;
  assetType: AssetType;
  /** If set, the AUTO state merges its output into this brand_memory top-level key. */
  brandMemoryKey?:
    | "style_dna"
    | "audience"
    | "visual_style"
    | "thumbnail_system";
}

export const STATE_SCHEMAS: Record<number, StateSchemaEntry> = {
  2: { schema: S.ChannelNameOptions, assetType: "channel_name" },
  3: { schema: S.BrandingPrompts, assetType: "branding_prompt" },
  5: { schema: S.TopicOptions, assetType: "topic_idea" },
  6: { schema: S.ChannelAnalysis, assetType: "channel_analysis" },
  7: { schema: S.StyleDnaOutput, assetType: "style_dna", brandMemoryKey: "style_dna" },
  8: { schema: S.AudiencePsychologyOutput, assetType: "audience_psychology", brandMemoryKey: "audience" },
  9: { schema: S.HookOptions, assetType: "hook" },
  10: { schema: S.ScriptOutput, assetType: "script" },
  11: { schema: S.ScriptAudit, assetType: "script_audit" },
  13: { schema: S.VisualStyleOutput, assetType: "visual_style", brandMemoryKey: "visual_style" },
  14: { schema: S.ScenePrompts, assetType: "scene_prompt" },
  15: { schema: S.MotionPrompts, assetType: "motion_prompt" },
  17: { schema: S.ThumbnailAnalysisOutput, assetType: "thumbnail_analysis", brandMemoryKey: "thumbnail_system" },
  18: { schema: S.ThumbnailConcepts, assetType: "thumbnail_concept" },
  19: { schema: S.SeoMetadata, assetType: "seo" },
  20: { schema: S.AbVariants, assetType: "ab_variant" },
  21: { schema: S.ContentCalendar, assetType: "calendar" },
};

export function getStateSchema(stateNo: number): StateSchemaEntry | undefined {
  return STATE_SCHEMAS[stateNo];
}

/** JSON Schema for the OUTPUT_CONTRACT (additionalProperties:false from default Zod objects). */
export function jsonSchemaFor(stateNo: number, name = `state_${stateNo}`) {
  const entry = STATE_SCHEMAS[stateNo];
  if (!entry) throw new Error(`State ${stateNo} has no structured schema`);
  return zodToJsonSchema(entry.schema, { name, target: "jsonSchema7" });
}
