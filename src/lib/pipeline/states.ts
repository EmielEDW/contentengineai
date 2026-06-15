/**
 * The 22-state pipeline definition, in code, mirroring pipeline_state_defs (0002_seed.sql).
 * This is the single source of truth the FSM iterates. AUTO vs GATE, optional,
 * visual-gating and upload flags all live here so the orchestrator and the UI
 * stay in lockstep with the database seed.
 */

export type StateKind = "auto" | "gate";

export interface StateDef {
  no: number;
  slug: string;
  title: string;
  kind: StateKind;
  /** Optional states are only run when listed in videos.enabled_optional_states. */
  optional: boolean;
  /** True ONLY for states that GENERATE scene/video/thumbnail imagery (14,15,18). */
  visual: boolean;
  /** True for states needing a user upload before they can run (12,16). */
  needsUpload: boolean;
}

export const STATES: readonly StateDef[] = [
  { no: 1,  slug: "channel_input",         title: "Channel Input",            kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 2,  slug: "channel_name_gen",      title: "Channel Name Generation",  kind: "gate", optional: false, visual: false, needsUpload: false },
  { no: 3,  slug: "channel_branding",      title: "Channel Branding",         kind: "gate", optional: false, visual: false, needsUpload: false },
  { no: 4,  slug: "transcript_collection", title: "Transcript Collection",    kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 5,  slug: "topic_selection",       title: "Topic Selection",          kind: "gate", optional: false, visual: false, needsUpload: false },
  { no: 6,  slug: "deep_channel_analysis", title: "Deep Channel Analysis",    kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 7,  slug: "style_dna",             title: "Style DNA",                kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 8,  slug: "audience_psychology",   title: "Audience Psychology",      kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 9,  slug: "hook_engineering",      title: "Hook Engineering",         kind: "gate", optional: false, visual: false, needsUpload: false },
  { no: 10, slug: "script_generation",     title: "Script Generation",        kind: "gate", optional: false, visual: false, needsUpload: false },
  { no: 11, slug: "script_quality_audit",  title: "Script Quality Audit",     kind: "gate", optional: false, visual: false, needsUpload: false },
  { no: 12, slug: "visual_input",          title: "Visual Input",             kind: "gate", optional: false, visual: false, needsUpload: true  },
  { no: 13, slug: "visual_style_analysis", title: "Visual Style Analysis",    kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 14, slug: "scene_prompts",         title: "Scene-by-Scene Prompts",   kind: "auto", optional: false, visual: true,  needsUpload: false },
  { no: 15, slug: "motion_prompts",        title: "Video/Motion Prompts",     kind: "gate", optional: true,  visual: true,  needsUpload: false },
  { no: 16, slug: "thumbnail_input",       title: "Thumbnail Input",          kind: "gate", optional: false, visual: false, needsUpload: true  },
  { no: 17, slug: "thumbnail_analysis",    title: "Thumbnail Analysis",       kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 18, slug: "thumbnail_generation",  title: "Thumbnail Generation",     kind: "gate", optional: false, visual: true,  needsUpload: false },
  { no: 19, slug: "seo_metadata",          title: "SEO & Metadata",           kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 20, slug: "ab_variants",           title: "A/B Variants",             kind: "auto", optional: false, visual: false, needsUpload: false },
  { no: 21, slug: "content_calendar",      title: "Content Calendar",         kind: "gate", optional: true,  visual: false, needsUpload: false },
  { no: 22, slug: "export_delivery",       title: "Export & Delivery",        kind: "auto", optional: false, visual: false, needsUpload: false },
] as const;

/** The state whose approval unlocks all visual generation (visual gating). */
export const VISUAL_GATE_STATE = 11;

/** Branding (state 3) is the only image generation allowed before VISUAL_GATE_STATE. */
export const VISUAL_GATING_EXEMPT_STATES = new Set<number>([3]);

export function getState(no: number): StateDef {
  const s = STATES.find((x) => x.no === no);
  if (!s) throw new Error(`Unknown state number: ${no}`);
  return s;
}

export interface AdvanceContext {
  onboardingPath: "new" | "existing";
  enabledOptionalStates: number[];
}

/** Should this state run for this video, given onboarding path + enabled options? */
export function isStateActive(no: number, ctx: AdvanceContext): boolean {
  // EXISTING channels skip naming (2) + branding (3).
  if (ctx.onboardingPath === "existing" && (no === 2 || no === 3)) return false;
  const s = getState(no);
  if (s.optional && !ctx.enabledOptionalStates.includes(no)) return false;
  return true;
}

/** The next active state after `current`, or null if the pipeline is complete. */
export function nextState(current: number, ctx: AdvanceContext): number | null {
  for (let n = current + 1; n <= 22; n++) {
    if (isStateActive(n, ctx)) return n;
  }
  return null;
}

/**
 * Visual gating guard. A generating-visual state (14/15/18) may only run once the
 * script is approved at state 11. Branding (3) is exempt. Returns true if blocked.
 */
export function isBlockedByVisualGate(no: number, scriptApproved: boolean): boolean {
  const s = getState(no);
  if (!s.visual) return false;
  if (VISUAL_GATING_EXEMPT_STATES.has(no)) return false;
  return !scriptApproved;
}
