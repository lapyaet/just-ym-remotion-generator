import "server-only";
import { prisma } from "@/lib/prisma";
import { MUSIC_TRACKS } from "@/remotion/music";
import type { GeneratedScene, VideoSpec } from "@/remotion/schema";
import { TEMPLATE_IDS, type TemplateId } from "@/remotion/templates";

/**
 * Guaranteed variety. Instead of hoping the AI picks something different, the
 * app decides each new video's template and scene structure up front: it fits
 * the trip's mood, avoids what this user's recent videos used, and adds
 * randomness. The AI then writes the copy for that design.
 */

type SceneType = GeneratedScene["type"];

export const BLUEPRINTS: { id: string; label: string; scenes: SceneType[]; fits: TemplateId[] }[] = [
  { id: "highlights", label: "Highlights tour", scenes: ["hook", "attraction", "attraction", "attraction", "caption", "outro"], fits: ["cinematic", "journal", "neon", "calling"] },
  { id: "deals-first", label: "Deals first", scenes: ["hook", "deals", "attraction", "app", "payment", "outro"], fits: ["flash", "calling"] },
  { id: "phone-showcase", label: "Phone showcase", scenes: ["hook", "app", "attraction", "attraction", "deals", "outro"], fits: ["calling", "neon", "flash"] },
  { id: "story", label: "Story", scenes: ["hook", "caption", "attraction", "attraction", "caption", "outro"], fits: ["cinematic", "journal"] },
  { id: "countdown", label: "Top 4 countdown", scenes: ["hook", "attraction", "attraction", "attraction", "attraction", "outro"], fits: ["flash", "neon", "calling"] },
  { id: "classic", label: "Classic Just YM", scenes: ["hook", "attraction", "attraction", "caption", "app", "payment", "outro"], fits: ["calling", "flash"] },
  { id: "quick-tour", label: "Quick tour", scenes: ["hook", "attraction", "caption", "attraction", "app", "outro"], fits: ["neon", "calling", "journal"] },
  { id: "problem-solution", label: "Problem → solution", scenes: ["hook", "caption", "app", "payment", "attraction", "outro"], fits: ["calling", "flash", "neon"] },
  { id: "spotlight", label: "Spotlight", scenes: ["hook", "attraction", "caption", "deals", "outro"], fits: ["cinematic", "neon", "journal"] },
];

export type UserHistory = { templates: string[]; shapes: string[]; music: string[] };

/** Template / structure / music of the user's most recent videos (newest first). */
export async function getUserHistory(userId: string | undefined): Promise<UserHistory> {
  const empty = { templates: [], shapes: [], music: [] };
  if (!userId) return empty;
  try {
    const rows = await prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 4, select: { spec: true } });
    const specs = rows.map((r) => JSON.parse(r.spec) as Partial<VideoSpec>);
    return {
      templates: specs.map((s) => s.template ?? "calling"),
      shapes: specs.map((s) => shapeOf((s.scenes ?? []).map((x) => x.type))),
      music: specs.map((s) => s.music ?? ""),
    };
  } catch {
    return empty;
  }
}

const shapeOf = (types: string[]) => types.join(">");

/** "neon style", "cinematic template", "design: flash sale" → that template. */
export function explicitTemplate(text: string): TemplateId | null {
  const names: [RegExp, TemplateId][] = [
    [/is\s*calling/, "calling"],
    [/cinematic|film/, "cinematic"],
    [/travel\s*journal|journal|scrapbook|polaroid/, "journal"],
    [/neon(\s*night)?/, "neon"],
    [/flash\s*sale|sale\s*poster/, "flash"],
  ];
  const lower = text.toLowerCase();
  for (const [name, id] of names) {
    const re = new RegExp(`(${name.source})\\s*(template|style|design|look|theme)|(template|style|design|look|theme)\\s*[:=]?\\s*(${name.source})`);
    if (re.test(lower)) return id;
  }
  return null;
}

/** Templates ordered by how well they fit the request's mood. */
export function moodTemplates(text: string): TemplateId[] {
  const t = text.toLowerCase();
  const score = (words: string[]) => words.filter((w) => t.includes(w)).length;
  const scores: Record<TemplateId, number> = {
    flash: score(["sale", "deal", "discount", "% off", "promo", "offer", "cheap", "save", "limited"]),
    neon: score(["night", "bar", "rooftop", "party", "festival", "concert", "show", "club", "after dark", "nightlife", "market"]),
    cinematic: score(["luxury", "sunset", "cruise", "before you leave", "elegant", "premium", "landmark", "skyline", "honeymoon"]),
    journal: score(["nature", "temple", "culture", "couple", "slow", "peaceful", "journey", "vlog", "diary", "elephant", "mountain", "chiang mai"]),
    calling: score(["family", "kids", "theme park", "calling", "fun", "weekend", "city"]),
  };
  return [...TEMPLATE_IDS].sort((a, b) => scores[b] - scores[a]);
}

/** Pick a template that fits the mood but differs from the user's last two videos. */
export function chooseTemplate(text: string, history: UserHistory): TemplateId {
  const explicit = explicitTemplate(text);
  if (explicit) return explicit;
  const recent = new Set(history.templates.slice(0, 2));
  const ranked = moodTemplates(text).filter((id) => !recent.has(id));
  const pool = ranked.length ? ranked : [...TEMPLATE_IDS];
  // Mostly the best fit, sometimes the second, occasionally anything new.
  const r = Math.random();
  if (r < 0.55 || pool.length === 1) return pool[0];
  if (r < 0.85 || pool.length === 2) return pool[1];
  return pool[2 + Math.floor(Math.random() * (pool.length - 2))];
}

/** Does the request bring its own scene order (a script with timestamps / numbered scenes)? */
export function hasOwnStructure(text: string) {
  return /\b\d{1,2}:\d{2}\b/.test(text) || /\b(scene|shot|part)\s*\d+/i.test(text) || (text.match(/^\s*\d+[.)]\s+/gm)?.length ?? 0) >= 3;
}

/** Pick a structure that suits the template and wasn't used by the user's recent videos. */
export function chooseBlueprint(template: TemplateId, history: UserHistory) {
  const recent = new Set(history.shapes.slice(0, 3));
  const fresh = BLUEPRINTS.filter((b) => !recent.has(shapeOf(b.scenes)));
  const pool = fresh.length ? fresh : BLUEPRINTS;
  const fitting = pool.filter((b) => b.fits.includes(template));
  const choices = fitting.length && Math.random() < 0.8 ? fitting : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Rearrange the AI's scenes into the blueprint's order. Each slot takes the
 * next AI scene of that type; slots the AI didn't write are skipped, and extra
 * attractions are kept (before the outro) so no content is lost.
 */
export function applyBlueprint(scenes: GeneratedScene[], blueprint: SceneType[]): GeneratedScene[] {
  const pool = [...scenes];
  const take = (type: SceneType) => {
    const i = pool.findIndex((s) => s.type === type);
    return i === -1 ? null : pool.splice(i, 1)[0];
  };
  const ordered = blueprint.map(take).filter((s): s is GeneratedScene => s !== null);
  const extraAttractions = pool.filter((s) => s.type === "attraction");
  const outroIndex = ordered.findIndex((s) => s.type === "outro");
  if (extraAttractions.length) ordered.splice(outroIndex === -1 ? ordered.length : outroIndex, 0, ...extraAttractions.slice(0, 2));
  if (!ordered.some((s) => s.type === "hook") && scenes[0]) ordered.unshift(scenes[0]);
  return ordered.length >= 3 ? ordered.slice(0, 10) : scenes;
}

/** Avoid repeating the previous video's track (keeps the mood if it can). */
export function varyMusic(file: string, history: UserHistory): string {
  if (!file || file !== history.music[0] || process.env.VIDEO_MUSIC) return file;
  const others = MUSIC_TRACKS.filter((t) => t.file !== file);
  return others[Math.floor(Math.random() * others.length)]?.file ?? file;
}
