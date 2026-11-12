"use client";

import { useRef, useState } from "react";
import { GeneratedVideo } from "@/remotion/GeneratedVideo";
import { COMPOSITION_ID, DIMENSIONS, FPS, totalFrames, type VideoSpec } from "@/remotion/schema";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "rendering"; progress: number; startedAt: number }
  | { kind: "done"; url: string; sizeMb: number; seconds: number }
  | { kind: "error"; message: string };

/**
 * Renders the MP4 in the viewer's own browser (WebCodecs) and downloads it.
 * Works anywhere the page works, including Vercel, with no render server.
 */
export function BrowserExport({ spec, fileName }: { spec: VideoSpec; fileName: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  async function exportMp4() {
    setState({ kind: "checking" });
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const { width, height } = DIMENSIONS[spec.aspectRatio];
      const check = await canRenderMediaOnWeb({ width, height, container: "mp4", videoCodec: "h264" });
      if (!check.canRender) {
        const reason = check.issues.find((i) => i.severity === "error")?.message ?? "This browser can't encode video.";
        throw new Error(`${reason} Try the latest Chrome or Edge on a computer.`);
      }

      abort.current = new AbortController();
      const startedAt = Date.now();
      setState({ kind: "rendering", progress: 0, startedAt });
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: COMPOSITION_ID,
          component: GeneratedVideo,
          width,
          height,
          fps: FPS,
          durationInFrames: totalFrames(spec),
          defaultProps: { spec },
        },
        inputProps: { spec },
        container: "mp4",
        videoCodec: "h264",
        videoBitrate: "high",
        signal: abort.current.signal,
        onProgress: ({ progress }) => setState({ kind: "rendering", progress, startedAt }),
      });
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      setState({ kind: "done", url, sizeMb: blob.size / 1e6, seconds: (Date.now() - startedAt) / 1000 });
      download(url, fileName);
    } catch (err) {
      if (abort.current?.signal.aborted) return setState({ kind: "idle" });
      console.error(err);
      setState({ kind: "error", message: err instanceof Error ? err.message : "Export failed." });
    } finally {
      abort.current = null;
    }
  }

  const busy = state.kind === "checking" || state.kind === "rendering";

  return (
    <div>
      <button
        type="button"
        onClick={exportMp4}
        disabled={busy}
        className="w-full rounded-full bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-60"
      >
        {state.kind === "checking"
          ? "Preparing…"
          : state.kind === "rendering"
            ? `Rendering in your browser… ${Math.round(state.progress * 100)}%`
            : "⬇ Download MP4"}
      </button>

      {state.kind === "rendering" ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-orange-400 transition-all" style={{ width: `${state.progress * 100}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>Keep this tab open while it renders.</span>
            <button type="button" onClick={() => abort.current?.abort()} className="text-zinc-300 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {state.kind === "done" ? (
        <p className="mt-2 text-xs text-emerald-300">
          ✓ Done in {Math.round(state.seconds)}s ({state.sizeMb.toFixed(1)} MB).{" "}
          <button type="button" onClick={() => download(state.url, fileName)} className="underline hover:text-white">
            Download again
          </button>
        </p>
      ) : null}

      {state.kind === "error" ? <p className="mt-2 text-xs text-red-400">{state.message}</p> : null}
    </div>
  );
}

function download(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
