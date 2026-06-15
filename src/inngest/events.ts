/**
 * Event names + payloads. Gate decisions from the UI are sent as events; the
 * paused pipeline resumes on the matching event.
 *
 * GATE_TIMEOUT: do NOT assume 30d. Verify the actual max waitForEvent duration for
 * your Inngest plan before raising this. 7d is a safe starting default; a video
 * left untouched longer than this expires gracefully and can be resumed manually.
 */
export const GATE_TIMEOUT = "7d";
export const MAX_REVISIONS = 6; // bound the revise loop (human + auto), per critique

export interface GateDecision {
  videoId: string;
  action: "approve" | "revise";
  /** For 'approve' on ranked outputs: which option/version was selected. */
  selectedAssetId?: string;
  /** For 'revise': free-text feedback fed into revision-memory. */
  feedback?: string;
}

export type Events = {
  "pipeline/start": { data: { videoId: string; orgId: string } };
  "onboarding/start": { data: { channelId: string; orgId: string } };
  "gate/decided": { data: GateDecision & { stateNo: number } };
  "gate/cost.approved": { data: { videoId: string; approved: boolean } };
  "media/fanout.requested": { data: { videoId: string; orgId: string } };
  "media/flow.requested": { data: { videoId: string; orgId: string } };
  "flow/clip.uploaded": { data: { videoId: string; beatId: string } };
  "flow/finalize": { data: { videoId: string } };
};
