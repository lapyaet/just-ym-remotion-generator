import "server-only";
import { pickRelevant, type CatalogItem } from "@/lib/justym-catalog";
import {
  normalizeSpec,
  type GeneratedVideo,
  type Product,
  type VideoSpec,
} from "@/remotion/schema";
import { musicFile, MUSIC_TRACKS } from "@/remotion/music";

/** A catalog item with the short id the AI uses to reference it ("p3"). */
export type Choice = { id: string; item: CatalogItem };

/**
 * The numbered list of products/photos offered to the AI: the most relevant
 * catalog items, plus anything the previous version already uses.
 */
export function buildChoices(catalog: CatalogItem[], context: string, previous?: VideoSpec, limit = 40): Choice[] {
  const items = pickRelevant(catalog, context, limit);
  for (const scene of previous?.scenes ?? []) {
    for (const p of scene.products) {
      if (!items.some((i) => i.pageUrl === p.pageUrl)) items.push({ kind: "product", ...p });
    }
    if (scene.imageUrl && !items.some((i) => i.imageUrl === scene.imageUrl)) {
      items.push({ kind: "photo", name: scene.tag || scene.headline || "photo", city: "", imageUrl: scene.imageUrl, pageUrl: "", priceText: "" });
    }
  }
  return items.map((item, i) => ({ id: `p${i + 1}`, item }));
}

export function describeChoices(choices: Choice[]) {
  return choices
    .map(({ id, item }) =>
      item.kind === "product"
        ? `${id} | product | ${item.name} | ${item.city || "-"} | ${item.priceText ? `from ${item.priceText}` : "price on site"}`
        : `${id} | photo only | ${item.name}`,
    )
    .join("\n");
}

const toProduct = (item: CatalogItem): Product => ({
  name: item.name,
  city: item.city,
  imageUrl: item.imageUrl,
  priceText: item.priceText,
  pageUrl: item.pageUrl,
});

/** AI output (ids) -> renderable spec (real URLs, live prices). */
export function resolveGenerated(
  gen: GeneratedVideo,
  choices: Choice[],
  userText: string,
  previous?: VideoSpec,
): VideoSpec {
  const byId = new Map(choices.map((c) => [c.id.toLowerCase(), c.item]));
  const lookup = (id: string) => byId.get(id.trim().toLowerCase());
  const allowedDiscounts = `${userText} ${previous?.scenes.map((s) => s.discount).join(" ") ?? ""}`;

  const scenes = gen.scenes.map((s) => {
    const products = s.productIds
      .map(lookup)
      .filter((i): i is CatalogItem => i?.kind === "product")
      .map(toProduct);
    const photo = lookup(s.photoId);
    // Attractions fall back to their product's photo.
    const imageUrl = photo?.imageUrl ?? (s.type === "attraction" ? products[0]?.imageUrl ?? "" : "");
    const { photoId: _p, productIds: _ids, ...rest } = s;
    void _p;
    void _ids;
    return { ...rest, discount: discountIsStated(s.discount, allowedDiscounts) ? s.discount : "", imageUrl, products };
  });

  // The opening scene should never be photo-less: borrow the first photo in the reel.
  const firstPhoto = scenes.find((s) => s.imageUrl)?.imageUrl ?? "";
  for (const s of scenes) if (s.type === "hook" && !s.imageUrl) s.imageUrl = firstPhoto;

  const hasPrices = scenes.some((s) => s.products.some((p) => p.priceText));
  const month = new Date().toLocaleString("en-US", { month: "short", year: "numeric" });
  return normalizeSpec({
    version: 2,
    template: gen.template,
    // A fresh seed every generation, so even the same template looks different.
    seed: Math.floor(Math.random() * 2 ** 31),
    sfx: true,
    title: gen.title,
    aspectRatio: gen.aspectRatio,
    priceNote: hasPrices ? `*Prices shown on justym.me, ${month}. Subject to change.` : "",
    // VIDEO_MUSIC (a file in public/music) overrides the AI's choice for every video.
    music: process.env.VIDEO_MUSIC?.trim() || (gen.music === "none" ? "" : musicFile(gen.music)),
    scenes,
  });
}

/** Renderable spec -> AI format, so the AI can revise an existing video. */
export function toGenerated(spec: VideoSpec, choices: Choice[]): GeneratedVideo {
  const idForImage = (url: string) => choices.find((c) => c.item.imageUrl === url)?.id ?? "";
  const idForProduct = (p: Product) => choices.find((c) => c.item.pageUrl === p.pageUrl)?.id ?? "";
  return {
    title: spec.title,
    aspectRatio: spec.aspectRatio,
    template: spec.template,
    music: MUSIC_TRACKS.find((t) => t.file === spec.music)?.id ?? (spec.music ? MUSIC_TRACKS[0].id : "none"),
    scenes: spec.scenes.map(({ imageUrl, products, ...rest }) => ({
      ...rest,
      photoId: imageUrl ? idForImage(imageUrl) : "",
      productIds: products.map(idForProduct).filter(Boolean),
    })),
  };
}

/** A discount may only appear if every number in it was stated by the user. */
function discountIsStated(discount: string, userText: string) {
  const numbers = discount.match(/\d+/g);
  if (!discount.trim() || !numbers) return false;
  const stated = new Set(userText.match(/\d+/g) ?? []);
  return numbers.every((n) => stated.has(n));
}
