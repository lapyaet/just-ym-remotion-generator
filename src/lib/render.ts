import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { prisma } from "./prisma";
import { COMPOSITION_ID, type VideoSpec } from "@/remotion/schema";

export const RENDER_DIR = path.join(process.cwd(), "storage", "renders");
const ENTRY_POINT = path.join(process.cwd(), "src", "remotion", "index.ts");

type RenderGlobals = { bundlePromise?: Promise<string>; queue?: Promise<unknown> };
const g = globalThis as unknown as { __remotion?: RenderGlobals };
const state: RenderGlobals = (g.__remotion ??= {});

/** Bundle the Remotion project once per server process and reuse it. */
function getServeUrl() {
  state.bundlePromise ??= bundle({ entryPoint: ENTRY_POINT }).catch((err) => {
    state.bundlePromise = undefined; // allow a retry on the next render
    throw err;
  });
  return state.bundlePromise;
}

/**
 * Queue a render. Renders run one at a time because each one already uses
 * every CPU core.
 */
export function enqueueRender(renderId: string, spec: VideoSpec) {
  const run = () => runRender(renderId, spec);
  state.queue = (state.queue ?? Promise.resolve()).then(run, run);
  return state.queue;
}

async function runRender(renderId: string, spec: VideoSpec) {
  try {
    await prisma.render.update({ where: { id: renderId }, data: { status: "rendering", progress: 0 } });
    await fs.mkdir(RENDER_DIR, { recursive: true });

    const serveUrl = await getServeUrl();
    const inputProps = { spec };
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
    const outputLocation = path.join(RENDER_DIR, `${renderId}.mp4`);

    let lastWrite = 0;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      onProgress: ({ progress }) => {
        const now = Date.now();
        if (now - lastWrite < 1000) return; // throttle DB writes
        lastWrite = now;
        prisma.render.update({ where: { id: renderId }, data: { progress } }).catch(() => {});
      },
    });

    await prisma.render.update({
      where: { id: renderId },
      data: { status: "done", progress: 1, outputPath: outputLocation },
    });
  } catch (err) {
    console.error(`Render ${renderId} failed`, err);
    await prisma.render
      .update({
        where: { id: renderId },
        data: { status: "error", error: err instanceof Error ? err.message.slice(0, 1000) : "Render failed" },
      })
      .catch(() => {});
  }
}
