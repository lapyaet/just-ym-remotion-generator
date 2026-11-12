import { z } from "zod";
import { isSafeMusicFile, MUSIC_IDS, MUSIC_TRACKS } from "./music";

/**
 * Two shapes of the same video:
 *  - GeneratedVideo: what the AI writes. Photos and products are referenced by
 *    short ids ("p3") from a list we give it, so it can't invent URLs or prices.
 *  - VideoSpec: what Remotion renders and what we store. Ids are resolved to
 *    real image URLs and live product data from justym.me.
 * Every AI field is required (structured outputs work best that way); empty
 * strings / arrays mean "not used".
 */

export const SCENE_TYPES = ["hook", "attraction", "caption", "deals", "payment", "outro"] as const;

export const GeneratedSceneSchema = z.object({
  type: z.enum(SCENE_TYPES).describe(
    [
      "hook: opening scene. kicker is a small playful word (e.g. 'Hello'), headline is ONE big word or name in capitals (e.g. 'BANGKOK'), subtitle is a short line in a white pill.",
      "attraction: one attraction on a full-screen photo. tag = attraction name in capitals for the orange pill, location = '@CITY' or a short place line, headline + highlight = two-line caption, subtitle = small English line, productIds = exactly one product to show as a price card.",
      "caption: a text moment on a photo (a question, a tip, 'WORTH IT!'). headline + highlight + optional subtitle.",
      "deals: 2-4 product cards in a grid. headline + highlight on top, productIds = the products, subtitle = short line in a white pill at the bottom.",
      "payment: orange scene saying you can pay with Myanmar wallets (KBZPay, AYA Pay, Wave, MMQR) and no need to exchange baht. headline + highlight + subtitle.",
      "outro: closing scene with the logo and 'Book now · justym.me'. headline like 'Your Moment.', highlight = short line under it.",
    ].join(" "),
  ),
  kicker: z.string().describe("hook only: small playful word above the headline. Empty string otherwise."),
  tag: z.string().describe("attraction only: attraction name in CAPITALS for the orange pill. Empty string otherwise."),
  location: z.string().describe("attraction only: '@PHUKET' or 'MAYA BAY · KHAI ISLAND'. Empty string otherwise."),
  headline: z.string().describe("Main line, max ~6 words (Burmese or the requested language)."),
  highlight: z.string().describe("Second line shown in orange, max ~5 words. Empty string if unused."),
  subtitle: z.string().describe("Small supporting line, usually English, max ~8 words. Empty string if unused."),
  photoId: z.string().describe("Id of a photo from the list (e.g. 'p3') for the full-screen background, or empty string."),
  productIds: z.array(z.string()).describe("Product ids from the list: 1 for attraction, 2-4 for deals, empty otherwise."),
  discount: z
    .string()
    .describe("Discount label like '27% OFF' or 'UP TO 63% OFF' ONLY if the user's request states that discount. Otherwise empty string."),
  durationInSeconds: z.number().describe("2-5 seconds. Short, punchy scenes like a social media reel."),
  transition: z.enum(["cut", "fade", "orange-wipe"]).describe("How this scene changes into the next one."),
});

export const GeneratedVideoSchema = z.object({
  title: z.string().describe("Short project title, max ~6 words, e.g. 'Bangkok is Calling'."),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
  music: z
    .enum([...MUSIC_IDS, "none"])
    .describe(`Background music that fits the mood: ${MUSIC_TRACKS.map((t) => `${t.id} (${t.mood})`).join("; ")}; or none.`),
  scenes: z.array(GeneratedSceneSchema).describe("5-10 scenes: start with hook, end with outro."),
});

export type GeneratedScene = z.infer<typeof GeneratedSceneSchema>;
export type GeneratedVideo = z.infer<typeof GeneratedVideoSchema>;

// ---------- Rendered / stored spec ----------

export const ProductSchema = z.object({
  name: z.string(),
  city: z.string(),
  imageUrl: z.string(),
  priceText: z.string(),
  pageUrl: z.string(),
});

export const SceneSchema = GeneratedSceneSchema.omit({ photoId: true, productIds: true }).extend({
  imageUrl: z.string(),
  products: z.array(ProductSchema),
});

export const VideoSpecSchema = z.object({
  version: z.literal(2),
  title: z.string(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
  /** e.g. "Prices shown on justym.me, Nov 2026. Subject to change." */
  priceNote: z.string(),
  /** File in /public/music, or "" for silent. */
  music: z.string(),
  scenes: z.array(SceneSchema),
});

export type Product = z.infer<typeof ProductSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type VideoSpec = z.infer<typeof VideoSpecSchema>;

export const FPS = 30;
export const COMPOSITION_ID = "GeneratedVideo";
export const TRANSITION_FRAMES = 14;

export const BRAND = {
  orange: "#FF914D",
  orangeDeep: "#F26B1D",
  gold: "#C89116",
  ink: "#16120F",
  peach: "#FFF1E6",
  white: "#FFFFFF",
  green: "#16A34A",
} as const;

/** Brand assets shipped in /public. */
export const ASSETS = {
  logo: "brand/justym-logo.svg",
  mascotBody: "brand/mascot-body.png",
  mascotArm: "brand/mascot-arm.png",
} as const;

export const DIMENSIONS: Record<VideoSpec["aspectRatio"], { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const cut = (s: string, n: number) => (s ?? "").trim().slice(0, n);

/** Clamp and repair a spec so rendering never breaks on odd model output. */
export function normalizeSpec(spec: VideoSpec): VideoSpec {
  const scenes = spec.scenes.slice(0, 14).map((s) => ({
    ...s,
    kicker: cut(s.kicker, 30),
    tag: cut(s.tag, 40),
    location: cut(s.location, 50),
    headline: cut(s.headline, 90),
    highlight: cut(s.highlight, 70),
    subtitle: cut(s.subtitle, 90),
    discount: cut(s.discount, 24),
    imageUrl: /^https:\/\//.test(s.imageUrl ?? "") ? s.imageUrl : "",
    products: (s.products ?? []).slice(0, 4),
    durationInSeconds: clamp(Number(s.durationInSeconds) || 3, 1.5, 8),
  }));
  return {
    ...spec,
    music: isSafeMusicFile(spec.music ?? "") ? spec.music : "",
    version: 2,
    title: cut(spec.title, 80) || "Untitled video",
    scenes: scenes.length ? scenes : [emptyScene("outro", { headline: "Your Moment." })],
  };
}

export function emptyScene(type: Scene["type"], fields: Partial<Scene> = {}): Scene {
  return {
    type,
    kicker: "",
    tag: "",
    location: "",
    headline: "",
    highlight: "",
    subtitle: "",
    imageUrl: "",
    products: [],
    discount: "",
    durationInSeconds: 3,
    transition: "fade",
    ...fields,
  };
}

/** Frames per scene, plus the total (transitions overlap neighbouring scenes). */
export function sceneFrames(spec: VideoSpec) {
  return spec.scenes.map((s) => Math.round(s.durationInSeconds * FPS));
}

export function totalFrames(spec: VideoSpec) {
  const frames = sceneFrames(spec);
  const overlaps = spec.scenes.slice(0, -1).filter((s) => s.transition !== "cut").length * TRANSITION_FRAMES;
  return Math.max(1, frames.reduce((a, b) => a + b, 0) - overlaps);
}

/** Convert a spec saved by the first version of the app (theme + heading/body scenes). */
export function fromLegacySpec(raw: Record<string, unknown>): VideoSpec {
  type Legacy = { type?: string; heading?: string; body?: string; items?: string[]; imageUrl?: string; durationInSeconds?: number };
  const scenes = ((raw.scenes as Legacy[]) ?? []).map((s) =>
    emptyScene(s.type === "title" ? "hook" : s.type === "outro" ? "outro" : "caption", {
      headline: s.heading ?? "",
      subtitle: s.body || (s.items ?? []).join(" · "),
      imageUrl: s.imageUrl ?? "",
      durationInSeconds: s.durationInSeconds ?? 3,
    }),
  );
  return normalizeSpec({
    version: 2,
    title: String(raw.title ?? "Untitled video"),
    aspectRatio: (["9:16", "16:9", "1:1"] as const).find((a) => a === raw.aspectRatio) ?? "16:9",
    priceNote: "",
    music: "",
    scenes,
  });
}
