/**
 * Structured output schemas, one per state that returns options/structured data.
 * Zod is the single source of truth: used to (a) build the JSON Schema sent to the
 * LLM as the OUTPUT_CONTRACT, (b) validate the model's response, and (c) type the
 * stored asset content. Default z.object() => additionalProperties:false in JSON Schema.
 */
import { z } from "zod";
import {
  PaletteColor,
  BrandMemorySchema,
} from "@/lib/brand-memory";

// ── State 2: Channel Name Generation ─────────────────────────────────────────
export const ChannelNameOptions = z.object({
  options: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(10),
        name: z.string(),
        type: z.enum([
          "descriptive",
          "personal-brand",
          "abstract",
          "niche-keyword",
          "metaphor",
        ]),
        handle: z.string().regex(/^@[A-Za-z0-9_]{3,30}$/),
        rationale: z.string(),
        score: z.number().min(0).max(100),
      })
    )
    .length(10),
});

// ── State 3: Channel Branding (3 logo + 2 banner) ────────────────────────────
const BrandingPrompt = z.object({
  concept_name: z.string(),
  idea: z.string(),
  image_prompt: z.string().min(40),
  hex_palette: z.array(PaletteColor).min(1),
  specs: z.string(),
  why_it_fits: z.string(),
});
export const BrandingPrompts = z.object({
  logos: z.array(BrandingPrompt).length(3),
  banners: z.array(BrandingPrompt).length(2),
});

// ── State 5: Topic Selection ─────────────────────────────────────────────────
export const TopicOptions = z.object({
  options: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(10),
        title: z.string(),
        angle: z.string(),
        one_line_hook: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        estimated_interest: z.string(),
      })
    )
    .length(10),
});

// ── State 6: Deep Channel Analysis (AUTO -> feeds brand_memory) ───────────────
export const ChannelAnalysis = z.object({
  niche: z.string(),
  sub_niche: z.string(),
  positioning: z.string(),
  audience_demo: z.string(),
  content_format: z.string(),
  hook_architecture: z.string(),
  sentence_mix: z.object({ short: z.number(), medium: z.number(), long: z.number() }),
  retention_techniques: z.array(z.string()),
  wps: z.number().positive(),
  avg_length_words: z.number().int().positive(),
  signature_phrases: z.array(z.string()),
  cta_style: z.string(),
});

// ── State 7: Style DNA (AUTO -> brand_memory.style_dna) ───────────────────────
export const StyleDnaOutput = BrandMemorySchema.shape.style_dna;

// ── State 8: Audience Psychology (AUTO -> brand_memory.audience) ──────────────
export const AudiencePsychologyOutput = BrandMemorySchema.shape.audience;

// ── State 9: Hook Engineering ────────────────────────────────────────────────
export const HookOptions = z.object({
  options: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(5),
        archetype: z.enum([
          "curiosity-gap",
          "bold-claim",
          "story-open",
          "question",
          "pattern-interrupt",
        ]),
        text: z.string(),
        word_count: z.number().int().min(1),
        estimated_duration_sec: z.number().min(0),
        why_it_works: z.string(),
      })
    )
    .length(5),
});

// ── State 10: Script Generation ──────────────────────────────────────────────
export const ScriptOutput = z.object({
  title_working: z.string(),
  target_word_count: z.number().int().min(1),
  actual_word_count: z.number().int().min(1),
  wps: z.number().min(0),
  estimated_duration_sec: z.number().min(0),
  beats: z
    .array(
      z.object({
        beat_id: z.string().regex(/^B[0-9]{3}$/),
        section: z.enum(["hook", "intro", "body", "transition", "cta", "outro"]),
        text: z.string(),
        word_count: z.number().int().min(1),
      })
    )
    .min(1),
});

// ── State 11: Script Quality Audit ───────────────────────────────────────────
export const ScriptAudit = z.object({
  criteria: z
    .array(
      z.object({
        name: z.enum([
          "hook_strength",
          "style_match",
          "retention_pacing",
          "clarity",
          "originality",
          "emotional_resonance",
          "structure",
          "cta_effectiveness",
          "factual_consistency",
          "length_adherence",
        ]),
        score: z.number().int().min(1).max(10),
        comment: z.string(),
      })
    )
    .length(10),
  overall_score: z.number().min(1).max(10),
  pass: z.boolean(),
  revision_notes: z.string(),
  /** Factual claims (numbers/names/dates) for the human to verify before publish. */
  claims_to_verify: z.array(z.string()).default([]),
});

// ── State 13: Visual Style Analysis (AUTO -> brand_memory.visual_style) ───────
export const VisualStyleOutput = BrandMemorySchema.shape.visual_style;

// ── State 14: Scene-by-Scene Prompts ─────────────────────────────────────────
export const ScenePrompts = z.object({
  scenes: z
    .array(
      z.object({
        beat_id: z.string().regex(/^B[0-9]{3}$/),
        scene_index: z.number().int().min(1),
        image_prompt: z.string().min(40),
        duration_sec: z.number().min(3).max(6),
        is_fill_beat: z.boolean(),
        negative_prompt: z.string(),
      })
    )
    .min(1),
});

// ── State 15: Video/Motion Prompts ───────────────────────────────────────────
export const MotionPrompts = z.object({
  motion: z
    .array(
      z.object({
        beat_id: z.string().regex(/^B[0-9]{3}$/),
        motion_type: z.string(),
        direction: z.string(),
        speed: z.enum(["slow", "medium", "fast"]),
        transition: z.string(),
        duration_sec: z.number().min(0),
      })
    )
    .min(1),
});

// ── State 17: Thumbnail Analysis (AUTO -> brand_memory.thumbnail_system) ──────
export const ThumbnailAnalysisOutput = BrandMemorySchema.shape.thumbnail_system;

// ── State 18: Thumbnail Generation ───────────────────────────────────────────
export const ThumbnailConcepts = z.object({
  concepts: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(5),
        text: z.string().max(40),
        emotion: z.string(),
        contrast: z.string(),
        full_prompt: z.string().min(40),
        ctr_reasoning: z.string(),
      })
    )
    .length(5),
});

// ── State 19: SEO & Metadata ─────────────────────────────────────────────────
export const SeoMetadata = z.object({
  titles: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(5),
        text: z.string().max(100),
        char_count: z.number().int().min(1).max(100),
      })
    )
    .length(5),
  description: z.string().max(5000),
  timestamps: z.array(
    z.object({
      time: z.string().regex(/^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$/),
      label: z.string(),
    })
  ),
  tags: z.array(z.string()).length(30),
  pinned_comments: z.array(z.string()).length(3),
  recommended_upload_time: z.string(),
  category: z.string(),
});

// ── State 20: A/B Variants ───────────────────────────────────────────────────
const AbVariant = z.object({
  dimension: z.enum(["hook", "title", "thumbnail"]),
  variable_tested: z.string(),
  hypothesis: z.string(),
  value: z.string(),
});
export const AbVariants = z.object({
  hooks: z.array(AbVariant).length(3),
  titles: z.array(AbVariant).length(3),
  thumbnails: z.array(AbVariant).length(2),
});

// ── State 21: Content Calendar ───────────────────────────────────────────────
export const ContentCalendar = z.object({
  items: z
    .array(
      z.object({
        day: z.number().int().min(1).max(30),
        title: z.string(),
        angle: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        upload_time: z.string(),
        pillar: z.string(),
      })
    )
    .length(30),
});

export type ScriptOutputT = z.infer<typeof ScriptOutput>;
export type ScriptAuditT = z.infer<typeof ScriptAudit>;
export type ScenePromptsT = z.infer<typeof ScenePrompts>;
export type HookOptionsT = z.infer<typeof HookOptions>;
