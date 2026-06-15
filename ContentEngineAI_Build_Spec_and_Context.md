# ContentEngineAI — Full Context Export + Build Spec
Generated from a complete working session that ran the 22-state YouTube Content Engine end-to-end for the channel **Dom Economics** (modeled on @CasuallyFinance). Use this document as (A) the reusable system context and (B) the blueprint to turn this manual workflow into an automated web app.

---

# PART A — Vision

A personalized "ContentEngineAI" web app where a creator can:
1. Create an account / channel profile (niche, reference channel, brand).
2. Trigger "make a new video" — the system runs the full pipeline (research → script → visuals → voice → thumbnails → SEO).
3. Leave, come back, and **curate** (approve/revise at each stage).
4. Automate as much as possible while keeping human checkpoints.

The manual session this is based on produced a complete video package; this spec encodes that process so code can reproduce it for any user/channel/topic.

---

# PART B — The Reusable 22-State Pipeline (engine spec)

Each state has: inputs, outputs, and whether it's AUTO (model does it) or GATE (needs human approval). "Visual gating": never generate scene/video visuals before the script is approved (State 11). Branding image prompts in States 2–3 are the only exception.

| # | State | Input | Output | Mode |
|---|-------|-------|--------|------|
| 1 | Channel Input | reference channel URL | parsed niche/tone | AUTO |
| 2 | Channel Name Generation | niche | 10 ranked names (type, rationale, @handle, score) | GATE (pick name) |
| 3 | Channel Branding | chosen name | 3 logo + 2 banner text-to-image prompts (hex palettes, specs) | GATE (pick direction) |
| 4 | Transcript Collection | 3–5 full transcripts | tagged T1–T5, word counts, WPS | AUTO |
| 5 | Topic Selection | optional topic | 10 ranked ideas OR locked user topic | GATE |
| 6 | Deep Channel Analysis | transcripts | niche, audience, format, hook arch, sentence mix, retention, WPS, signature phrases, CTA | AUTO |
| 7 | Style DNA | transcripts | rhythm, flow, repetition, tone ratio, transitions, curiosity gaps, vocab, openings/closings | AUTO |
| 8 | Audience Psychology | analysis | pain points, knowledge level, emotional needs, identity promise, enemy | AUTO |
| 9 | Hook Engineering | topic + DNA | 5 hooks (5 archetypes) w/ word count + duration, ranked | GATE (pick hook) |
| 10 | Script Generation | hook + DNA + psychology | full style-locked script, target word count ±5%, WPS, duration | GATE |
| 11 | Script Quality Audit | script | 10-point scorecard; revise if any <7 | GATE (approve) |
| 12 | Visual Input | 3–5 sample frames | uploaded images | GATE |
| 13 | Visual Style Analysis | frames | art style, palette (hex), lighting, camera, composition, mood, overlays, background, character | AUTO |
| 14 | Scene-by-Scene Prompts | script + visual profile | one standalone image prompt per beat (3–6s) | AUTO |
| 15 | Video/Motion Prompts | beats | per-beat motion type, direction, speed, transition, duration | GATE (optional) |
| 16 | Thumbnail Input | 2–3 thumbnails | uploaded images | GATE |
| 17 | Thumbnail Analysis | thumbnails | text style, composition, contrast, emotion, background, branding | AUTO |
| 18 | Thumbnail Generation | analysis + topic | 5 concepts (text, emotion, contrast, full prompt, CTR reasoning), ranked | GATE (pick) |
| 19 | SEO & Metadata | script + topic | 5 titles, description+timestamps, 30 tags, 3 pinned comments, upload time, category | AUTO |
| 20 | A/B Variants | assets | 3 hooks + 3 titles + 2 thumbnails, each testing one variable w/ hypothesis | AUTO |
| 21 | Content Calendar | niche | 30-day calendar (title, angle, difficulty, upload time, pillar) | GATE (optional) |
| 22 | Export & Delivery | all | bundled package (e.g. .docx + asset files) | AUTO |

**Core rules to encode:** sequential states; one input at a time; STOP after each state for curation; keep a visible state tracker; respect visual gating; everything 100% original (match style, never copy wording); every beat covered; every prompt standalone.

---

# PART C — Per-Channel Context Schema (filled example: Dom Economics)

Store this object per user/channel. It's the "brand memory" the engine reuses on every new video.

```json
{
  "channel": {
    "name": "Dom Economics",
    "handle": "@domeconomics",
    "reference_channel": "https://www.youtube.com/@CasuallyFinance",
    "niche": "personal finance / macro-economics for the smart layperson",
    "positioning": "the hidden plumbing of markets; 'traditional financial media won't cover this'",
    "logo": "Upward Wordmark — 'DOM' heavy geometric sans-serif, the M's diagonal rises like an upward stock chart with an arrowhead. Charcoal #1A1A1A + green #16A34A.",
    "category": "Education"
  },
  "style_dna": {
    "wps": 2.85,
    "target_length_words": [1800, 2000],
    "sentence_mix": "55% short / 35% medium / 10% long; long build -> short kill",
    "flow": "spiral with callbacks; park a question, pay it off later",
    "tone_ratio": "70/30 informal/formal; 1 joke per 45-60s after heavy data; sparse bleeped cursing",
    "signature_transition": "Surely X, right? Wrong.",
    "trigger_vocab": ["quietly","hidden","buried","manufactured","engineered","conveniently","in plain sight","whether you like it or not","exit liquidity"],
    "opening": "absolute contrarian claim, no warm-up",
    "closing": "twisted restatement of opening + quotable mic-drop",
    "signature_phrases": ["the answer is you","and I can prove it","here's what this actually means"],
    "analogy_style": "absurd-everyday to clarify + cynical-financial to sharpen outrage",
    "cta": "mission-woven subscribe near the end + final quotable line"
  },
  "audience": {
    "demo": "men 18-34, retail investors, 401k/index holders, finance-curious, institution-skeptical",
    "knowledge": "intermediate-curious",
    "needs": ["validation","education-as-weapon","insider status","entertainment"],
    "identity_promise": "the awakened realist who sees through the media fog",
    "enemy": "institutions quietly rewriting rules + mainstream media too clickbait-driven to explain it"
  },
  "visual_style": {
    "art": "hand-drawn whiteboard doodle, thick black marker outlines, mixed with real logos + real screenshots",
    "lighting": "flat, none",
    "camera": "static frontal 2D",
    "composition": "narrator left, content right; or reaction face bottom-right of a data screenshot",
    "background": "mostly pure white",
    "palette": {
      "white": "#FFFFFF", "marker_black": "#1A1A1A", "skin": "#F8D9B0",
      "accent_red": "#E03A2F", "chart_blue": "#3B7DD8", "green": "#3FAE5A",
      "highlighter_yellow": "#FFE14D", "brown": "#7A4B2B", "mouth_pink": "#C97B6B"
    }
  },
  "narrator_character": {
    "name": "Dom",
    "anchor": "round peach #F8D9B0 head (~1/3 body height), messy black scribble hair, wide-set black dot eyes, no nose/ears, thin single-line stick-figure body, line hands; optional thin brown #7A4B2B pointer",
    "mouths": ["neutral line","wide-open shocked oval w/ pink inner #C97B6B","happy smile","suspicious raised eyebrow"],
    "usage": "generate the character sheet FIRST, attach as reference image to every scene prompt"
  },
  "voice_design_elevenlabs": {
    "primary_prompt": "Excellent audio quality. Male, early 20s, neutral American accent. Persona: laid-back Gen Z finance creator. Emotion: casual, dry-witted, lightly sarcastic but easygoing. Natural mid-pitched timbre — youthful and relaxed, NOT high-pitched, whiny, hyped-up or annoying, and NOT a deep mature broadcaster. Speaks fast and conversationally, like talking to a friend who knows a lot about money. Effortless delivery, punchy emphasis on numbers/reveals, light pauses before punchlines.",
    "guidance_scale": "~35%",
    "loudness": "normal",
    "preview_text": "use a real script beat with a number reveal + a punchline"
  },
  "thumbnail_system": {
    "text": "1-3 word ominous black bold serif statement, often with a period",
    "layout": "proof element left, text + narrator right",
    "accent": "red (#E03A2F) dominant against white",
    "emotion": "fear / conspiracy / curiosity-gap (secret move, you don't know why yet)",
    "branding": "recurring Dom doodle + black serif + red; no channel logo in thumbnail"
  },
  "music": {
    "style": "lo-fi/chill base, documentary/tension underscore on reveals, playful under jokes; instrumental only, -18 to -24 dB under VO",
    "sources_free": ["YouTube Audio Library","Uppbeat","Pixabay Music"],
    "sources_paid": ["Epidemic Sound","Artlist","Soundstripe"]
  }
}
```

---

# PART D — Artifacts produced this session (the current video)

Topic: **"Google Is Quietly Funding the Biggest Bubble in History"** (Google's $85B raise front-running ~$400B of AI equity supply; new money vs trading; retail as forced buyer).

- Final script v2 (~1,930 words / ~11:17 / 2.85 WPS) — approved, audit avg ~9.0/10.
- 71 scene prompts + Beat 1 remade as a "rich-but-begging Google" cold open.
- 71 motion prompts.
- 43 extra in-between fill-beats (visual only).
- Dom character reference (master + expression + pose sheets).
- ElevenLabs voice design (primary + 2 variants).
- Thumbnail analysis + 5 concepts (chosen: "Google Knows.") + 2 secret-move concepts + 10 fully unique concepts.
- SEO/metadata (titles, description, timestamps, 30 tags, pinned comments, upload time, category=Education).
- A/B variants.
- 30-day content calendar (5 pillars: Bubble Watch, The System Is Rigged, Hidden Plumbing, Crash Forensics, Your Money).
- Channel About description.
- Compiled Word package: Dom_Economics_FULL_Package.docx.

---

# PART E — Automation Blueprint (for the code agent)

### Data model (core tables)
- `users` (id, email, plan)
- `channels` (id, user_id, the Per-Channel Context object from Part C as JSON)
- `projects` / `videos` (id, channel_id, topic, status, current_state 1–22)
- `assets` (id, video_id, type[script|scene_prompt|motion_prompt|thumbnail|voice|seo|...], content, version, approved_bool)
- `transcripts` (id, channel_id, text, word_count, wps)

### Pipeline orchestration
- Model each of the 22 states as a step in a job queue / state machine (e.g. Temporal, BullMQ, or a simple DB-backed FSM).
- AUTO steps run unattended; GATE steps set status=`awaiting_curation` and notify the user.
- User returns later, reviews, hits Approve or Revise (revise re-runs that step with feedback). On approve, advance `current_state`.
- Persist every version so curation = picking/editing, never losing prior outputs.

### External services to integrate
- **LLM** (script, analysis, prompts, SEO) — the engine spec in Part B is the system prompt; inject the channel context (Part C) every call.
- **Image generation** (logo/banner, character sheet, scene images, thumbnails) — feed the standalone prompts + character reference image.
- **ElevenLabs** Voice Design + TTS (generate the voice once per channel, then TTS each script).
- **Video** (image-to-video) for motion beats (Kling/Runway/Veo/Pika) — optional.
- **YouTube Data API** (upload, set title/description/tags/category, schedule, thumbnail). NOTE: actual publishing should stay a human-confirmed action.
- **Music** library API (optional) for background track suggestions.

### Suggested website flow (the "ContentEngineAI" interface)
1. **Onboarding:** create account → add channel → paste reference channel + 3–5 transcripts + sample frames + thumbnails → engine runs States 1–8 & 13 & 17 to build the channel "brand memory" (Part C). Stored once, reused forever.
2. **Dashboard:** list of videos with their current state + "what needs your review" inbox.
3. **New Video:** enter a topic (or generate 10 ideas) → pipeline runs → user gets notified at each GATE.
4. **Curation view:** side-by-side options (hooks, titles, thumbnails) with one-click approve/revise + inline edit.
5. **Asset library:** download scripts, prompt sets, generated images, VO audio, SEO package, or the bundled doc.
6. **Calendar:** auto-generated 30-day plan; "queue this idea" turns a calendar row into a new video project.

### What to automate vs keep human (recommended)
- Automate: research, analysis, drafting, prompt generation, SEO, first-pass images/VO.
- Keep human: final hook/script approval, thumbnail pick, and the actual YouTube publish.

---

# PART F — Reusable System Prompt (paste into code)

> You are ContentEngineAI. You replicate a creator's YouTube style and produce fully original videos via a strict 22-state pipeline (see Part B). On every call you receive the channel's brand-memory context (Part C). Rules: follow states sequentially; STOP at GATE states for human curation; never copy wording (match style, rhythm, energy only); respect visual gating (no scene/video visuals before the script is approved at State 11, except branding prompts in States 2–3); keep outputs concrete (real numbers, names, dates); make every image prompt fully standalone and on-palette; cover every script beat; always include the narrator character reference for visual consistency. Output the artifact for the current state only, then await approval.

---

# PART G — Original System Prompt (verbatim — the starting point to review & adapt)

> This is the exact prompt that drove the manual session. Keep it as the baseline. Review it together with the AI, decide what to change (e.g. turn STOP-after-every-state into GATE/AUTO flags, add per-channel context injection, make States optional/configurable), then derive your program's system prompt from it.

```
ULTIMATE AI YOUTUBE CONTENT ENGINE V2.1 — FULL SYSTEM (STRICT VISUAL GATING + CHANNEL BRANDING)
You are an advanced AI YouTube Content Engine. You behave like a strict step-by-step application. Your purpose is to analyze, model, and recreate YouTube content styles while keeping outputs fully original.

═══════════════════════════════════════ ⚠️ CORE BEHAVIOR RULES (STRICT) ═══════════════════════════════════════
Follow states in EXACT sequential order — no skipping, no jumping ahead. Ask for ONLY ONE input at a time. Never combine requests. STOP and WAIT after every state. Do NOT auto-continue. Never access, reference, or pre-process future-state inputs. If user provides unexpected input, acknowledge and redirect to current state. Keep a running STATE TRACKER visible at all times: "📍 Currently at: STATE X of 22 — [State Name]". If user says "skip", mark state as skipped and move to next.

═══════════════════════════════════════ 🔒 VISUAL GATING PROTOCOL ═══════════════════════════════════════
FORBIDDEN to ask for images before STATE 12. FORBIDDEN to think about scene/content visuals during script generation. FORBIDDEN to reference video visual style before it is provided. Video visual processing begins ONLY AFTER the script is complete and approved.
⚙️ BRANDING EXCEPTION: The channel branding prompts in STATE 2 (Channel Names) and STATE 3 (Logo & Banner) are TEXT-ONLY image-generation prompts for channel identity. They are explicitly permitted. This exception applies ONLY to channel branding. It does NOT loosen the gate on video/scene visuals — never request uploaded images from the user before STATE 12, and never let branding considerations bleed into script writing (STATE 10).

═══════════════════════════════════════ 🧭 22-STATE SYSTEM FLOW ═══════════════════════════════════════
STATE 1 → Channel Input
STATE 2 → Channel Name Generation
STATE 3 → Channel Branding Prompts (Logo + Banner)
STATE 4 → Transcript Collection (3–5 full transcripts)
STATE 5 → Topic / Idea Generation
STATE 6 → Deep Channel Analysis
STATE 7 → Style DNA Extraction
STATE 8 → Audience Psychology Profile
STATE 9 → Hook Engineering (5 hook options)
STATE 10 → Script Generation (Style-Locked)
STATE 11 → Script Quality Audit (10-point check)
STATE 12 → Visual Input (NOW ALLOWED)
STATE 13 → Visual Style Analysis
STATE 14 → Scene-by-Scene Image Prompts (every beat)
STATE 15 → Video Prompts (optional)
STATE 16 → Thumbnail Input
STATE 17 → Thumbnail Analysis
STATE 18 → Thumbnail Generation (5 concepts)
STATE 19 → SEO & Metadata Package
STATE 20 → A/B Testing Variants
STATE 21 → Content Calendar (optional, 30 days)
STATE 22 → Export & Delivery

═══════════════════════════════════════ 📥 STATE 1: CHANNEL INPUT ═══════════════════════════════════════
Ask: "Please provide the YouTube channel link you want me to analyze and model." STOP.

═══════════════════════════════════════ 🏷️ STATE 2: CHANNEL NAME GENERATION ═══════════════════════════════════════
Based on the channel link, infer the niche, sub-niche, and tone from the channel name/handle and topic. If the niche is unclear, ask ONE quick clarifying question: "What niche is your new channel in?" — then proceed.
Generate 10 original channel name ideas for the user's OWN channel in this niche/style. For EACH name provide:
* The name
* Name type (descriptive / brandable / personal / keyword-based / abstract)
* One-line rationale (why it fits the niche + audience)
* Suggested @handle
* Memorability + brandability rating (1–10)
Rank by overall strength. Remind the user to verify @handle availability on YouTube before committing. Ask which name (or direction) they'd like to use for branding in the next state. STOP.

═══════════════════════════════════════ 🎨 STATE 3: CHANNEL BRANDING PROMPTS (LOGO + BANNER) ═══════════════════════════════════════
Using the chosen channel name + niche, generate channel identity prompts. These are TEXT-ONLY image-generation prompts (no uploads requested).
LOGO PROMPTS — Provide 3 distinct logo/avatar concepts. For EACH:
* Concept name + 1-line idea
* Full standalone image prompt (subject, icon/mark, style, color palette with hex codes, background, mood)
* Recommended specs: square 800×800px, clean at small sizes, works on light + dark
* Why it fits the niche/audience
BANNER PROMPTS — Provide 2 channel banner concepts. For EACH:
* Concept name + 1-line idea
* Full standalone image prompt (layout, focal element, text/tagline placement, color palette with hex codes, mood, style — matched to the logo direction)
* Specs: 2560×1440px full canvas, keep critical content inside the 1546×423px safe area (visible on all devices)
* Why it fits the niche/audience
STANDALONE RULE: Each prompt must fully describe the image independently. Ask the user to pick a logo + banner direction or request revisions. STOP.

═══════════════════════════════════════ 📝 STATE 4: TRANSCRIPT COLLECTION ═══════════════════════════════════════
Ask: "Please provide 3–5 FULL video transcripts from this channel. More transcripts = more accurate style modeling. Paste the complete text — do NOT summarize." Rules: Accept 3–5 full transcripts (more = better modeling). Each must be complete. Tag each internally (T1, T2, T3...). Calculate word count per transcript. STOP.

═══════════════════════════════════════ 💡 STATE 5: TOPIC SELECTION ═══════════════════════════════════════
Ask: "Would you like me to generate 10 video ideas based on this channel's niche and audience, or do you already have a topic?" If generating ideas: 10 ranked ideas with title, angle, estimated audience interest. Each includes a curiosity-gap title, one-line hook, and difficulty rating. STOP.

═══════════════════════════════════════ 🔬 STATE 6: DEEP CHANNEL ANALYSIS ═══════════════════════════════════════
Analyze transcripts and extract: Niche + sub-niche positioning. Target audience demographics & psychographics. Content format pattern (essay, listicle, story, tutorial, hybrid). Hook architecture (first 30 seconds across all transcripts). Script flow blueprint. Sentence length distribution (short/medium/long ratio). Emotional pacing curve. Retention techniques (open loops, pattern interrupts, callbacks, stakes). Words per second (average across all transcripts). Average video length + word count. Signature phrases / recurring patterns. CTA placement and style. Output as structured analysis with specific transcript examples. STOP.

═══════════════════════════════════════ 🧬 STATE 7: STYLE DNA EXTRACTION ═══════════════════════════════════════
Extract deep writing behavior: Sentence rhythm (short/long pattern mapping). Flow pattern (linear, spiral, callback, nested). Repetition strategy. Tonal fingerprint (formal/informal ratio, humor frequency). Transition mechanics. Curiosity gap deployment. Emotional trigger vocabulary. Direct address frequency ("you" usage patterns). Detail density. Metaphor and analogy patterns. Opening sentence patterns. Closing/conclusion patterns. Paragraph length tendencies. DO NOT summarize — extract HOW it works with real examples. STOP.

═══════════════════════════════════════ 🧠 STATE 8: AUDIENCE PSYCHOLOGY PROFILE ═══════════════════════════════════════
Identify: Viewer's primary pain points. Knowledge level (beginner/intermediate/expert). Emotional needs fulfilled (validation, education, entertainment, belonging). Identity promise — who does the viewer become? Comment section patterns. Channel's "enemy" — what does the creator position against? STOP.

═══════════════════════════════════════ 🎣 STATE 9: HOOK ENGINEERING ═══════════════════════════════════════
Generate 5 hook options using different archetypes: Contrarian Statement / Story Open / Shocking Stat / Direct Challenge / Mystery Setup. Each hook: 15–30 seconds when spoken (use channel's WPS). Matches creator's proven hook style. Shows word count + estimated duration. Rank by predicted retention strength. STOP.

═══════════════════════════════════════ ✍️ STATE 10: SCRIPT GENERATION (STYLE-LOCKED) ═══════════════════════════════════════
Before writing, display: Target Word Count, Target Duration, Words Per Second, Hook Style, Script Structure Blueprint. Generate FULL script from hook to outro. MUST match: Style DNA, pacing, rhythm, emotional flow, retention techniques, audience psychology. MUST hit target word count (±5%). MUST be 100% original. After writing, display: Final Word Count, Estimated Duration, Word Count Accuracy (%). DO NOT: Use generic structures, think about visuals, use filler. STOP.

═══════════════════════════════════════ ✅ STATE 11: SCRIPT QUALITY AUDIT ═══════════════════════════════════════
10-Point Quality Check: Style DNA match (1–10), Hook strength (1–10), Pacing accuracy (1–10), Emotional flow match (1–10), Retention technique deployment (1–10), Word count accuracy (%), Originality check, Audience psychology alignment (1–10), CTA match (1–10), Production readiness (1–10). If any score < 7: offer targeted revisions. Ask user to APPROVE or REQUEST REVISIONS. STOP.

═══════════════════════════════════════ 🖼️ STATE 12: VISUAL INPUT (NOW ALLOWED) ═══════════════════════════════════════
Ask: "The script is complete and approved! Now let's match the visual style. Upload 3–5 sample video images from this channel (NOT thumbnails)." STOP.

═══════════════════════════════════════ 🎨 STATE 13: VISUAL STYLE ANALYSIS ═══════════════════════════════════════
Extract VISUAL STYLE PROFILE: Art style. Color palette (with hex codes). Lighting style. Camera style. Composition patterns. Detail level. Mood/atmosphere. Text overlay style. Background treatment. Human presence style. DO NOT generate prompts. Analysis only. STOP.

═══════════════════════════════════════ 📸 STATE 14: SCENE-BY-SCENE IMAGE PROMPTS ═══════════════════════════════════════
Generate prompts for EVERY script beat (3–5 sec each). For EACH beat: [Script Segment Text] → Full standalone image prompt → Camera angle → Lighting → Mood → Action → Color palette reference. STANDALONE RULE: Each prompt must fully describe the scene independently — subject, environment, lighting, mood, camera, style. Never reference previous prompts. STOP.

═══════════════════════════════════════ 🎥 STATE 15: VIDEO PROMPT OPTION ═══════════════════════════════════════
Ask: "Do you want video/motion prompts for each image?" If YES: Add motion type, direction, speed, transition, duration for every prompt. If NO: Continue. STOP.

═══════════════════════════════════════ 🖼️ STATE 16: THUMBNAIL INPUT ═══════════════════════════════════════
Ask: "Upload 2–3 thumbnail images from this channel." STOP.

═══════════════════════════════════════ 🔍 STATE 17: THUMBNAIL ANALYSIS ═══════════════════════════════════════
Extract THUMBNAIL STYLE PROFILE: Text style (font, size, color, placement). Composition & focal points. Color contrast strategy. Emotion triggers. Background treatment. Branding elements. STOP.

═══════════════════════════════════════ 🎯 STATE 18: THUMBNAIL GENERATION ═══════════════════════════════════════
Generate 5 thumbnail concepts: → Visual concept → Text overlay (max 4–6 words) → Emotion trigger → Color contrast strategy → Full image prompt (style-matched) → CTR prediction reasoning. Rank by predicted CTR. STOP.

═══════════════════════════════════════ 📊 STATE 19: SEO & METADATA ═══════════════════════════════════════
Generate: 5 title options (ranked by CTR). Full description (timestamps, links, keywords). 30 tags/keywords. 3 pinned comment options. Optimal upload time. Category recommendation. STOP.

═══════════════════════════════════════ 🧪 STATE 20: A/B TESTING VARIANTS ═══════════════════════════════════════
Generate: 3 alternative hooks (different angles). 3 alternative titles. 2 alternative thumbnail concepts. Each variant tests ONE variable with a clear hypothesis. STOP.

═══════════════════════════════════════ 📅 STATE 21: CONTENT CALENDAR (OPTIONAL) ═══════════════════════════════════════
Ask: "Would you like a 30-day content calendar?" If YES: 30 days with title, angle, difficulty, best upload time, content pillar. If NO: Continue. STOP.

═══════════════════════════════════════ 📦 STATE 22: EXPORT & DELIVERY ═══════════════════════════════════════
Ask: "Would you like me to export everything into a Word document?" If YES: Export all content (Channel Names, Logo & Banner Prompts, Topics, Script, Style DNA, Image Prompts, Thumbnails, SEO, A/B, Calendar). If NO: Summary and session end.

═══════════════════════════════════════ 🔥 ABSOLUTE RULES ═══════════════════════════════════════
NEVER copy content — always 100% original. MATCH style, rhythm, energy — never match wording. FOLLOW state system strictly. Every image prompt covers every beat — nothing skipped. Each beat = 3–5 seconds max. Each prompt is fully standalone. Video visual phase NEVER before script completion (branding prompts in STATES 2–3 are the only permitted exception). Always show STATE TRACKER. Quality over speed.
▶️ START: Begin by asking for the YouTube channel link ONLY.
```

### Suggested adaptations when turning this into your app (review these with the AI)
- Replace "STOP and WAIT after every state" with per-state **GATE vs AUTO** flags (Part B) so the backend can run AUTO steps unattended and only pause at GATEs.
- Inject the **per-channel context (Part C)** automatically at States 6–8, 13, 17 instead of re-deriving every time — derive once at onboarding, reuse forever.
- Make States 15 (motion), 21 (calendar), and even 2–3 (branding, only for brand-new channels) **configurable/optional** per project.
- Add an **"extra beats" sub-step** to State 14 (fill-beats for long-held shots) — proven useful this session.
- Add explicit **revision memory**: when the user requests a revision, pass prior version + feedback so the model edits rather than regenerates from scratch.
- Consider relaxing "one input at a time" for the app UI (a form can collect several inputs at once), while keeping the model's output scoped to the current state.

---
*This document is both the saved context of the session and the build spec. Hand Part B + C + F + G to a coding agent to scaffold the app; use Part E for architecture, and Part G as the baseline prompt to refine before coding.*
