/**
 * BrandMemory — the per-channel "brand memory" object.
 *
 * Derived ONCE at onboarding (states 4,6,7,8,13,17 each fill a slice) and then
 * read-mostly: a per-state projection is injected into every LLM call. Stored as
 * JSONB in channels.brand_memory. The `schema_version` envelope allows safe
 * evolution. Zod is the single source of truth for the shape.
 */
import { z } from "zod";

export const PaletteColor = z.object({
  name: z.string().optional(),
  hex: z.string().regex(/^#?[0-9A-Fa-f]{6}$/, "hex color"),
});

export const BrandMemorySchema = z.object({
  schema_version: z.literal(1),

  /** Per-channel default provider selection (keys live on the org, see api_keys). */
  providers: z
    .object({
      llm: z.string().optional(),
      image: z.string().optional(),
      voice: z.string().optional(),
      video: z.string().optional(),
    })
    .partial()
    .optional(),

  channel: z.object({
    name: z.string(),
    handle: z.string(),
    reference_channel: z.string(),
    niche: z.string(),
    positioning: z.string(),
    category: z.string(),
    logo: z.object({ media_file_id: z.string(), prompt: z.string() }).optional(),
  }),

  style_dna: z.object({
    wps: z.number().positive(),
    target_length_words: z.number().int().positive(),
    sentence_mix: z.object({
      short: z.number(),
      medium: z.number(),
      long: z.number(),
    }),
    flow: z.string(),
    tone_ratio: z.record(z.string(), z.number()),
    signature_transition: z.array(z.string()),
    trigger_vocab: z.array(z.string()),
    opening: z.string(),
    closing: z.string(),
    signature_phrases: z.array(z.string()),
    analogy_style: z.string(),
    cta: z.string(),
  }),

  audience: z.object({
    demo: z.string(),
    knowledge: z.string(),
    needs: z.array(z.string()),
    pain_points: z.array(z.string()),
    identity_promise: z.string(),
    enemy: z.string(),
  }),

  visual_style: z.object({
    art: z.string(),
    lighting: z.string(),
    camera: z.string(),
    composition: z.string(),
    background: z.string(),
    mood: z.string(),
    overlays: z.string().optional(),
    palette: z.array(PaletteColor),
  }),

  narrator_character: z.object({
    name: z.string(),
    anchor_description: z.string(),
    mouths: z.string().optional(),
    usage: z.string(),
  }),

  voice_design_elevenlabs: z.object({
    primary_prompt: z.string(),
    guidance_scale: z.number(),
    loudness: z.number(),
    preview_text: z.string(),
    voice_id: z.string().optional(),
  }),

  thumbnail_system: z.object({
    text_style: z.string(),
    composition: z.string(),
    contrast: z.string(),
    emotion: z.string(),
    branding: z.string(),
  }),

  music: z
    .object({ style: z.string(), references: z.array(z.string()).optional() })
    .optional(),
});

export type BrandMemory = z.infer<typeof BrandMemorySchema>;

/** A partial brand memory while onboarding is still in progress. */
export const PartialBrandMemorySchema = BrandMemorySchema.deepPartial().extend({
  schema_version: z.literal(1),
});
export type PartialBrandMemory = z.infer<typeof PartialBrandMemorySchema>;

/** The top-level slices each onboarding AUTO state writes. */
export const BRAND_MEMORY_SLICE_BY_STATE: Record<number, keyof BrandMemory> = {
  6: "audience", // deep analysis seeds audience/channel facts; refined by 8
  7: "style_dna",
  8: "audience",
  13: "visual_style",
  17: "thumbnail_system",
};

/** brand_memory is "ready" once all required slices exist. */
export function isBrandMemoryReady(bm: unknown): boolean {
  const parsed = BrandMemorySchema.safeParse(bm);
  return parsed.success;
}
