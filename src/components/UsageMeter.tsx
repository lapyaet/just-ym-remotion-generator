"use client";

import { useCallback, useEffect, useState } from "react";

export type UsageInfo = {
  used: number;
  limit: number;
  /** null when unlimited */
  remaining: number | null;
  unlimited: boolean;
  resetAt: string;
  timezone: string;
};

/** Today's generation usage; `refresh()` after a generation, `set()` from a 429 response. */
export function useUsage() {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (res.ok) setUsage(await res.json());
    } catch {
      // Network hiccup: keep the last known value.
    }
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/usage", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UsageInfo | null) => {
        if (alive && data) setUsage(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const blocked = usage !== null && !usage.unlimited && (usage.remaining ?? 0) <= 0;
  return { usage, refresh, set: setUsage, blocked };
}

function useCountdown(resetAt: string | undefined) {
  // The clock starts in the browser only (pages are pre-rendered without one).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!resetAt || now === null) return "…";
  const ms = Math.max(0, new Date(resetAt).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "7 of 10 videos left today · resets in 5h 20m" with a progress bar. */
export function UsageMeter({ usage, compact = false }: { usage: UsageInfo | null; compact?: boolean }) {
  const countdown = useCountdown(usage?.resetAt);
  if (!usage) return <div className={compact ? "h-5" : "h-9"} aria-hidden />;

  if (usage.unlimited) {
    return <p className="text-xs text-zinc-500">∞ Unlimited generations · {usage.used} today</p>;
  }

  const remaining = usage.remaining ?? 0;
  const pct = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 100;
  const tone = remaining === 0 ? "bg-red-500" : remaining <= Math.max(1, Math.ceil(usage.limit * 0.2)) ? "bg-amber-400" : "bg-orange-400";
  const text = remaining === 0 ? "text-red-300" : remaining <= 2 ? "text-amber-200" : "text-zinc-300";

  return (
    <div className={compact ? "min-w-[180px]" : "min-w-[220px]"} role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className={text}>
          {remaining === 0 ? (
            <>Daily limit reached ({usage.used}/{usage.limit})</>
          ) : (
            <>
              <strong className="font-semibold">{remaining}</strong> of {usage.limit} videos left today
            </>
          )}
        </span>
        <span className="text-zinc-500">resets in {countdown}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {!compact && remaining === 0 ? (
        <p className="mt-1.5 text-xs text-zinc-500">
          You can still change the design, music and sound effects, and download your videos. New videos unlock at midnight (Myanmar time).
        </p>
      ) : null}
    </div>
  );
}
