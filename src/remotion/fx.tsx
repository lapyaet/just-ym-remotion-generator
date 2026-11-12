import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme, useUnit } from "./components";
import { rand } from "./templates";

/**
 * Motion-graphics layers drawn over the whole reel, one look per template:
 *   calling  - warm golden bokeh drifting up
 *   cinematic- light leak sweeping across + floating dust
 *   journal  - hand-drawn doodles (planes, hearts, stars) floating gently
 *   neon     - light streaks + twinkling sparkles
 *   flash    - confetti showers
 * Only single-gradient backgrounds, solid shapes and shadows are used so the
 * in-browser MP4 export draws them exactly like the preview.
 */
export const TemplateFX: React.FC = () => {
  const { t } = useTheme();
  switch (t.id) {
    case "cinematic":
      return (
        <>
          <LightLeak />
          <Dust count={22} color="rgba(255,240,210,0.55)" />
        </>
      );
    case "journal":
      return <Doodles />;
    case "neon":
      return (
        <>
          <Streaks />
          <Sparkles count={18} />
        </>
      );
    case "flash":
      return <Confetti count={46} />;
    default:
      return <Bokeh count={20} />;
  }
};

/** Soft glowing circles rising slowly. */
export const Bokeh: React.FC<{ count: number }> = ({ count }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { seed, t } = useTheme();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => rand(seed, 1000 + i * 13 + k);
        const size = (14 + r(1) * 46) * u;
        const speed = (0.6 + r(2) * 1.6) * u;
        const x = r(3) * width + Math.sin(frame / (40 + r(4) * 40) + i) * 30 * u;
        const y = height + size - ((frame * speed + r(5) * height * 1.3) % (height + size * 2));
        const twinkle = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(frame / (12 + r(6) * 14) + i * 2));
        const color = r(7) > 0.35 ? "#FFD08A" : t.colors.primary;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity: twinkle * 0.55,
              boxShadow: `0 0 ${size}px ${size * 0.4}px ${color}`,
              filter: `blur(${size * 0.18}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Tiny floating specks (film dust). */
export const Dust: React.FC<{ count: number; color: string }> = ({ count, color }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { seed } = useTheme();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => rand(seed, 2000 + i * 17 + k);
        const size = (2 + r(1) * 5) * u;
        const x = (r(2) * width + frame * (r(3) - 0.5) * 1.2 * u + width) % width;
        const y = (r(4) * height - frame * (0.2 + r(5) * 0.6) * u + height * 2) % height;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: "50%", background: color, opacity: 0.3 + 0.5 * r(6) }} />;
      })}
    </AbsoluteFill>
  );
};

/** Warm light leak drifting across the frame (cinematic). */
export const LightLeak: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const x = interpolate(Math.sin(frame / 70), [-1, 1], [-0.3, 0.8]) * width;
  const pulse = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(frame / 23));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: -height * 0.2,
          width: width * 0.9,
          height: height * 1.4,
          background: "radial-gradient(closest-side, rgba(255,170,90,0.9), rgba(255,120,60,0) 100%)",
          opacity: pulse,
          transform: "rotate(18deg)",
          filter: `blur(${width * 0.04}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const DOODLES = ["✈", "♥", "★", "☀", "✿", "➶", "☁", "✦"];

/** Hand-drawn doodles bobbing around the edges (journal). */
export const Doodles: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { seed, t } = useTheme();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 9 }, (_, i) => {
        const r = (k: number) => rand(seed, 3000 + i * 19 + k);
        const edge = i % 2 === 0;
        const x = edge ? (r(1) < 0.5 ? r(2) * width * 0.14 : width * (0.86 + r(2) * 0.1)) : r(2) * width;
        const y = edge ? r(3) * height : r(3) < 0.5 ? r(4) * height * 0.08 : height * (0.9 + r(4) * 0.06);
        const bob = Math.sin(frame / (18 + r(5) * 16) + i) * 10 * u;
        const spin = Math.sin(frame / (30 + r(6) * 20) + i) * 12;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y + bob,
              fontSize: (34 + r(7) * 40) * u,
              color: r(8) > 0.5 ? t.colors.primary : t.colors.accent,
              opacity: 0.55,
              transform: `rotate(${spin}deg)`,
            }}
          >
            {DOODLES[Math.floor(r(9) * DOODLES.length)]}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Diagonal neon light streaks sweeping past (neon). */
export const Streaks: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { seed, t } = useTheme();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: 4 }, (_, i) => {
        const r = (k: number) => rand(seed, 4000 + i * 23 + k);
        const period = 70 + r(1) * 60;
        const p = ((frame + r(2) * period) % period) / period;
        const color = i % 2 ? t.colors.accent : t.colors.primary;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: interpolate(p, [0, 1], [-width * 0.6, width * 1.2]),
              top: r(3) * height,
              width: width * 0.5,
              height: (3 + r(4) * 4) * u,
              background: `linear-gradient(90deg, rgba(0,0,0,0), ${color}, rgba(0,0,0,0))`,
              boxShadow: `0 0 ${18 * u}px ${color}`,
              opacity: Math.sin(p * Math.PI) * 0.8,
              transform: "rotate(-24deg)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Four-point twinkles popping on and off (neon). */
export const Sparkles: React.FC<{ count: number }> = ({ count }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { seed, t } = useTheme();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => rand(seed, 5000 + i * 29 + k);
        const period = 40 + r(1) * 50;
        const p = ((frame + r(2) * period) % period) / period;
        const s = Math.max(0, Math.sin(p * Math.PI)) ** 3;
        const size = (16 + r(3) * 26) * u;
        const color = r(4) > 0.5 ? t.colors.accent : "#FFFFFF";
        return (
          <div key={i} style={{ position: "absolute", left: r(5) * width, top: r(6) * height, width: size, height: size, transform: `scale(${s}) rotate(${p * 90}deg)` }}>
            <div style={{ position: "absolute", left: "45%", top: 0, width: "10%", height: "100%", background: color, borderRadius: 999, boxShadow: `0 0 ${10 * u}px ${color}` }} />
            <div style={{ position: "absolute", top: "45%", left: 0, height: "10%", width: "100%", background: color, borderRadius: 999, boxShadow: `0 0 ${10 * u}px ${color}` }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const CONFETTI = ["#111111", "#FF914D", "#FFFFFF", "#E8352B", "#2F80ED"];

/** Confetti falling and tumbling (flash). */
export const Confetti: React.FC<{ count: number; burstAt?: number }> = ({ count, burstAt }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { seed } = useTheme();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => rand(seed, 6000 + i * 31 + k);
        const w = (10 + r(1) * 14) * u;
        const h = w * (0.4 + r(2) * 0.5);
        const fall = (1.2 + r(3) * 2.4) * u;
        const local = burstAt === undefined ? frame + r(4) * 400 : frame - burstAt;
        if (burstAt !== undefined && local < 0) return null;
        const y = burstAt === undefined ? ((local * fall) % (height + 100)) - 50 : height * 0.35 - Math.sin(Math.min(local / 20, 1) * Math.PI * 0.5) * height * 0.3 * r(5) + local * local * 0.04 * u;
        const x = burstAt === undefined ? r(6) * width + Math.sin(local / (14 + r(7) * 10)) * 26 * u : width / 2 + (r(6) - 0.5) * width * Math.min(local / 14, 1.1);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: h,
              background: CONFETTI[Math.floor(r(8) * CONFETTI.length)],
              borderRadius: r(9) > 0.7 ? "50%" : 2 * u,
              transform: `rotate(${local * (3 + r(10) * 7)}deg) scaleY(${Math.cos(local / (4 + r(11) * 4))})`,
              opacity: burstAt === undefined ? 0.85 : Math.max(0, 1 - local / 70),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** One-shot radial burst of rays + dots behind a big moment (hook text, stickers). */
export const Burst: React.FC<{ at: number; color: string; x?: string; y?: string; size?: number }> = ({ at, color, x = "50%", y = "45%", size = 900 }) => {
  const frame = useCurrentFrame();
  const u = useUnit();
  const local = frame - at;
  if (local < 0 || local > 26) return null;
  const p = local / 26;
  const ease = 1 - Math.pow(1 - p, 3);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}>
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * 360;
        const len = size * u * 0.45;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: len * (0.5 + 0.5 * (1 - p)),
              height: (i % 2 ? 6 : 10) * u,
              borderRadius: 999,
              background: color,
              transformOrigin: "0 50%",
              transform: `rotate(${angle}deg) translateX(${ease * len * 0.55}px)`,
              opacity: 1 - p,
              boxShadow: `0 0 ${12 * u}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};
