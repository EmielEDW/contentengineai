import { videoPipeline } from "./video-pipeline";
import { mediaFanout } from "./media-fanout";
import { flowHandoff } from "./flow-handoff";
import { onboardingPipeline } from "./onboarding";

export const functions = [videoPipeline, mediaFanout, flowHandoff, onboardingPipeline];
