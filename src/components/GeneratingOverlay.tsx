"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Reading your request",
  "Finding attractions & live prices on justym.me",
  "Writing the scenes",
  "Picking photos, captions & music",
  "Putting your reel together",
];

/**
 * Full-screen 3D loading animation shown while the AI writes a video:
 * a spinning Just YM cube with an orbit ring, plus step-by-step progress.
 */
export function GeneratingOverlay({
  title = "Generating your video",
  fileName,
  referenceUrl,
}: {
  title?: string;
  fileName?: string;
  referenceUrl?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(timer);
  }, []);

  // Steps advance on a timer (the AI call has no progress events); the last one waits.
  const steps = referenceUrl ? [STEPS[0], "Studying your reference reel", ...STEPS.slice(1)] : STEPS;
  const step = Math.min(steps.length - 1, Math.floor(elapsed / 3.2));

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/85 px-6 backdrop-blur-md"
    >
      <div className="loader-stage" aria-hidden>
        <div className="loader-orbit">
          <span className="loader-dot" />
          <span className="loader-dot loader-dot-2" />
        </div>
        <div className="loader-cube">
          <div className="loader-face loader-front">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/justym-logo.svg" alt="" />
          </div>
          <div className="loader-face loader-back">▶</div>
          <div className="loader-face loader-right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mascot-body.png" alt="" />
          </div>
          <div className="loader-face loader-left">🎬</div>
          <div className="loader-face loader-top">✈️</div>
          <div className="loader-face loader-bottom">🎵</div>
        </div>
        <div className="loader-shadow" />
      </div>

      <h2 className="mt-14 text-xl font-semibold text-white">{title}…</h2>
      {fileName ? <p className="mt-1 text-sm text-zinc-400">Using brief: {fileName}</p> : null}
      {referenceUrl ? (
        <p className="mt-1 max-w-sm truncate text-sm text-zinc-400">Style reference: {referenceUrl.replace(/^https?:\/\/(www\.)?/, "")}</p>
      ) : null}

      <ol className="mt-6 w-full max-w-sm space-y-2 text-sm">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className={
                i < step
                  ? "flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-[11px] font-bold text-zinc-950"
                  : i === step
                    ? "h-5 w-5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent"
                    : "h-5 w-5 rounded-full border border-white/20"
              }
            >
              {i < step ? "✓" : null}
            </span>
            <span className={i <= step ? "text-zinc-100" : "text-zinc-500"}>{label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-zinc-500">{Math.floor(elapsed)}s · this usually takes 10–40 seconds</p>
    </div>
  );
}
