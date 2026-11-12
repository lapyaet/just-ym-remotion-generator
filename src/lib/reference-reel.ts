import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { ALL_FORMATS, Input, UrlSource } from "mediabunny";

/**
 * "Make it like this reel": read what we can about a reference reel link so a
 * text-only AI can match its style.
 *  - page details: title / caption / creator (oEmbed for YouTube, TikTok, Vimeo;
 *    Open Graph tags for Instagram, Facebook, Google Drive and other pages)
 *  - video details when the file is reachable (Google Drive, direct video links,
 *    og:video): length, size/aspect ratio, frame rate, whether it has sound
 * Every request goes through `safeFetch`, which only allows public internet hosts.
 */

export type ReelReference = {
  url: string;
  platform: string;
  title: string;
  author: string;
  description: string;
  video: { durationSec: number; width: number; height: number; fps: number | null; hasAudio: boolean } | null;
  notes: string[];
};

const USER_AGENT = "Mozilla/5.0 (compatible; JustYM-Video-Generator/1.0; +https://www.justym.me)";
const MAX_HTML_BYTES = 1_500_000;
const PROBE_TIMEOUT_MS = 25_000;

export async function analyzeReferenceReel(rawUrl: string): Promise<ReelReference> {
  const url = normalizeUrl(rawUrl);
  const ref: ReelReference = { url: url.toString(), platform: platformOf(url), title: "", author: "", description: "", video: null, notes: [] };

  try {
    await readPageDetails(url, ref);
  } catch (err) {
    ref.notes.push(`Could not read the page details (${(err as Error).message}).`);
  }

  const videoUrl = await findVideoFile(url, ref).catch(() => null);
  if (videoUrl) {
    try {
      ref.video = await probeVideo(videoUrl);
    } catch (err) {
      ref.notes.push(`Could not read the video file (${(err as Error).message}).`);
    }
  }
  if (!ref.video && !ref.title && !ref.description) {
    ref.notes.push("Nothing could be read from this link (it may be private or require a login).");
  }
  return ref;
}

/** The block of text added to the AI request. */
export function describeReference(ref: ReelReference): string {
  const lines = [`Reference reel to take style from: ${ref.url}`, `- Platform: ${ref.platform}`];
  if (ref.title) lines.push(`- Title: ${ref.title}`);
  if (ref.author) lines.push(`- Creator: ${ref.author}`);
  if (ref.description) lines.push(`- Caption / description: ${ref.description}`);
  if (ref.video) {
    const v = ref.video;
    lines.push(
      `- Video: ${v.durationSec.toFixed(1)} s, ${v.width}×${v.height} (${aspectLabel(v.width, v.height)})` +
        `${v.fps ? `, ${Math.round(v.fps)} fps` : ""}, ${v.hasAudio ? "with sound/music" : "no sound"}`,
    );
  }
  for (const n of ref.notes) lines.push(`- Note: ${n}`);
  lines.push(
    "Make the new reel feel like this reference: " +
      [
        ref.video ? `a similar total length (about ${Math.round(ref.video.durationSec)} seconds) and the same format (${aspectLabel(ref.video.width, ref.video.height)})` : "",
        "a similar pace, tone and energy",
        "a similar structure if the title or caption reveals it",
      ]
        .filter(Boolean)
        .join(", ") +
      ". Use the title and caption only as inspiration and do not copy them word for word. Still use only the Just YM products and photos from the list.",
  );
  return lines.join("\n");
}

/** One-line summary for the project list, e.g. "ref: drive.google.com · 23s 9:16". */
export function summarizeReference(ref: ReelReference) {
  const host = new URL(ref.url).hostname.replace(/^www\./, "");
  const video = ref.video ? ` · ${Math.round(ref.video.durationSec)}s ${aspectLabel(ref.video.width, ref.video.height).split(" ")[0]}` : "";
  return `ref: ${ref.title ? `${ref.title.slice(0, 40)} (${host})` : host}${video}`;
}

// ---------------------------------------------------------------------------

function normalizeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new ReferenceLinkError("That reference link isn't a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ReferenceLinkError("Only http(s) links are supported.");
  return url;
}

export class ReferenceLinkError extends Error {}

function platformOf(url: URL) {
  const h = url.hostname.replace(/^www\.|^m\./, "");
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return url.pathname.startsWith("/shorts/") ? "YouTube Shorts (vertical)" : "YouTube";
  if (/(^|\.)tiktok\.com$/.test(h)) return "TikTok (vertical)";
  if (/(^|\.)instagram\.com$/.test(h)) return url.pathname.startsWith("/reel") ? "Instagram Reel (vertical)" : "Instagram";
  if (/(^|\.)facebook\.com$|^fb\.watch$/.test(h)) return "Facebook";
  if (/(^|\.)vimeo\.com$/.test(h)) return "Vimeo";
  if (/^drive\.google\.com$/.test(h) && url.pathname.includes("/folders/")) return "Google Drive folder";
  if (/^drive\.google\.com$|^drive\.usercontent\.google\.com$/.test(h)) return "Google Drive video";
  return h;
}

const OEMBED: { test: RegExp; endpoint: string }[] = [
  { test: /(^|\.)youtube\.com$|^youtu\.be$/, endpoint: "https://www.youtube.com/oembed?format=json&url=" },
  { test: /(^|\.)tiktok\.com$/, endpoint: "https://www.tiktok.com/oembed?url=" },
  { test: /(^|\.)vimeo\.com$/, endpoint: "https://vimeo.com/api/oembed.json?url=" },
];

async function readPageDetails(url: URL, ref: ReelReference) {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const oembed = OEMBED.find((o) => o.test.test(host));
  if (oembed) {
    const res = await safeFetch(oembed.endpoint + encodeURIComponent(url.toString()));
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string; description?: string; duration?: number; width?: number; height?: number };
      ref.title = clean(data.title);
      ref.author = clean(data.author_name);
      ref.description = clean(data.description);
      if (data.duration && data.width && data.height) {
        ref.video = { durationSec: data.duration, width: data.width, height: data.height, fps: null, hasAudio: true };
      }
      if (ref.title) return;
    }
  }

  const res = await safeFetch(url.toString());
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) {
    await res.body?.cancel();
    return;
  }
  const html = await readLimited(res, MAX_HTML_BYTES);
  const meta = (name: string) =>
    decode(
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ??
        html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"))?.[1] ??
        "",
    );
  ref.title ||= prettyTitle(clean(meta("og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "")));
  ref.description ||= clean(meta("og:description") || meta("description"));
  // Ignore generic site names ("Google Drive", "Google Docs").
  const author = clean(meta("author") || meta("og:site_name"));
  if (!/^google( |$)/i.test(author)) ref.author ||= author;
}

/** Where the actual video file can be read, if anywhere. */
async function findVideoFile(url: URL, ref: ReelReference): Promise<string | null> {
  if (ref.video) return null; // already known (e.g. Vimeo oEmbed)
  // Google Drive: /file/d/<id>/view or ?id=<id>
  if (/drive\.google\.com$/.test(url.hostname)) {
    const id = url.pathname.match(/\/file\/d\/([\w-]{10,})/)?.[1] ?? url.searchParams.get("id");
    return id ? `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` : null;
  }
  if (/drive\.usercontent\.google\.com$/.test(url.hostname)) return url.toString();
  if (/\.(mp4|mov|m4v|webm|mkv)$/i.test(url.pathname)) return url.toString();
  // Social platforms don't serve their video files publicly.
  if (/(^|\.)(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch)$/.test(url.hostname)) return null;
  // Other pages may advertise a direct video file.
  const res = await safeFetch(url.toString());
  const type = res.headers.get("content-type") ?? "";
  if (type.startsWith("video/")) {
    await res.body?.cancel();
    return url.toString();
  }
  if (!type.includes("html")) return null;
  const html = await readLimited(res, MAX_HTML_BYTES);
  // Only real video files: platform og:video tags (YouTube, TikTok, ...) point at embed pages.
  const og = decode(html.match(/<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "");
  return /^https?:\/\/.+\.(mp4|mov|m4v|webm)(\?|$)/i.test(og) ? og : null;
}

async function probeVideo(videoUrl: string) {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(videoUrl, {
      fetchFn: ((resource: RequestInfo | URL, init?: RequestInit) => safeFetch(resource.toString(), init)) as typeof fetch,
      getRetryDelay: (attempts) => (attempts < 2 ? 1 : null),
      maxCacheSize: 16 * 1024 * 1024,
    }),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = (async () => {
      const video = await input.getPrimaryVideoTrack();
      if (!video) throw new Error("no video track");
      const [durationSec, audio, stats] = await Promise.all([
        input.computeDuration(),
        input.getPrimaryAudioTrack(),
        video.computePacketStats(120).catch(() => null),
      ]);
      return { durationSec, width: video.displayWidth, height: video.displayHeight, fps: stats?.averagePacketRate ?? null, hasAudio: Boolean(audio) };
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), PROBE_TIMEOUT_MS);
    });
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    input.dispose();
  }
}

// ---------- SSRF-safe fetch: public hosts only, manual redirects ----------

export async function safeFetch(rawUrl: string, init: RequestInit = {}, redirects = 3): Promise<Response> {
  const url = new URL(rawUrl);
  await assertPublicHost(url);
  const res = await fetch(url, {
    ...init,
    redirect: "manual",
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en", ...(init.headers as Record<string, string> | undefined) },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
    if (redirects <= 0) throw new Error("too many redirects");
    await res.body?.cancel();
    return safeFetch(new URL(res.headers.get("location")!, url).toString(), init, redirects - 1);
  }
  return res;
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("blocked protocol");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("blocked port");
  if (url.username || url.password) throw new Error("credentials in URL are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new Error("blocked host");
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("blocked host");
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v);
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

// ---------- helpers ----------

async function readLimited(res: Response, maxBytes: number) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

function aspectLabel(w: number, h: number) {
  const r = w / h;
  if (r < 0.7) return "9:16 vertical";
  if (r > 1.4) return "16:9 horizontal";
  return "1:1 square";
}

/** "Bangkok_is_Calling_updated_prices.mp4 - Google Drive" -> "Bangkok is Calling updated prices" */
function prettyTitle(title: string) {
  return title
    .replace(/\s+-\s+Google\s+\S+$/i, "")
    .replace(/\.(mp4|mov|m4v|webm|mkv)$/i, "")
    .replace(/[_]+/g, " ")
    .trim();
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 500);

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
