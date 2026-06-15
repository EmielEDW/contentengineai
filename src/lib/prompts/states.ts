/**
 * Per-state instruction templates (the STATE_INSTRUCTION layer). One entry per
 * state that issues an LLM call. Kept terse; the OUTPUT_CONTRACT (JSON schema)
 * carries the exact shape, and brand_memory carries the channel context.
 *
 * `projection` lists which brand_memory top-level keys to inject for that state
 * (token-thrift). `model` lets the registry route cheap vs strong models.
 */

export type BrandMemoryKey =
  | "channel"
  | "style_dna"
  | "audience"
  | "visual_style"
  | "narrator_character"
  | "voice_design_elevenlabs"
  | "thumbnail_system"
  | "music";

export type ModelClass = "cheap" | "mid" | "strong";

export interface StatePrompt {
  instruction: string;
  projection: BrandMemoryKey[];
  modelClass: ModelClass;
}

export const STATE_PROMPTS: Record<number, StatePrompt> = {
  1: {
    instruction:
      "Parse the reference channel metadata into niche, sub-niche and tone. Be specific and evidence-based.",
    projection: [],
    modelClass: "cheap",
  },
  2: {
    instruction:
      "Generate 10 original channel name ideas for the user's OWN channel in this niche. Rank by memorability + brandability. Remind that @handle availability must be verified on YouTube.",
    projection: ["channel"],
    modelClass: "mid",
  },
  3: {
    instruction:
      "Produce 3 logo concepts and 2 banner concepts as standalone text-to-image prompts with hex palettes and platform specs. Each prompt must fully describe the image independently.",
    projection: ["channel", "visual_style"],
    modelClass: "mid",
  },
  5: {
    instruction:
      "Generate 10 ranked video ideas for this niche/audience. Each: curiosity-gap title, one-line hook, angle, difficulty, estimated interest.",
    projection: ["channel", "audience"],
    modelClass: "mid",
  },
  6: {
    instruction:
      "Analyse the transcripts and extract a deep channel analysis (niche, positioning, audience, format, hook architecture, sentence mix, retention techniques, WPS, average length, signature phrases, CTA). Use real examples; do not summarise.",
    projection: [],
    modelClass: "cheap",
  },
  7: {
    instruction:
      "Extract the Style DNA (rhythm, flow, repetition, tone ratio, transitions, curiosity gaps, trigger vocab, openings/closings, analogy style, CTA). Extract HOW it works; this fills brand_memory.style_dna.",
    projection: [],
    modelClass: "cheap",
  },
  8: {
    instruction:
      "Build the audience psychology profile (demo, knowledge, needs, pain points, identity promise, enemy). This fills brand_memory.audience.",
    projection: [],
    modelClass: "cheap",
  },
  9: {
    instruction:
      "Generate 5 hooks, one per archetype (curiosity-gap, bold-claim, story-open, question, pattern-interrupt). Use the channel's WPS for duration. Rank by predicted retention.",
    projection: ["style_dna", "audience"],
    modelClass: "mid",
  },
  10: {
    instruction:
      "Write the full style-locked script from the approved hook to the outro. Match Style DNA, pacing, retention techniques and audience psychology. Hit the target word count within ±5%. Split into beats (3-6s of narration each) with beat_id, section and word_count. 100% original.",
    projection: ["style_dna", "audience", "channel"],
    modelClass: "strong",
  },
  11: {
    instruction:
      "Run the 10-point quality audit (each criterion 1-10). Also extract a list of factual claims (numbers/names/dates) the human should verify before publishing. Be a strict critic.",
    projection: ["style_dna", "audience"],
    modelClass: "strong",
  },
  13: {
    instruction:
      "Analyse the uploaded sample frames into a visual style profile (art, palette with hex, lighting, camera, composition, background, mood, overlays). Analysis only; fills brand_memory.visual_style.",
    projection: [],
    modelClass: "cheap",
  },
  14: {
    instruction:
      "For the given script beats, produce one standalone image prompt per beat (3-6s). Each prompt must fully describe the scene (subject, environment, lighting, mood, camera, style) and stay on-palette. Never reference other prompts. Include a negative_prompt and mark fill-beats.",
    projection: ["visual_style", "narrator_character"],
    modelClass: "mid",
  },
  15: {
    instruction:
      "For the given beats, produce per-beat motion specs (motion type, direction, speed, transition, duration).",
    projection: ["visual_style"],
    modelClass: "mid",
  },
  17: {
    instruction:
      "Analyse the uploaded thumbnails into a thumbnail style profile (text style, composition, contrast, emotion, branding). Fills brand_memory.thumbnail_system.",
    projection: [],
    modelClass: "cheap",
  },
  18: {
    instruction:
      "Generate 5 thumbnail concepts (text ≤6 words, emotion trigger, contrast strategy, full standalone style-matched prompt, CTR reasoning). Rank by predicted CTR.",
    projection: ["thumbnail_system", "visual_style", "channel"],
    modelClass: "mid",
  },
  19: {
    instruction:
      "Produce the SEO package: 5 ranked titles (≤100 chars), full description with timestamps, 30 tags, 3 pinned comments, recommended upload time, category.",
    projection: ["channel", "audience"],
    modelClass: "mid",
  },
  20: {
    instruction:
      "Produce A/B variants: 3 hooks + 3 titles + 2 thumbnails, each testing ONE variable with a clear hypothesis.",
    projection: ["channel", "audience"],
    modelClass: "mid",
  },
  21: {
    instruction:
      "Produce a 30-day content calendar (title, angle, difficulty, upload time, content pillar per day).",
    projection: ["channel", "audience"],
    modelClass: "mid",
  },
};
