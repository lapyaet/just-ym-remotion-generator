"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { GeneratedVideo } from "@/remotion/GeneratedVideo";
import { DIMENSIONS, FPS, totalFrames, type VideoSpec } from "@/remotion/schema";
import { MUSIC_TRACKS } from "@/remotion/music";
import { randomSeed, TEMPLATE_IDS, TEMPLATES, type TemplateId } from "@/remotion/templates";
import { GeneratingOverlay } from "./GeneratingOverlay";
import { BrowserExport } from "./BrowserExport";

type RenderRow = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
  createdAt: string;
};

export function ProjectEditor({
  projectId,
  prompt,
  initialSpec,
  initialRenders,
  renderingAvailable,
}: {
  projectId: string;
  prompt: string;
  initialSpec: VideoSpec;
  initialRenders: RenderRow[];
  renderingAvailable: boolean;
}) {
  const router = useRouter();
  const [spec, setSpec] = useState(initialSpec);
  const [renders, setRenders] = useState(initialRenders);
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState<null | "revise" | "render" | "delete" | "music">(null);
  const [error, setError] = useState<string | null>(null);

  const { width, height } = DIMENSIONS[spec.aspectRatio];
  const active = renders.find((r) => r.status === "queued" || r.status === "rendering");

  // Poll the active render until it finishes.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/renders/${active.id}`);
      if (!res.ok) return;
      const row: RenderRow = await res.json();
      setRenders((rs) => rs.map((r) => (r.id === row.id ? row : r)));
    }, 1500);
    return () => clearInterval(timer);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function call(kind: "revise" | "render" | "delete" | "music", init: RequestInit, url: string) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function revise(e: React.FormEvent) {
    e.preventDefault();
    const data = await call("revise", { method: "PATCH", body: JSON.stringify({ prompt: revision }) }, `/api/projects/${projectId}`);
    if (data) {
      setSpec(data.spec);
      setRevision("");
    }
  }

  /** Design changes apply to the preview instantly, then save in the background. */
  async function changeDesign(patch: Partial<Pick<VideoSpec, "music" | "template" | "seed" | "sfx">>) {
    const previous = spec;
    setSpec({ ...spec, ...patch });
    const data = await call("music", { method: "PATCH", body: JSON.stringify(patch) }, `/api/projects/${projectId}`);
    if (!data) setSpec(previous);
  }
  const changeMusic = (music: string) => changeDesign({ music });
  function surprise() {
    const others = TEMPLATE_IDS.filter((id) => id !== spec.template);
    changeDesign({ template: others[Math.floor(Math.random() * others.length)], seed: randomSeed() });
  }

  async function render() {
    const data = await call("render", { method: "POST" }, `/api/projects/${projectId}/render`);
    if (data && !renders.some((r) => r.id === data.renderId)) {
      setRenders((rs) => [
        { id: data.renderId, status: "queued", progress: 0, error: null, createdAt: new Date().toISOString() },
        ...rs,
      ]);
    }
  }

  async function remove() {
    if (!confirm("Delete this project and all of its renders?")) return;
    const data = await call("delete", { method: "DELETE" }, `/api/projects/${projectId}`);
    if (data) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      {busy === "revise" ? <GeneratingOverlay title="Revising your video" /> : null}
      <section>
        <h1 className="text-2xl font-semibold">{spec.title}</h1>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">“{prompt}”</p>

        <div
          className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black"
          style={{ maxWidth: spec.aspectRatio === "16:9" ? "100%" : 420 }}
        >
          <Player
            component={GeneratedVideo}
            inputProps={{ spec }}
            durationInFrames={Math.max(1, totalFrames(spec))}
            fps={FPS}
            compositionWidth={width}
            compositionHeight={height}
            style={{ width: "100%", aspectRatio: `${width} / ${height}` }}
            controls
            loop
            autoPlay
            showVolumeControls
            acknowledgeRemotionLicense
          />
        </div>

        <form onSubmit={revise} className="mt-6 flex gap-2">
          <input
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="Ask for changes, e.g. “add Safari World and make it faster”"
            className="flex-1 rounded-full border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            disabled={busy !== null}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={busy !== null || revision.trim().length < 3}
            className="rounded-full bg-white/10 px-5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
          >
            {busy === "revise" ? "Revising…" : "Revise"}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1 text-zinc-400">🎨 Design</span>
          {TEMPLATE_IDS.map((id: TemplateId) => (
            <button
              key={id}
              type="button"
              title={TEMPLATES[id].mood}
              onClick={() => changeDesign({ template: id, seed: randomSeed() })}
              disabled={busy !== null}
              className={
                spec.template === id
                  ? "rounded-full bg-orange-400 px-3 py-1 font-medium text-zinc-950"
                  : "rounded-full border border-white/15 px-3 py-1 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              }
            >
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: TEMPLATES[id].colors.primary, boxShadow: `0 0 0 2px ${TEMPLATES[id].colors.bg}` }} />
              {TEMPLATES[id].label}
            </button>
          ))}
          <button
            type="button"
            onClick={surprise}
            disabled={busy !== null}
            className="rounded-full border border-orange-400/40 px-3 py-1 text-orange-200 hover:bg-orange-400/10 disabled:opacity-50"
          >
            🎲 Surprise me
          </button>
          <button
            type="button"
            onClick={() => changeDesign({ seed: randomSeed() })}
            disabled={busy !== null}
            title="Same template, new camera moves, tilts and layout variations"
            className="rounded-full border border-white/15 px-3 py-1 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          >
            ↻ New variation
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1 text-zinc-400">🎵 Music</span>
          {[...MUSIC_TRACKS.map((t) => ({ file: t.file, label: t.label })), { file: "", label: "No music" }].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => changeMusic(t.file)}
              disabled={busy !== null || spec.music === t.file}
              className={
                spec.music === t.file
                  ? "rounded-full bg-orange-400 px-3 py-1 font-medium text-zinc-950"
                  : "rounded-full border border-white/15 px-3 py-1 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              }
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => changeDesign({ sfx: !spec.sfx })}
            disabled={busy !== null}
            className={spec.sfx ? "ml-2 rounded-full bg-white/15 px-3 py-1 text-zinc-100" : "ml-2 rounded-full border border-white/15 px-3 py-1 text-zinc-400 hover:bg-white/10"}
          >
            {spec.sfx ? "🔊 Sound effects on" : "🔇 Sound effects off"}
          </button>
          {spec.music && !MUSIC_TRACKS.some((t) => t.file === spec.music) ? (
            <span className="rounded-full bg-orange-400 px-3 py-1 font-medium text-zinc-950">{spec.music}</span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </section>

      <aside className="space-y-6">
        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="font-medium">Export</h2>
          <p className="mt-1 text-xs text-zinc-400">
            {TEMPLATES[spec.template].label} · {spec.aspectRatio} · {(totalFrames(spec) / FPS).toFixed(1)}s · {spec.scenes.length} scenes
          </p>
          <div className="mt-4">
            <BrowserExport spec={spec} fileName={`${spec.title.replace(/[^\w\- ]+/g, "").trim() || "video"}.mp4`} />
            <p className="mt-2 text-[11px] text-zinc-500">Renders on this device, then downloads. Best in Chrome or Edge.</p>
          </div>

          {renderingAvailable ? (
            <button
              type="button"
              onClick={render}
              disabled={busy !== null || !!active}
              className="mt-4 w-full rounded-full border border-white/15 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
            >
              {active ? `Rendering on server… ${Math.round(active.progress * 100)}%` : "Render on server instead"}
            </button>
          ) : null}

          <ul className="mt-4 space-y-2">
            {renders.map((r) => (
              <li key={r.id} className="rounded-lg bg-white/[.03] px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400">{new Date(r.createdAt).toLocaleString()}</span>
                  {r.status === "done" ? (
                    <span className="flex gap-3">
                      <a className="text-indigo-300 hover:underline" href={`/api/renders/${r.id}/file`} target="_blank">
                        View
                      </a>
                      <a className="text-indigo-300 hover:underline" href={`/api/renders/${r.id}/file?download=1`}>
                        Download
                      </a>
                    </span>
                  ) : r.status === "error" ? (
                    <span className="text-red-400">Failed</span>
                  ) : (
                    <span className="text-amber-300">
                      {r.status === "queued" ? "Queued" : `${Math.round(r.progress * 100)}%`}
                    </span>
                  )}
                </div>
                {r.status === "rendering" || r.status === "queued" ? (
                  <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
                    <div className="h-full bg-indigo-400 transition-all" style={{ width: `${r.progress * 100}%` }} />
                  </div>
                ) : null}
                {r.error ? <p className="mt-1 line-clamp-3 text-red-400/80">{r.error}</p> : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="font-medium">Scenes</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {spec.scenes.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-5 shrink-0 text-zinc-500">{i + 1}</span>
                <span className="flex-1">
                  <span className="text-zinc-200">{s.tag || s.headline} {s.highlight ? <span className="text-orange-300">{s.highlight}</span> : null}</span>
                  <span className="block text-xs text-zinc-500">
                    {s.type} · {s.durationInSeconds}s{s.products.length ? ` · ${s.products.map((p) => p.name).join(", ")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="text-xs text-zinc-500 hover:text-red-400"
        >
          Delete project
        </button>
      </aside>
    </div>
  );
}
