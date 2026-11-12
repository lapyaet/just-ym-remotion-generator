import "server-only";
import type { GeneratedVideo, VideoSpec } from "@/remotion/schema";
import { getCatalog } from "@/lib/justym-catalog";
import { generateWithClaude } from "./claude";
import { buildDemoVideo } from "./demo";
import { generateWithOpenModel, openModelLabel } from "./open-model";
import { buildChoices, resolveGenerated, toGenerated } from "./resolve";

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
export async function generateVideoSpec(prompt: string, previous?: VideoSpec): Promise<VideoSpec> {
  const catalog = await getCatalog();
  const context = [prompt, previous?.title, ...(previous?.scenes.flatMap((s) => [s.tag, s.location, ...s.products.map((p) => `${p.name} ${p.city}`)]) ?? [])].join(" ");
  const choices = buildChoices(catalog, context, previous);
  const previousGen = previous ? toGenerated(previous, choices) : undefined;

  let generated: GeneratedVideo;
  switch (getProvider()) {
    case "open-model":
      generated = await generateWithOpenModel(prompt, previousGen, choices);
      break;
    case "claude":
      generated = await generateWithClaude(prompt, previousGen, choices);
      break;
    default:
      generated = buildDemoVideo(prompt, previousGen, choices);
  }
  return resolveGenerated(generated, choices, prompt, previous);
}
