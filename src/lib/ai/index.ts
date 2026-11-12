import "server-only";
import type { GeneratedVideo, VideoSpec } from "@/remotion/schema";
import { getCatalog } from "@/lib/justym-catalog";
import { generateWithClaude } from "./claude";
import { buildDemoVideo } from "./demo";
import { generateWithOpenModel, openModelLabel } from "./open-model";
import { buildChoices, resolveGenerated, toGenerated } from "./resolve";
import { applyBlueprint, chooseBlueprint, chooseTemplate, explicitTemplate, getUserHistory, hasOwnStructure, varyMusic } from "./variety";

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

/**
 * Prompt -> video spec. Pass `previous` to revise an existing video.
 * For new videos the app decides the design (template + scene structure) up
 * front so consecutive videos never look the same; see ./variety.ts.
 */
export async function generateVideoSpec(prompt: string, previous?: VideoSpec, options: { userId?: string } = {}): Promise<VideoSpec> {
  const catalog = await getCatalog();
  const context = [prompt, previous?.title, ...(previous?.scenes.flatMap((s) => [s.tag, s.location, ...s.products.map((p) => `${p.name} ${p.city}`)]) ?? [])].join(" ");
  const choices = buildChoices(catalog, context, previous);
  const previousGen = previous ? toGenerated(previous, choices) : undefined;

  // Decide the design.
  const history = previous ? null : await getUserHistory(options.userId);
  const template = previous ? (explicitTemplate(prompt) ?? previous.template) : chooseTemplate(prompt, history!);
  const ownStructure = hasOwnStructure(prompt);
  const blueprint = previous || ownStructure ? null : chooseBlueprint(template, history!);
  const design = [
    `Design for this video (decided by the app; follow it): template = ${template}.`,
    blueprint
      ? `Scene structure, exactly in this order: ${blueprint.scenes.join(", ")} (${blueprint.label}).`
      : ownStructure
        ? "Scene structure: follow the order of the user's script/brief."
        : "Scene structure: keep the current structure unless the request asks to change it.",
    `Write the copy in the voice of the ${template} template.`,
  ].join("\n");
  const aiPrompt = `${prompt}\n\n${design}`;

  let generated: GeneratedVideo;
  switch (getProvider()) {
    case "open-model":
      generated = await generateWithOpenModel(aiPrompt, previousGen, choices);
      break;
    case "claude":
      generated = await generateWithClaude(aiPrompt, previousGen, choices);
      break;
    default:
      generated = buildDemoVideo(prompt, previousGen, choices);
  }

  // Enforce the decided design, whatever the AI returned.
  generated = { ...generated, template, scenes: blueprint ? applyBlueprint(generated.scenes, blueprint.scenes) : generated.scenes };
  const spec = resolveGenerated(generated, choices, prompt, previous);
  if (previous) return { ...spec, seed: previous.seed };
  return { ...spec, music: varyMusic(spec.music, history!) };
}
