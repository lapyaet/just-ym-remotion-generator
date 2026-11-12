import "server-only";

/**
 * Catalog of Just YM products and photos, crawled from https://www.justym.me/en
 * (only pages listed in the sitemap and allowed by robots.txt):
 *  - ticket pages -> product: name, city, photo, live price (schema.org JSON-LD)
 *  - other pages  -> photos that have alt text (no price)
 * Cached in memory for a few hours per server instance.
 */

export type CatalogItem = {
  kind: "product" | "photo";
  name: string;
  city: string;
  imageUrl: string;
  pageUrl: string;
  /** Formatted live price, e.g. "฿1,000" (products only). */
  priceText: string;
};

const SITE = "https://www.justym.me";
const LOCALE_PREFIX = "/en";
const MAX_PAGES = 150;
const CONCURRENCY = 8;
const CACHE_MS = 6 * 60 * 60 * 1000;
const USER_AGENT = "JustYM-Video-Generator/1.0 (+catalog)";
// Mirrors https://www.justym.me/robots.txt
const DISALLOWED = [/^\/api\//, /^\/[^/]+\/auth\//, /^\/[^/]+\/profile/, /^\/[^/]+\/cart/, /\/hotels\/[^/]+\/(booking|checkout|confirmation)/];

type CacheState = { at: number; promise: Promise<CatalogItem[]> };
const g = globalThis as unknown as { __justymCatalog?: CacheState };

export function getCatalog(): Promise<CatalogItem[]> {
  const cached = g.__justymCatalog;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;
  const promise = crawl().catch((err) => {
    console.error("Just YM catalog failed", err);
    g.__justymCatalog = undefined; // retry next time
    return [] as CatalogItem[];
  });
  g.__justymCatalog = { at: Date.now(), promise };
  return promise;
}

/** The `limit` items most relevant to `text`; matching the city counts most. */
export function pickRelevant(catalog: CatalogItem[], text: string, limit = 40): CatalogItem[] {
  const words = new Set(tokenize(text));
  return catalog
    .map((item, i) => {
      const overlap = [...new Set(tokenize(item.name))].filter((w) => words.has(w)).length;
      const city = tokenize(item.city);
      const cityBonus = city.length && city.every((w) => words.has(w)) ? 2 : 0;
      const productBonus = item.kind === "product" ? 0.5 : 0;
      return { item, i, score: overlap + cityBonus + productBonus };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.item);
}

const STOP = new Set(["the", "and", "for", "with", "tickets", "ticket", "just", "your", "from", "tour", "of", "to"]);
function tokenize(text: string) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w));
}

async function crawl(): Promise<CatalogItem[]> {
  const sitemap = await fetchText(`${SITE}/sitemap.xml`);
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((url) => {
      const path = new URL(url).pathname;
      return (path === LOCALE_PREFIX || path.startsWith(`${LOCALE_PREFIX}/`)) && !DISALLOWED.some((re) => re.test(path));
    })
    .slice(0, MAX_PAGES);
  if (!pages.includes(`${SITE}${LOCALE_PREFIX}`)) pages.unshift(`${SITE}${LOCALE_PREFIX}`);

  const results: CatalogItem[] = [];
  const queue = [...pages];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const html = await fetchText(url).catch(() => "");
        if (html) results.push(...extractItems(html, url));
      }
    }),
  );

  // De-duplicate by image; products win over plain photos.
  const byImage = new Map<string, CatalogItem>();
  for (const item of results.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "product" ? -1 : 1))) {
    if (!byImage.has(item.imageUrl)) byImage.set(item.imageUrl, item);
  }
  return [...byImage.values()];
}

function extractItems(html: string, pageUrl: string): CatalogItem[] {
  const out: CatalogItem[] = [];
  const meta = (prop: string) =>
    decode(html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, "i"))?.[1] ?? "");

  // "Gardens by the Bay Tickets, Singapore | Just YM" -> name + city
  const ogTitle = meta("og:title").replace(/\s*\|\s*Just YM\s*$/i, "").trim();
  const [titlePart, cityPart = ""] = ogTitle.split(/,\s*(?=[^,]+$)/);
  const ogImage = meta("og:image");
  const product = readProductJsonLd(html);

  if (product && /\/ticket\//.test(pageUrl)) {
    const image = (Array.isArray(product.image) ? product.image[0] : product.image) || ogImage;
    const price = Number(product.offers?.price);
    if (image) {
      out.push({
        kind: "product",
        name: product.name || titlePart.replace(/\s+Tickets?$/i, ""),
        city: cityPart,
        imageUrl: image,
        pageUrl: product.offers?.url || pageUrl,
        priceText: Number.isFinite(price) && price > 0 ? formatPrice(price, product.offers?.priceCurrency ?? "") : "",
      });
    }
  } else if (ogImage && !/og-default/.test(ogImage) && titlePart) {
    out.push({ kind: "photo", name: titlePart, city: cityPart, imageUrl: ogImage, pageUrl, priceText: "" });
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const alt = decode(tag.match(/\balt="([^"]*)"/i)?.[1] ?? "").trim();
    const src = decode(tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? "");
    if (!alt || !src || /logo|icon|footer|mascot|\.svg/i.test(src) || /^just ym/i.test(alt)) continue;
    const url = resolveImageSrc(src);
    if (url) out.push({ kind: "photo", name: alt, city: "", imageUrl: url, pageUrl, priceText: "" });
  }
  return out;
}

type ProductLd = {
  name?: string;
  image?: string | string[];
  offers?: { price?: string | number; priceCurrency?: string; url?: string };
};

/** The page embeds schema.org Product JSON-LD inside an escaped RSC payload. */
function readProductJsonLd(html: string): ProductLd | null {
  const at = html.indexOf("@context");
  if (at === -1 || !html.includes("Product")) return null;
  let seg = html.slice(html.lastIndexOf("{", at), at + 20_000);
  for (let level = 0; level < 5; level++) {
    const obj = balancedObject(seg);
    if (obj) {
      try {
        const data = JSON.parse(obj);
        if (data["@type"] === "Product") return data;
      } catch {}
    }
    seg = seg.replace(/\\(["\\/])/g, "$1"); // remove one level of string escaping
  }
  return null;
}

function balancedObject(s: string) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return s.slice(0, i + 1);
  }
  return null;
}

const CURRENCY: Record<string, (n: string) => string> = {
  THB: (n) => `฿${n}`,
  SGD: (n) => `S$${n}`,
  MYR: (n) => `RM${n}`,
  USD: (n) => `$${n}`,
  VND: (n) => `${n}₫`,
  MMK: (n) => `${n} Ks`,
};
function formatPrice(price: number, currency: string) {
  const n = price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (CURRENCY[currency.toUpperCase()] ?? ((x: string) => `${currency} ${x}`.trim()))(n);
}

/** Turn `/_next/image?url=%2F_next%2F...jpg&w=..` into the original asset URL. */
function resolveImageSrc(src: string): string | null {
  try {
    const u = new URL(src, SITE);
    const inner = u.pathname === "/_next/image" ? u.searchParams.get("url") : null;
    const final = inner ? new URL(inner, SITE) : u;
    if (!/\.(jpe?g|png|webp|avif)$/i.test(final.pathname) && !final.hostname.startsWith("api.")) return null;
    return final.toString();
  } catch {
    return null;
  }
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}
