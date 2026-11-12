import "server-only";
import type { VideoSpec } from "@/remotion/schema";
import { generateWithClaude } from "./claude";
import { buildDemoSpec } from "./demo";
import { generateWithOpenModel, openModelLabel } from "./open-model";

export { GenerationError } from "./prompt";

export type Provider = "open-model" | "claude" | "demo";

/**
 * Which AI writes the videos. Set AI_PROVIDER to force one; otherwise:
 * LLM_BASE_URL set -> open-source model, ANTHROPIC_API_KEY set -> Claude,
 * neither -> free rule-based demo mode.
 */
export function getProvider(): Provider {
  const forced = process.env.AI_PROVIDER?.trim();
  if (forced === "open-model" || forced === "claude" || forced === "demo") return forced;
  if (process.env.LLM_BASE_URL?.trim()) return "open-model";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "claude";
  return "demo";
}

export function providerLabel() {
  const provider = getProvider();
  if (provider === "open-model") return `Open-source model: ${openModelLabel()}`;
  if (provider === "claude") return "Claude Opus 5.5";
  return "Free demo mode (no AI)";
}

/** Prompt -> video spec. Pass `previous` to revise an existing video. */
export function generateVideoSpec(prompt: string, previous?: VideoSpec): Promise<VideoSpec> {
  switch (getProvider()) {
    case "open-model":
      return generateWithOpenModel(prompt, previous);
    case "claude":
      return generateWithClaude(prompt, previous);
    default:
      return Promise.resolve(buildDemoSpec(prompt, previous));
  }
}
