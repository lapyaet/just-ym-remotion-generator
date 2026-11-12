"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GeneratingOverlay } from "./GeneratingOverlay";

const EXAMPLES = [
  "Bangkok is Calling: Dream World, Safari World and a dinner cruise, pay with KBZPay",
  "Phuket is Calling: Phi Phi Island day trip, Carnival Magic and Hanuman World, stay 2 extra days",
  "Before you leave Singapore: Gardens by the Bay, Universal Studios and Wings of Time",
];

const MAX_BRIEF_CHARS = 12_000; // keep in sync with src/lib/api.ts
const ACCEPT = ".md,.markdown,.txt,text/markdown,text/plain";

export type Brief = { name: string; text: string };

/** Read a .md/.txt file from the user's device into a Brief, or return an error. */
export async function readBriefFile(file: File): Promise<Brief | { error: string }> {
  if (!/\.(md|markdown|txt)$/i.test(file.name)) return { error: "Please choose a Markdown (.md) or text file." };
  if (file.size > 200_000) return { error: "That file is too large (max 200 KB)." };
  const text = (await file.text()).trim();
  if (!text) return { error: "That file is empty." };
  if (text.length > MAX_BRIEF_CHARS) {
    return { error: `That file has ${text.length.toLocaleString()} characters; the limit is ${MAX_BRIEF_CHARS.toLocaleString()}.` };
  }
  return { name: file.name, text };
}

export function PromptForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attach(file: File | undefined) {
    if (!file) return;
    setError(null);
    const result = await readBriefFile(file);
    if ("error" in result) setError(result.error);
    else setBrief(result);
    if (fileInput.current) fileInput.current.value = ""; // allow re-picking the same file
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, brief: brief?.text, briefName: brief?.name, referenceUrl: referenceUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      router.push(`/projects/${data.id}`); // overlay stays up until the project page loads
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLoading(false);
    }
  }

  const referenceOk = !referenceUrl.trim() || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+\S*$/i.test(referenceUrl.trim());
  const canSubmit = !loading && referenceOk && (prompt.trim().length >= 3 || brief !== null || referenceUrl.trim().length > 0);

  return (
    <form onSubmit={submit} className="space-y-3">
      {loading ? <GeneratingOverlay fileName={brief?.name} referenceUrl={referenceUrl.trim() || undefined} /> : null}

      <div
        className={`relative rounded-xl border transition ${dragging ? "border-orange-400 bg-orange-400/10" : "border-white/10 bg-white/[.04]"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          attach(e.dataTransfer.files[0]);
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={
            brief
              ? "Optional: add extra instructions for this brief…"
              : "A 20-second reel for Chiang Mai: elephant sanctuary, night safari and Doi Inthanon… (or drop a .md brief here)"
          }
          className="w-full resize-y bg-transparent p-4 outline-none placeholder:text-zinc-500"
          disabled={loading}
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2">
          <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={loading}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          >
            📎 Attach .md brief
          </button>
          {brief ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-400/15 px-3 py-1 text-xs text-orange-200">
              📄 {brief.name} · {brief.text.length.toLocaleString()} chars
              <button type="button" onClick={() => setBrief(null)} aria-label="Remove file" className="text-orange-200/70 hover:text-white">
                ✕
              </button>
            </span>
          ) : (
            <span className="text-xs text-zinc-500">Markdown or text, up to {MAX_BRIEF_CHARS.toLocaleString()} characters</span>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 focus-within:border-orange-400">
        <span className="shrink-0 text-sm text-zinc-400">🔗 Reference reel</span>
        <input
          type="url"
          inputMode="url"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="Optional: paste a reel link to copy its style (Drive, Instagram, TikTok, YouTube…)"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
          disabled={loading}
          maxLength={2000}
        />
        {referenceUrl ? (
          <button type="button" onClick={() => setReferenceUrl("")} aria-label="Clear link" className="text-zinc-500 hover:text-white">
            ✕
          </button>
        ) : null}
      </label>
      {!referenceOk ? <p className="-mt-1 text-xs text-red-400">That doesn&apos;t look like a link.</p> : null}

      {brief ? (
        <details className="rounded-lg border border-white/10 bg-white/[.02] px-3 py-2 text-xs text-zinc-400">
          <summary className="cursor-pointer select-none">Preview {brief.name}</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-zinc-300">{brief.text}</pre>
        </details>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:bg-white/10"
          >
            {ex.slice(0, 48)}…
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-orange-500 px-6 py-2.5 font-medium text-white hover:bg-orange-400 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate video"}
        </button>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </form>
  );
}
