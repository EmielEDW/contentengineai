/**
 * Mock data so the UI looks like a real product before the Supabase/Inngest
 * backend is wired (Phase 1+). Nothing here touches the database.
 */
import { STATES } from "@/lib/pipeline/states";

export interface MockChannel {
  id: string;
  name: string;
  handle: string;
  niche: string;
  videos: number;
  inReview: number;
  accent: string;
}

export const MOCK_CHANNELS: MockChannel[] = [
  { id: "dom-economics", name: "Dom Economics", handle: "@domeconomics", niche: "Personal finance / macro for the smart layperson", videos: 12, inReview: 2, accent: "#16a34a" },
  { id: "deep-history", name: "DeepHistory", handle: "@deephistory", niche: "Long-form narrative history essays", videos: 3, inReview: 0, accent: "#3b82f6" },
];

export interface MockReviewItem {
  channel: string;
  video: string;
  stateNo: number;
  state: string;
  waiting: string;
  channelId: string;
}

export const MOCK_INBOX: MockReviewItem[] = [
  { channel: "Dom Economics", channelId: "dom-economics", video: "Google Is Quietly Funding the Biggest Bubble in History", stateNo: 9, state: "Hook Engineering", waiting: "12m" },
  { channel: "Dom Economics", channelId: "dom-economics", video: "The Hidden Tax You Pay Every Day", stateNo: 18, state: "Thumbnail Generation", waiting: "1h" },
];

export const MOCK_ACTIVITY: string[] = [
  '“Google Is Quietly Funding…” reached State 9 · Hook Engineering — 12m ago',
  '“The Hidden Tax…” auto-completed State 17 · Thumbnail Analysis — 1h ago',
  '“Crash Forensics: 2008” exported a full package — yesterday',
];

export interface MockHook {
  rank: number;
  archetype: string;
  text: string;
  words: number;
  seconds: number;
  score: number;
}

export const MOCK_HOOKS: MockHook[] = [
  { rank: 1, archetype: "Bold claim", text: "Google just borrowed $85 billion — not because it's broke, but because it's about to front-run the entire market.", words: 21, seconds: 7, score: 9.1 },
  { rank: 2, archetype: "Curiosity gap", text: "There's a reason the richest company on earth suddenly started begging for cash. You're not going to like it.", words: 20, seconds: 7, score: 8.6 },
  { rank: 3, archetype: "Question", text: "What does a trillion-dollar company know that you don't — and why is it quietly raising debt to act on it?", words: 22, seconds: 8, score: 8.2 },
  { rank: 4, archetype: "Pattern interrupt", text: "Forget everything you've heard about the AI boom. The real money move just happened on a balance sheet.", words: 19, seconds: 7, score: 7.9 },
  { rank: 5, archetype: "Story open", text: "In a single afternoon, Google raised more debt than most countries hold. Here's what it's really for.", words: 18, seconds: 6, score: 7.4 },
];

export interface MockVideo {
  id: string;
  title: string;
  currentState: number;
  status: "running" | "awaiting_curation" | "completed";
}

export const MOCK_VIDEOS: Record<string, MockVideo[]> = {
  "dom-economics": [
    { id: "v1", title: "Google Is Quietly Funding the Biggest Bubble in History", currentState: 9, status: "awaiting_curation" },
    { id: "v2", title: "The Hidden Tax You Pay Every Day", currentState: 18, status: "awaiting_curation" },
    { id: "v3", title: "Crash Forensics: What Really Broke in 2008", currentState: 22, status: "completed" },
  ],
  "deep-history": [
    { id: "v4", title: "The Night Rome Actually Fell", currentState: 6, status: "running" },
  ],
};

export const PHASES: { name: string; from: number; to: number }[] = [
  { name: "Foundation", from: 1, to: 8 },
  { name: "Script", from: 9, to: 11 },
  { name: "Visuals", from: 12, to: 18 },
  { name: "Delivery", from: 19, to: 22 },
];

export function statesInPhase(from: number, to: number) {
  return STATES.filter((s) => s.no >= from && s.no <= to);
}

export function channelById(id: string): MockChannel | undefined {
  return MOCK_CHANNELS.find((c) => c.id === id);
}
