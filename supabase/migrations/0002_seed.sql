-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ Seed: the 22 pipeline states + the provider registry rows.                  ║
-- ║ is_visual = true ONLY for states that GENERATE scene/video/thumbnail imagery ║
-- ║ (14, 15, 18) — these are blocked until the script is approved at state 11.   ║
-- ║ State 3 (branding) generates images too but is the explicit exception, so    ║
-- ║ is_visual = false (it is allowed before script approval).                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

insert into pipeline_state_defs
  (state_no, slug, title, kind, is_optional, is_visual, needs_user_upload, produces_asset_types, description) values
  (1,  'channel_input',         'Channel Input',               'auto', false, false, false, '{}',                         'Parse reference channel URL into niche/tone.'),
  (2,  'channel_name_gen',      'Channel Name Generation',     'gate', false, false, false, '{channel_name}',             '10 ranked channel name options.'),
  (3,  'channel_branding',      'Channel Branding',            'gate', false, false, false, '{branding_prompt}',          '3 logo + 2 banner prompts (visual-gating exception).'),
  (4,  'transcript_collection', 'Transcript Collection',       'auto', false, false, false, '{}',                         '3-5 full transcripts, word counts, WPS.'),
  (5,  'topic_selection',       'Topic Selection',             'gate', false, false, false, '{topic_idea}',               '10 ranked ideas OR a locked user topic.'),
  (6,  'deep_channel_analysis', 'Deep Channel Analysis',       'auto', false, false, false, '{channel_analysis}',         'Niche, audience, format, hook arch, WPS, CTA.'),
  (7,  'style_dna',             'Style DNA',                   'auto', false, false, false, '{style_dna}',                'Rhythm, flow, tone ratio, vocab, openings/closings.'),
  (8,  'audience_psychology',   'Audience Psychology',         'auto', false, false, false, '{audience_psychology}',      'Pain points, needs, identity promise, enemy.'),
  (9,  'hook_engineering',      'Hook Engineering',            'gate', false, false, false, '{hook}',                     '5 hooks across 5 archetypes, ranked.'),
  (10, 'script_generation',     'Script Generation',           'gate', false, false, false, '{script}',                   'Full style-locked script, target word count ±5%.'),
  (11, 'script_quality_audit',  'Script Quality Audit',        'gate', false, false, false, '{script_audit}',             '10-point scorecard; gate to visuals.'),
  (12, 'visual_input',          'Visual Input',                'gate', false, false, true,  '{}',                         'Upload 3-5 sample frames.'),
  (13, 'visual_style_analysis', 'Visual Style Analysis',       'auto', false, false, false, '{visual_style}',             'Analyse uploaded frames (vision, not generation).'),
  (14, 'scene_prompts',         'Scene-by-Scene Prompts',      'auto', false, true,  false, '{scene_prompt}',             'One standalone image prompt per beat + fill-beats.'),
  (15, 'motion_prompts',        'Video/Motion Prompts',        'gate', true,  true,  false, '{motion_prompt}',            'Per-beat motion specs (optional).'),
  (16, 'thumbnail_input',       'Thumbnail Input',             'gate', false, false, true,  '{}',                         'Upload 2-3 thumbnails.'),
  (17, 'thumbnail_analysis',    'Thumbnail Analysis',          'auto', false, false, false, '{thumbnail_analysis}',       'Analyse uploaded thumbnails (vision).'),
  (18, 'thumbnail_generation',  'Thumbnail Generation',        'gate', false, true,  false, '{thumbnail_concept}',        '5 concepts with CTR reasoning, ranked.'),
  (19, 'seo_metadata',          'SEO & Metadata',              'auto', false, false, false, '{seo}',                      '5 titles, description, 30 tags, pinned comments.'),
  (20, 'ab_variants',           'A/B Variants',                'auto', false, false, false, '{ab_variant}',               '3 hooks + 3 titles + 2 thumbnails with hypotheses.'),
  (21, 'content_calendar',      'Content Calendar',            'gate', true,  false, false, '{calendar}',                 '30-day calendar (optional).'),
  (22, 'export_delivery',       'Export & Delivery',           'auto', false, false, false, '{export_bundle}',            'Bundle package (+ optional YouTube upload post-audit).');

insert into providers (id, display_name, modalities, auth_type, has_public_api, config_schema) values
  ('anthropic',  'Anthropic Claude',          '{llm}',          'api_key', true,  '{}'::jsonb),
  ('gemini',     'Google Gemini',             '{llm,image}',    'api_key', true,  '{}'::jsonb),
  ('fal',        'fal.ai (aggregator)',       '{image,video}',  'api_key', true,  '{}'::jsonb),
  ('elevenlabs', 'ElevenLabs',                '{voice}',        'api_key', true,  '{}'::jsonb),
  ('veo',        'Google Veo (Gemini API)',   '{video}',        'api_key', true,  '{}'::jsonb),
  ('flow',       'Google Flow (manual)',      '{video}',        'none',    false, '{}'::jsonb),
  ('youtube',    'YouTube Data API',          '{youtube}',      'oauth',   true,  '{}'::jsonb);
