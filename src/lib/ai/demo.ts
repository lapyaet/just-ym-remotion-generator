import "server-only";
import type { GeneratedScene, GeneratedVideo } from "@/remotion/schema";
import type { Choice } from "./resolve";

/**
 * Free "demo mode" used when no AI is configured. Builds a Just YM reel from
 * the prompt and the catalog with simple rules (English only).
 */

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(text));

function pickAspect(text: string): GeneratedVideo["aspectRatio"] | null {
  if (has(text, ["horizontal", "landscape", "youtube", "16:9", "widescreen"])) return "16:9";
  if (has(text, ["square", "1:1"])) return "1:1";
  if (has(text, ["vertical", "reel", "short", "tiktok", "story", "stories", "9:16", "portrait"])) return "9:16";
  return null;
}

const scene = (type: GeneratedScene["type"], fields: Partial<GeneratedScene>): GeneratedScene => ({
  type,
  kicker: "",
  tag: "",
  location: "",
  headline: "",
  highlight: "",
  subtitle: "",
  photoId: "",
  productIds: [],
  discount: "",
  durationInSeconds: 3,
  transition: "fade",
  ...fields,
});

export function buildDemoVideo(prompt: string, previous: GeneratedVideo | undefined, choices: Choice[]): GeneratedVideo {
  if (previous) return reviseDemo(previous, prompt);

  const products = choices.filter((c) => c.item.kind === "product");
  const photos = choices.filter((c) => c.item.kind === "photo");
  // The city most of the relevant products are in (choices are sorted by relevance).
  const cityCounts = new Map<string, number>();
  for (const p of products.slice(0, 8)) if (p.item.city) cityCounts.set(p.item.city, (cityCounts.get(p.item.city) ?? 0) + 1);
  const city = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const inCity = products.filter((p) => !city || p.item.city === city);
  const featured = inCity.slice(0, 3);
  const more = inCity.slice(3, 7).length >= 2 ? inCity.slice(3, 7) : products.slice(3, 7);
  const discount = prompt.match(/(up to\s+)?\d+\s?%\s*off/i)?.[0].toUpperCase() ?? "";
  const place = city || "your next trip";

  const scenes: GeneratedScene[] = [
    scene("hook", {
      kicker: "Hello",
      headline: (city || "Asia").toUpperCase(),
      subtitle: "Your trip starts here",
      photoId: photos[0]?.id ?? featured[0]?.id ?? "",
      durationInSeconds: 3,
    }),
    ...featured.map((p, i) =>
      scene("attraction", {
        tag: p.item.name.toUpperCase(),
        location: city ? `@${city.toUpperCase()}` : "",
        headline: i === 0 ? `The famous` : i === 1 ? "Don't miss" : "Also on Just YM",
        highlight: p.item.name,
        subtitle: "Instant confirmation on Just YM",
        photoId: p.id,
        productIds: [p.id],
        durationInSeconds: 3.5,
        transition: i === featured.length - 1 ? "signature" : "fade",
      }),
    ),
    scene("caption", {
      headline: "WORTH IT!",
      highlight: `in ${place}`,
      photoId: photos[1]?.id ?? inCity[featured.length]?.id ?? "",
      durationInSeconds: 2,
      transition: "cut",
    }),
  ];
  if (more.length >= 2) {
    scenes.push(
      scene("deals", {
        headline: "More deals in",
        highlight: place,
        subtitle: "Book before you fly",
        productIds: more.map((p) => p.id),
        photoId: more[0].id,
        discount,
        durationInSeconds: 4,
        transition: "signature",
      }),
    );
  }
  if (inCity.length >= 3) {
    scenes.push(
      scene("app", {
        tag: city || "Bangkok",
        headline: `Find ${place} tickets`,
        highlight: "on Just YM",
        productIds: inCity.slice(0, 5).map((p) => p.id),
        discount,
        durationInSeconds: 5,
        transition: "fade",
      }),
    );
  }
  scenes.push(
    scene("payment", {
      headline: "No need to exchange baht",
      highlight: "Pay with Myanmar wallets",
      subtitle: "KBZPay · AYA Pay · Wave · MMQR",
      durationInSeconds: 3.5,
    }),
    scene("outro", {
      headline: "Your Moment.",
      highlight: "Discounts on tickets in one place",
      photoId: photos[2]?.id ?? "",
      durationInSeconds: 3.5,
      transition: "cut",
    }),
  );

  const music = has(prompt, ["beach", "island", "chill", "relax", "sunset", "nature", "phuket", "krabi", "samui"])
    ? "tropical-chill"
    : has(prompt, ["festival", "party", "night", "concert", "theme park", "hype", "sale"])
      ? "festival-hype"
      : "sunny-pop";
  const template: GeneratedVideo["template"] = has(prompt, ["sale", "deal", "discount", "% off", "promo", "offer"])
    ? "flash"
    : has(prompt, ["night", "bar", "rooftop", "party", "festival", "concert", "show"])
      ? "neon"
      : has(prompt, ["luxury", "sunset", "cruise", "before you leave", "elegant", "premium"])
        ? "cinematic"
        : has(prompt, ["nature", "temple", "culture", "journal", "couple", "honeymoon", "slow", "chiang mai"])
          ? "journal"
          : (["calling", "cinematic", "journal", "neon", "flash"] as const)[Math.floor(Math.random() * 5)];
  return {
    title: city ? `${city} is Calling` : prompt.split(/[.,:!?\n]/)[0].slice(0, 40) || "Just YM reel",
    aspectRatio: pickAspect(prompt) ?? "9:16",
    template,
    music,
    scenes,
  };
}

/** Demo revisions understand formats ("vertical") and pacing ("faster"/"slower"). */
function reviseDemo(video: GeneratedVideo, request: string): GeneratedVideo {
  const next = structuredClone(video);
  const aspect = pickAspect(request);
  if (aspect) next.aspectRatio = aspect;
  if (has(request, ["faster", "shorter", "quick"])) next.scenes.forEach((s) => (s.durationInSeconds = Math.max(1.5, s.durationInSeconds * 0.75)));
  if (has(request, ["slower", "longer"])) next.scenes.forEach((s) => (s.durationInSeconds *= 1.3));
  return next;
}
