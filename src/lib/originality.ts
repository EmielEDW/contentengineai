/**
 * Style-plagiarism check (NOT fact-checking, NOT web-wide). Compares a generated
 * script against the channel's OWN reference transcripts via n-gram (shingle)
 * overlap. On breach, the orchestrator triggers an auto-revise with the offending
 * spans as feedback. Labelled clearly as style-plagiarism only (see plan §6.4).
 */
export interface OriginalityResult {
  ok: boolean;
  overlapRatio: number; // share of script shingles also present in any transcript
  longestExactMatchWords: number;
  flaggedSpans: string[];
}

export interface OriginalityThresholds {
  maxOverlapRatio: number; // e.g. 0.02
  maxLongestMatchWords: number; // e.g. 12
  shingleSize: number; // e.g. 8
}

export const DEFAULT_THRESHOLDS: OriginalityThresholds = {
  maxOverlapRatio: 0.02,
  maxLongestMatchWords: 12,
  shingleSize: 8,
};

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

export function checkOriginality(
  script: string,
  transcripts: string[],
  thresholds: OriginalityThresholds = DEFAULT_THRESHOLDS
): OriginalityResult {
  const scriptWords = normalize(script);
  const scriptShingles = shingles(scriptWords, thresholds.shingleSize);
  if (scriptShingles.length === 0) {
    return { ok: true, overlapRatio: 0, longestExactMatchWords: 0, flaggedSpans: [] };
  }

  const sourceSet = new Set<string>();
  for (const t of transcripts) {
    for (const s of shingles(normalize(t), thresholds.shingleSize)) sourceSet.add(s);
  }

  const flagged: string[] = [];
  let hits = 0;
  for (const s of scriptShingles) {
    if (sourceSet.has(s)) {
      hits++;
      if (flagged.length < 20) flagged.push(s);
    }
  }
  const overlapRatio = hits / scriptShingles.length;

  // longest contiguous exact run (in words) of script that appears in a source
  const longest = longestExactRun(scriptWords, transcripts.map(normalize));

  const ok =
    overlapRatio <= thresholds.maxOverlapRatio && longest <= thresholds.maxLongestMatchWords;
  return { ok, overlapRatio, longestExactMatchWords: longest, flaggedSpans: flagged };
}

function longestExactRun(scriptWords: string[], sources: string[][]): number {
  // Cheap heuristic: scan for the longest window that exists verbatim in a source.
  const sourceJoined = sources.map((s) => " " + s.join(" ") + " ");
  let longest = 0;
  for (let i = 0; i < scriptWords.length; i++) {
    for (let len = longest + 1; i + len <= scriptWords.length && len <= 40; len++) {
      const window = " " + scriptWords.slice(i, i + len).join(" ") + " ";
      if (sourceJoined.some((src) => src.includes(window))) longest = len;
      else break;
    }
  }
  return longest;
}
