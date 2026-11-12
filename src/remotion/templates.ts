/**
 * Design templates. Each one is a small design system that every scene reads:
 * colours, fonts, how photos are framed, how captions / tags / price cards look,
 * the opening animation and the signature transition. The AI picks one per
 * video (or the user switches it on the project page), and a per-video seed adds
 * variation inside the template (zoom direction, tilt, caption position).
 */

export const TEMPLATE_IDS = ["calling", "cinematic", "journal", "neon", "flash"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type Template = {
  id: TemplateId;
  label: string;
  /** Shown to the AI so it can pick a template that fits the request. */
  mood: string;
  light: boolean;
  colors: {
    bg: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
    muted: string;
    cardBg: string;
    cardText: string;
    price: string;
    /** rgb triplet used to shade photos, e.g. "0,0,0" */
    shade: string;
  };
  fonts: { display: "fun" | "serif" | "hand" | "bebas" | "impact"; headline: "body" | "serif" | "hand" | "bebas" | "impact" };
  photo: "fullbleed" | "letterbox" | "polaroid" | "neon" | "split";
  caption: "twoTone" | "elegant" | "handwritten" | "neon" | "blocky";
  tag: "pill" | "rule" | "stamp" | "outline" | "block";
  card: "white" | "glass" | "ticket" | "neon" | "tag";
  hook: "pop" | "curtain" | "stamp" | "flicker" | "slam";
  signature: "orange-wipe" | "dip" | "slide" | "flash" | "wipe";
  mascot: boolean;
  captionPlacement: "bottom" | "top" | "alternate";
};

export const TEMPLATES: Record<TemplateId, Template> = {
  calling: {
    id: "calling",
    label: "Is Calling",
    mood: "bold orange social reel with popping text and price cards: city breaks, theme parks, families (the classic Just YM look)",
    light: false,
    colors: { bg: "#16120F", surface: "#FF914D", primary: "#FF914D", accent: "#C89116", text: "#FFFFFF", muted: "rgba(255,255,255,0.85)", cardBg: "#FFFFFF", cardText: "#16120F", price: "#F26B1D", shade: "0,0,0" },
    fonts: { display: "fun", headline: "body" },
    photo: "fullbleed",
    caption: "twoTone",
    tag: "pill",
    card: "white",
    hook: "pop",
    signature: "orange-wipe",
    mascot: true,
    captionPlacement: "bottom",
  },
  cinematic: {
    id: "cinematic",
    label: "Cinematic",
    mood: "elegant, slow, premium film look with letterbox bars, serif type and gold: luxury, landmarks, sunsets, dinner cruises, 'before you leave' stories",
    light: false,
    colors: { bg: "#0B0B0D", surface: "#141418", primary: "#E9C46A", accent: "#FF914D", text: "#F5F1E8", muted: "rgba(245,241,232,0.8)", cardBg: "rgba(18,18,22,0.72)", cardText: "#F5F1E8", price: "#E9C46A", shade: "8,8,12" },
    fonts: { display: "serif", headline: "serif" },
    photo: "letterbox",
    caption: "elegant",
    tag: "rule",
    card: "glass",
    hook: "curtain",
    signature: "dip",
    mascot: false,
    captionPlacement: "bottom",
  },
  journal: {
    id: "journal",
    label: "Travel Journal",
    mood: "warm handmade scrapbook on cream paper with tilted polaroid photos, handwriting and ticket stubs: nature, culture, slow travel, couples, first trips",
    light: true,
    colors: { bg: "#F6EEDF", surface: "#FFFDF7", primary: "#FF914D", accent: "#2F6F62", text: "#2B2118", muted: "rgba(43,33,24,0.75)", cardBg: "#FFFDF7", cardText: "#2B2118", price: "#E0602A", shade: "43,33,24" },
    fonts: { display: "hand", headline: "hand" },
    photo: "polaroid",
    caption: "handwritten",
    tag: "stamp",
    card: "ticket",
    hook: "stamp",
    signature: "slide",
    mascot: true,
    captionPlacement: "bottom",
  },
  neon: {
    id: "neon",
    label: "Neon Night",
    mood: "dark, high-energy nightlife look with glowing neon type and flash cuts: night markets, rooftop bars, shows, festivals, after-dark city",
    light: false,
    colors: { bg: "#07040F", surface: "#120A24", primary: "#FF3EA5", accent: "#22E4FF", text: "#FFFFFF", muted: "rgba(255,255,255,0.82)", cardBg: "rgba(12,7,28,0.82)", cardText: "#FFFFFF", price: "#22E4FF", shade: "10,4,30" },
    fonts: { display: "bebas", headline: "bebas" },
    photo: "neon",
    caption: "neon",
    tag: "outline",
    card: "neon",
    hook: "flicker",
    signature: "flash",
    mascot: false,
    captionPlacement: "alternate",
  },
  flash: {
    id: "flash",
    label: "Flash Sale",
    mood: "loud yellow-and-black sale poster with split-screen photos, slam-in type and big price tags: discounts, deals roundups, limited-time offers",
    light: true,
    colors: { bg: "#FFC83D", surface: "#111111", primary: "#111111", accent: "#FF914D", text: "#111111", muted: "rgba(17,17,17,0.8)", cardBg: "#FFFFFF", cardText: "#111111", price: "#E8352B", shade: "0,0,0" },
    fonts: { display: "impact", headline: "impact" },
    photo: "split",
    caption: "blocky",
    tag: "block",
    card: "tag",
    hook: "slam",
    signature: "wipe",
    mascot: true,
    captionPlacement: "bottom",
  },
};

export const getTemplate = (id: string | undefined): Template => TEMPLATES[(id as TemplateId) ?? "calling"] ?? TEMPLATES.calling;

/** Deterministic pseudo-random number in [0, 1) for (seed, slot). */
export function rand(seed: number, slot: number) {
  let x = (seed ^ Math.imul(slot + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
