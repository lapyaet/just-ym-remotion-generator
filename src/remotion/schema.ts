import { z } from "zod";

/**
 * The structured "video spec" Claude writes. Remotion renders it with fixed,
 * hand-written components, so no model-generated code is ever executed.
 * Every field is required (structured outputs works best that way); empty
 * strings / arrays mean "not used".
 */
export const SceneSchema = z.object({
  type: z
    .enum(["title", "text", "bullets", "quote", "stat", "outro"])
    .describe(
      "title: big opening headline. text: heading + paragraph. bullets: heading + 2-5 short items. quote: body is the quote, heading is the author. stat: heading is a big number/stat, body explains it. outro: closing call to action.",
    ),
  heading: z.string().describe("Main line of the scene, max ~8 words."),
  body: z.string().describe("Supporting text, max ~25 words. Empty string if unused."),
  items: z.array(z.string()).describe("Bullet items for 'bullets' scenes (2-5, each max ~6 words). Empty array otherwise."),
  emoji: z.string().describe("One emoji that fits the scene, or empty string."),
  durationInSeconds: z.number().describe("How long the scene stays on screen, 2-8 seconds."),
  animation: z.enum(["fade", "slide-up", "zoom", "typewriter"]),
  background: z.enum(["solid", "gradient", "radial", "grid"]),
});

export const VideoSpecSchema = z.object({
  title: z.string().describe("Short project title, max ~6 words."),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  theme: z.object({
    background: z.string().describe("Hex color like #0f172a"),
    primary: z.string().describe("Hex color for gradients and highlights"),
    accent: z.string().describe("Hex color for small accents"),
    text: z.string().describe("Hex color for text; must contrast with background"),
    font: z.enum(["sans", "serif", "mono", "display"]),
  }),
  scenes: z.array(SceneSchema).describe("3-10 scenes in order."),
});

export type Scene = z.infer<typeof SceneSchema>;
export type VideoSpec = z.infer<typeof VideoSpecSchema>;

export const FPS = 30;
export const COMPOSITION_ID = "GeneratedVideo";

export const DIMENSIONS: Record<VideoSpec["aspectRatio"], { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Clamp and repair a spec so rendering never breaks on odd model output. */
export function normalizeSpec(spec: VideoSpec): VideoSpec {
  const color = (value: string, fallback: string) => (HEX.test(value.trim()) ? value.trim() : fallback);
  const scenes = spec.scenes.slice(0, 12).map((s) => ({
    ...s,
    heading: s.heading.slice(0, 120),
    body: s.body.slice(0, 300),
    items: s.items.slice(0, 6).map((i) => i.slice(0, 80)),
    durationInSeconds: clamp(Number(s.durationInSeconds) || 4, 2, 10),
  }));
  return {
    ...spec,
    title: spec.title.slice(0, 80) || "Untitled video",
    theme: {
      background: color(spec.theme.background, "#0f172a"),
      primary: color(spec.theme.primary, "#6366f1"),
      accent: color(spec.theme.accent, "#f59e0b"),
      text: color(spec.theme.text, "#f8fafc"),
      font: spec.theme.font,
    },
    scenes: scenes.length
      ? scenes
      : [{ type: "title", heading: spec.title || "Untitled", body: "", items: [], emoji: "", durationInSeconds: 4, animation: "fade", background: "gradient" }],
  };
}

export function totalFrames(spec: VideoSpec) {
  return spec.scenes.reduce((sum, s) => sum + Math.round(s.durationInSeconds * FPS), 0);
}
