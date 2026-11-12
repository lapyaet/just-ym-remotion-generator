import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { VideoSpec } from "@/remotion/schema";

/**
 * Download every remote photo in the spec into the Remotion bundle's public
 * folder and point the spec at the local copies. Rendering then needs no
 * network, so a slow image server can't time out a render.
 * Images that fail to download keep their original URL.
 */
export async function localizeImages(spec: VideoSpec, serveUrl: string): Promise<VideoSpec> {
  const urls = new Set<string>();
  for (const s of spec.scenes) {
    if (s.imageUrl) urls.add(s.imageUrl);
    for (const p of s.products) if (p.imageUrl) urls.add(p.imageUrl);
  }

  const dir = path.join(serveUrl, "public", "remote-cache");
  await fs.mkdir(dir, { recursive: true });
  const local = new Map<string, string>();

  await Promise.all(
    [...urls].map(async (url) => {
      const name = crypto.createHash("sha1").update(url).digest("hex");
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const existing = await findCached(dir, name);
          if (existing) return void local.set(url, `/public/remote-cache/${existing}`);
          const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
          if (!res.ok) throw new Error(`${res.status}`);
          const ext = extensionFor(res.headers.get("content-type"), url);
          await fs.writeFile(path.join(dir, `${name}${ext}`), Buffer.from(await res.arrayBuffer()));
          return void local.set(url, `/public/remote-cache/${name}${ext}`);
        } catch (err) {
          if (attempt === 2) console.warn(`Could not cache ${url} for rendering: ${(err as Error).message}`);
        }
      }
    }),
  );

  const swap = (u: string) => local.get(u) ?? u;
  return {
    ...spec,
    scenes: spec.scenes.map((s) => ({
      ...s,
      imageUrl: swap(s.imageUrl),
      products: s.products.map((p) => ({ ...p, imageUrl: swap(p.imageUrl) })),
    })),
  };
}

async function findCached(dir: string, name: string) {
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  return files.find((f) => f.startsWith(`${name}.`));
}

function extensionFor(contentType: string | null, url: string) {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("avif")) return ".avif";
  if (type.includes("gif")) return ".gif";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  return path.extname(new URL(url).pathname) || ".jpg";
}
