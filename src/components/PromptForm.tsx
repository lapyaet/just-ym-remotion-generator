"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "A 20-second vertical promo for a cozy coffee shop's new pumpkin latte, warm autumn colors",
  "Explain how photosynthesis works in 5 scenes for middle school students",
  "Launch announcement for a productivity app called Flowly, dark theme with neon purple",
];

export function PromptForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="A 30-second intro video for my YouTube channel about budget travel in Japan…"
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[.04] p-4 outline-none placeholder:text-zinc-500 focus:border-indigo-400"
        disabled={loading}
      />
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
          disabled={loading || prompt.trim().length < 3}
          className="rounded-full bg-indigo-500 px-6 py-2.5 font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {loading ? "Claude is writing your video…" : "Generate video"}
        </button>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </form>
  );
}
