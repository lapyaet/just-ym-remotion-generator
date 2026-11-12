import "server-only";
import { normalizeSpec, type Scene, type VideoSpec } from "@/remotion/schema";

/**
 * Free "demo mode" generator used when ANTHROPIC_API_KEY is not set.
 * Builds a video spec from the prompt with simple rules (no AI), so the
 * rest of the app (login, preview, revise, render) can be tried for free.
 */

type Theme = VideoSpec["theme"];

const THEMES: { keywords: string[]; theme: Theme }[] = [
  { keywords: ["warm", "autumn", "fall", "coffee", "cozy", "pumpkin", "orange"], theme: { background: "#2a160c", primary: "#ea580c", accent: "#fbbf24", text: "#fff7ed", font: "serif" } },
  { keywords: ["neon", "cyber", "tech", "app", "startup", "launch", "purple", "ai"], theme: { background: "#0b0614", primary: "#a855f7", accent: "#22d3ee", text: "#faf5ff", font: "display" } },
  { keywords: ["ocean", "sea", "water", "blue", "travel", "beach", "summer"], theme: { background: "#04213b", primary: "#0ea5e9", accent: "#facc15", text: "#f0f9ff", font: "sans" } },
  { keywords: ["nature", "green", "plant", "eco", "photosynthesis", "forest", "health"], theme: { background: "#052e16", primary: "#22c55e", accent: "#fde047", text: "#f0fdf4", font: "sans" } },
  { keywords: ["love", "pink", "wedding", "valentine", "beauty", "fashion"], theme: { background: "#2b0a1a", primary: "#ec4899", accent: "#fda4af", text: "#fff1f2", font: "serif" } },
  { keywords: ["light", "white", "clean", "minimal", "business", "corporate"], theme: { background: "#f8fafc", primary: "#2563eb", accent: "#f59e0b", text: "#0f172a", font: "sans" } },
  { keywords: ["code", "developer", "programming", "terminal", "hacker"], theme: { background: "#0d1117", primary: "#3fb950", accent: "#58a6ff", text: "#e6edf3", font: "mono" } },
  { keywords: [], theme: { background: "#0f172a", primary: "#6366f1", accent: "#f59e0b", text: "#f8fafc", font: "sans" } },
];

const EMOJIS: [string[], string][] = [
  [["coffee", "latte", "cafe"], "☕"],
  [["travel", "trip", "japan", "flight"], "✈️"],
  [["app", "launch", "startup", "rocket"], "🚀"],
  [["plant", "photosynthesis", "nature", "eco"], "🌱"],
  [["money", "budget", "finance", "sale"], "💰"],
  [["food", "recipe", "cook", "restaurant"], "🍽️"],
  [["music", "song", "concert"], "🎵"],
  [["school", "learn", "student", "explain"], "📚"],
  [["fitness", "gym", "workout", "health"], "💪"],
  [["code", "developer", "programming"], "💻"],
];

const ANIMATIONS: Scene["animation"][] = ["zoom", "slide-up", "fade", "typewriter"];
const BACKGROUNDS: Scene["background"][] = ["radial", "gradient", "grid", "solid"];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(text));

function pickAspect(text: string): VideoSpec["aspectRatio"] | null {
  if (has(text, ["vertical", "reel", "short", "tiktok", "story", "stories", "9:16", "portrait"])) return "9:16";
  if (has(text, ["square", "instagram post", "1:1"])) return "1:1";
  if (has(text, ["horizontal", "landscape", "youtube", "16:9", "widescreen"])) return "16:9";
  return null;
}

function pickTheme(text: string, fallbackIndex: number): Theme {
  const match = THEMES.find((t) => t.keywords.length && has(text, t.keywords));
  return { ...(match ?? THEMES[fallbackIndex % THEMES.length]).theme };
}

function pickEmoji(text: string) {
  return EMOJIS.find(([words]) => has(text, words))?.[1] ?? "✨";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function words(text: string, max: number) {
  const list = text.split(/\s+/).filter(Boolean);
  return list.slice(0, max).join(" ") + (list.length > max ? "…" : "");
}

function makeTitle(prompt: string) {
  let cleaned = prompt
    .split(/[,.;!?\n]/)[0]
    .replace(/\b(\d+[- ]?(second|sec|s|minute|min)s?|vertical|horizontal|square|video|promo|intro|clip|reel)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  // Strip leading filler words ("a ... for a ...").
  const filler = /^(a|an|the|make|create|generate|me|for|about|on|of|to|my|our|explain)\s+/i;
  while (filler.test(cleaned)) cleaned = cleaned.replace(filler, "");
  return capitalize(words(cleaned || prompt, 6).replace(/[,.;:]+$/, ""));
}

export function buildDemoSpec(prompt: string, previous?: VideoSpec): VideoSpec {
  if (previous) return reviseDemoSpec(previous, prompt);

  const seed = hash(prompt);
  const title = makeTitle(prompt);
  const emoji = pickEmoji(prompt);

  // Split the prompt into phrases and turn them into scenes.
  const phrases = prompt
    .split(/[.!?;\n]+|,\s+(?:and\s+)?|\s+and\s+|\s+with\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).length >= 2);

  const scenes: Scene[] = [
    { type: "title", heading: title, body: "", items: [], emoji, durationInSeconds: 3, animation: "zoom", background: "radial" },
  ];

  if (phrases.length >= 3) {
    scenes.push({
      type: "bullets",
      heading: "Highlights",
      body: "",
      items: phrases.slice(0, 4).map((p) => capitalize(words(p, 6))),
      emoji: "",
      durationInSeconds: 5,
      animation: "slide-up",
      background: "grid",
    });
  }

  phrases.slice(0, 3).forEach((p, i) => {
    scenes.push({
      type: "text",
      heading: capitalize(words(p, 7)),
      body: "",
      items: [],
      emoji: "",
      durationInSeconds: 3.5,
      animation: ANIMATIONS[(seed + i) % ANIMATIONS.length],
      background: BACKGROUNDS[(seed + i + 1) % BACKGROUNDS.length],
    });
  });

  scenes.push({ type: "outro", heading: "Thanks for watching", body: title, items: [], emoji, durationInSeconds: 3, animation: "fade", background: "gradient" });

  return normalizeSpec({
    title,
    aspectRatio: pickAspect(prompt) ?? "16:9",
    theme: pickTheme(prompt, seed),
    scenes,
  });
}

/** Demo revisions: understands colors/moods, formats, "faster"/"slower". */
function reviseDemoSpec(spec: VideoSpec, request: string): VideoSpec {
  const next: VideoSpec = structuredClone(spec);
  let changed = false;

  const aspect = pickAspect(request);
  if (aspect) {
    next.aspectRatio = aspect;
    changed = true;
  }
  if (THEMES.some((t) => t.keywords.length && has(request, t.keywords))) {
    next.theme = pickTheme(request, 0);
    changed = true;
  }
  if (has(request, ["faster", "shorter", "quick"])) {
    next.scenes.forEach((s) => (s.durationInSeconds = Math.max(2, s.durationInSeconds * 0.7)));
    changed = true;
  }
  if (has(request, ["slower", "longer"])) {
    next.scenes.forEach((s) => (s.durationInSeconds = s.durationInSeconds * 1.3));
    changed = true;
  }
  if (!changed) {
    // Unknown request: add it as a new scene before the outro and shuffle the palette.
    next.scenes.splice(Math.max(1, next.scenes.length - 1), 0, {
      type: "text",
      heading: capitalize(words(request, 7)),
      body: "",
      items: [],
      emoji: "",
      durationInSeconds: 3.5,
      animation: "slide-up",
      background: "gradient",
    });
    next.theme = pickTheme("", hash(request));
  }
  return normalizeSpec(next);
}
