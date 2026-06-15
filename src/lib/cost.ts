/**
 * Cost estimation for the mandatory cost-gate that precedes any media fan-out.
 * Rough figures from provider metadata; the UI shows the estimate and the user
 * must approve before generation runs. Per-org quota is enforced separately
 * (assertOrgQuota) as a hard NonRetriableError before the first generate call.
 */
import { getProviderMeta } from "./providers/registry";

export interface MediaEstimateInput {
  beats: Array<{ durationSec: number; isFillBeat?: boolean }>;
  videoProviderId: string | null; // null => video skipped (e.g. manual handoff)
  imageProviderId: string;
  /** Generate one image per beat by default. */
  imagesPerBeat?: number;
}

export interface MediaEstimate {
  imageCents: number;
  videoCents: number;
  totalCents: number;
  breakdown: string;
}

export function estimateMediaCost(input: MediaEstimateInput): MediaEstimate {
  const imageMeta = getProviderMeta("image", input.imageProviderId);
  const imageRate = imageMeta?.approxCostPerUnitCents ?? 4; // cents/image
  const imageCount = input.beats.length * (input.imagesPerBeat ?? 1);
  const imageCents = Math.round(imageCount * imageRate);

  let videoCents = 0;
  if (input.videoProviderId) {
    const videoMeta = getProviderMeta("video", input.videoProviderId);
    const rate = videoMeta?.approxCostPerUnitCents ?? 15; // cents/sec
    const totalSec = input.beats.reduce((acc, b) => acc + b.durationSec, 0);
    videoCents = Math.round(totalSec * rate);
  }

  const totalCents = imageCents + videoCents;
  return {
    imageCents,
    videoCents,
    totalCents,
    breakdown: `${imageCount} images ≈ $${(imageCents / 100).toFixed(2)} + video ≈ $${(
      videoCents / 100
    ).toFixed(2)} = $${(totalCents / 100).toFixed(2)}`,
  };
}

export class QuotaExceededError extends Error {
  constructor(public readonly orgId: string, public readonly neededCents: number, public readonly remainingCents: number) {
    super(`Org ${orgId} quota exceeded: needs ${neededCents}c, ${remainingCents}c remaining`);
    this.name = "QuotaExceededError";
  }
}
