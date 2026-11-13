import React, { useState } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { countUp, Img, Logo, Mascot, RadialAt, useIsVertical, useTheme, useUnit } from "./components";
import { FONT_BODY } from "./fonts";
import { musicBpm } from "./music";
import { FPS, sceneTimeline, type Product, type Scene, type VideoSpec } from "./schema";
import { rand, type Template } from "./templates";

/**
 * "Modern Pulse": the motion-graphics look from the hand-made Just YM reels
 * (JustYM.tsx / Vertical.tsx). Animated gradient mesh, letter-by-letter
 * kinetic type, beat-cut photo montage, 3D card coverflow, glass captions,
 * starburst stickers, zoom-blur cuts, white flashes on the beat and film grain.
 *
 * Every scene type has its own layout here, and the video's seed picks the
 * colour palette and layout variants, so two Pulse videos still look different.
 * Only features the in-browser MP4 export can draw are used (single gradients,
 * radial gradients, filters, 3D transforms, blend modes; no text-stroke and no
 * backdrop-filter).
 */

export const PULSE = { navy: "#0A0F24", orange: "#FF924D", hot: "#FF5E3A", sun: "#FFC15E", white: "#FFFFFF", green: "#16A34A" } as const;

const PALETTES = [
  { name: "sunset", blobs: ["#FF5E3A", "#FF924D", "#7B2CBF", "#FFC15E"], accent: "#FFC15E" },
  { name: "lagoon", blobs: ["#FF924D", "#00A6C8", "#3A0CA3", "#FFC15E"], accent: "#FFD166" },
  { name: "berry", blobs: ["#FF3E8A", "#FF924D", "#5B21B6", "#FFB86B"], accent: "#FFC15E" },
  { name: "jungle", blobs: ["#FF924D", "#10B981", "#1E3A8A", "#FACC15"], accent: "#FDE047" },
] as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type SceneProps = { scene: Scene; spec: VideoSpec };

// ---------- helpers ----------

/** Photo that disappears instead of failing the render when its URL is dead. */
const SafeImg: React.FC<React.ComponentProps<typeof Img>> = (props) => {
  const [failed, setFailed] = useState(false);
  if (failed || !props.src) return null;
  return <Img {...props} onError={() => setFailed(true)} />;
};

function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function graphemes(text: string) {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((g) => g.segment);
}

const isLatin = (text: string) => /^[\p{Script=Latin}\d\s!?&'’".,:;%@#$฿+\-–—·()/]+$/u.test(text);

/** Font size so `text` fits in `maxLines` lines of `maxWidth` (glyph = average width per character, in em). */
function fitSize(text: string, maxWidth: number, size: number, maxLines: number, glyph: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map((w) => graphemes(w).length));
  const total = Math.max(1, graphemes(text).length);
  const byWord = maxWidth / (longest * glyph);
  const byLines = (maxWidth * maxLines * 0.9) / (total * glyph);
  return Math.max(18, Math.min(size, byWord, byLines));
}

const unique = <T,>(list: T[]) => [...new Set(list)];

/** Frames per beat of the video's music (120 bpm when unknown). */
export function beatFrames(spec: VideoSpec) {
  return (FPS * 60) / (musicBpm(spec.music) ?? 120);
}

function usePalette() {
  const { seed } = useTheme();
  return PALETTES[Math.floor(rand(seed, 501) * PALETTES.length)];
}

/** Deterministic 0..1 per video + scene + slot. */
function useR(slot: number) {
  const { seed, index } = useTheme();
  return rand(seed + index * 104729, slot + 900);
}

function useLayout(spec: VideoSpec) {
  const { width, height } = useVideoConfig();
  const u = useUnit();
  const vertical = useIsVertical();
  const pal = usePalette();
  return { width, height, u, vertical, pal, beat: beatFrames(spec), square: width === height };
}

function useSpring(delay: number, config: { damping?: number; mass?: number } = {}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 14, mass: 0.7, ...config } });
}

/** Words worth colouring in captions: numbers, prices, places, CAPS. */
function isKeyword(word: string, extra: string[]) {
  const w = word.replace(/[^\p{L}\p{N}%฿$.]/gu, "");
  if (!w) return false;
  if (/\d|%|฿|\$/.test(w)) return true;
  if (w.length >= 3 && w === w.toUpperCase() && /\p{Lu}/u.test(w)) return true;
  return extra.some((e) => e.length >= 3 && w.toLowerCase() === e.toLowerCase());
}

const placeWords = (spec: VideoSpec) =>
  unique(
    spec.scenes
      .flatMap((s) => [s.location, s.tag, ...s.products.map((p) => p.city)])
      .join(" ")
      .replace(/[@·,]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );

// ---------- backgrounds & overlays ----------

/** Animated gradient mesh: big soft colour blobs drifting over navy. */
export const MeshBg: React.FC<{ colors?: readonly string[]; base?: string; strength?: number }> = ({ colors, base = PULSE.navy, strength = 0.62 }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { index } = useTheme();
  const pal = usePalette();
  const list = colors ?? [...pal.blobs.slice(index % 4), ...pal.blobs.slice(0, index % 4)];
  const d = Math.max(width, height) * 1.1;
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      {list.map((c, i) => {
        const a = f / 70 + i * 1.7 + index * 0.9;
        const x = width / 2 + Math.sin(a) * width * 0.35 + (i - 1.5) * width * 0.11;
        const y = height / 2 + Math.cos(a * 0.8 + i) * height * 0.33;
        return (
          <div
            key={i}
            style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(c, strength)} 0%, ${rgba(c, 0)} 62%)` }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Film grain (a noise texture jittered every frame, blended over everything). */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.2 }) => {
  const f = useCurrentFrame();
  const k = f % 6;
  const x = (random(`gx${k}`) - 0.5) * 8;
  const y = (random(`gy${k}`) - 0.5) * 8;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity, overflow: "hidden" }}>
      <Img src={staticFile("fx/grain.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(1.15) translate(${x}%, ${y}%)` }} />
    </AbsoluteFill>
  );
};

/** Viewfinder-style corner marks. */
const CornerMarks: React.FC<{ inset?: number; color?: string }> = ({ inset = 60, color = "#FFFFFF" }) => {
  const u = useUnit();
  const { width, height } = useVideoConfig();
  const s = 60 * u;
  const b = `${6 * u}px solid ${color}`;
  const top = (inset + 70) * u;
  const corners: React.CSSProperties[] = [
    { left: inset * u, top, borderTop: b, borderLeft: b },
    { left: width - inset * u - s, top, borderTop: b, borderRight: b },
    { left: inset * u, top: height - top - s, borderBottom: b, borderLeft: b },
    { left: width - inset * u - s, top: height - top - s, borderBottom: b, borderRight: b },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <div key={i} style={{ position: "absolute", width: s, height: s, opacity: 0.85, ...c }} />
      ))}
    </>
  );
};

/** Huge faint word scrolling sideways behind the content. */
const GhostWord: React.FC<{ text: string; top: number; size: number }> = ({ text, top, size }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(f, [0, durationInFrames], [0, -size * 1.6]);
  if (!text) return null;
  return (
    <div style={{ position: "absolute", top, left: x, whiteSpace: "nowrap", fontFamily: FONT_BODY, fontWeight: 900, fontSize: size, letterSpacing: -size * 0.02, color: "rgba(255,255,255,0.1)", lineHeight: 1 }}>
      {text} {text} {text}
    </div>
  );
};

// ---------- type ----------

/** Letter-by-letter masked reveal (word-by-word for Burmese, which shouldn't be split). */
export const Kinetic: React.FC<{
  text: string;
  size: number;
  maxWidth: number;
  delay?: number;
  color?: string;
  maxLines?: number;
  stagger?: number;
  align?: "center" | "left";
  weight?: number;
  shadow?: boolean;
}> = ({ text, size, maxWidth, delay = 0, color = "#FFFFFF", maxLines = 2, stagger = 1.6, align = "center", weight = 900, shadow = true }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text) return null;
  const latin = isLatin(text);
  const fs = fitSize(text, maxWidth, size, maxLines, latin ? (text === text.toUpperCase() ? 0.74 : 0.6) : 0.95);
  const words = text.split(/\s+/).filter(Boolean);
  const starts: number[] = [];
  words.reduce((n, w) => {
    starts.push(n);
    return n + (latin ? graphemes(w).length : 3);
  }, 0);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "left" ? "flex-start" : "center",
        columnGap: fs * 0.26,
        maxWidth,
        fontFamily: FONT_BODY,
        fontWeight: weight,
        fontSize: fs,
        lineHeight: latin ? 1.04 : 1.45,
        letterSpacing: latin ? -0.02 * fs : 0,
        color,
        textShadow: shadow ? "0 10px 36px rgba(0,0,0,0.35)" : undefined,
      }}
    >
      {words.map((w, wi) => {
        const units = latin ? graphemes(w) : [w];
        return (
          <span key={wi} style={{ display: "inline-flex", overflow: "hidden", paddingBottom: fs * 0.08, paddingTop: latin ? 0 : fs * 0.1 }}>
            {units.map((ch, ci) => {
              const s = spring({ frame: f - delay - (starts[wi] + ci) * stagger, fps, config: { damping: 15, mass: 0.6 } });
              return (
                <span key={ci} style={{ display: "inline-block", whiteSpace: "pre", transform: `translateY(${(1 - s) * 110}%) rotate(${(1 - s) * 8}deg)` }}>
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

/** Giant stacked words that slam in with fading echo copies. */
const StackWords: React.FC<{ lines: { text: string; color: string }[]; delay: number; maxWidth: number; size: number; gap?: number }> = ({ lines, delay, maxWidth, size, gap = 15 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {lines.map((line, i) => {
        const latin = isLatin(line.text);
        const fs = fitSize(line.text, maxWidth, size, 1, latin ? 0.74 : 0.95);
        const d = delay + i * gap;
        const s = spring({ frame: f - d, fps, config: { damping: 10, mass: 0.6 } });
        const echo = interpolate(f - d, [0, 14], [0, 1], clamp);
        const text: React.CSSProperties = { fontFamily: FONT_BODY, fontWeight: 900, fontSize: fs, letterSpacing: latin ? -fs * 0.035 : 0, lineHeight: latin ? 0.95 : 1.4, whiteSpace: "nowrap" };
        return (
          <div key={i} style={{ position: "relative", textAlign: "center" }}>
            {[2, 1].map((k) => (
              <div key={k} style={{ ...text, position: "absolute", left: 0, right: 0, color: line.color, opacity: f < d ? 0 : (1 - echo) * 0.35, transform: `scale(${1 + echo * 0.18 * k})` }}>
                {line.text}
              </div>
            ))}
            <div style={{ ...text, color: line.color, transform: `scale(${2.2 - 1.2 * s})`, opacity: Math.min(1, s * 1.6), textShadow: "0 20px 50px rgba(0,0,0,0.45)" }}>{line.text}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Word-by-word caption in a frosted pill, in the Reels/TikTok safe zone. */
export const GlassCaption: React.FC<{ text: string; sub?: string; delay?: number; keywords?: string[]; bottom?: number; maxWidth?: number; size?: number }> = ({
  text,
  sub,
  delay = 12,
  keywords = [],
  bottom,
  maxWidth,
  size,
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();
  const u = useUnit();
  const vertical = useIsVertical();
  const pal = usePalette();
  const inS = spring({ frame: f - delay, fps, config: { damping: 16 } });
  const out = interpolate(f, [durationInFrames - 10, durationInFrames - 2], [1, 0], clamp);
  if (!text && !sub) return null;
  const fs = (size ?? (vertical ? 46 : 38)) * u;
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ position: "absolute", left: 60 * u, right: 60 * u, bottom: bottom ?? (vertical ? height * 0.17 : 56 * u), display: "flex", justifyContent: "center", opacity: out }}>
      <div
        style={{
          maxWidth: maxWidth ?? 960 * u,
          transform: `translateY(${(1 - inS) * 60 * u}px) scale(${0.9 + 0.1 * inS})`,
          opacity: inS,
          background: "rgba(12,16,36,0.62)",
          border: `${2 * u}px solid rgba(255,255,255,0.2)`,
          borderRadius: 34 * u,
          padding: `${22 * u}px ${36 * u}px`,
          boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${2 * u}px ${12 * u}px` }}>
          {words.map((w, i) => {
            const s = spring({ frame: f - delay - 4 - i * 2.2, fps, config: { damping: 14, mass: 0.5 } });
            return (
              <span
                key={i}
                style={{ display: "inline-block", fontFamily: FONT_BODY, fontWeight: 700, fontSize: fs, lineHeight: isLatin(w) ? 1.25 : 1.6, color: isKeyword(w, keywords) ? pal.accent : "#FFFFFF", opacity: s, transform: `translateY(${(1 - s) * 24 * u}px)` }}
              >
                {w}
              </span>
            );
          })}
        </div>
        {sub ? (
          <div style={{ marginTop: 8 * u, fontFamily: FONT_BODY, fontWeight: 500, fontSize: fs * 0.62, color: "rgba(255,255,255,0.82)", opacity: spring({ frame: f - delay - 10 - words.length * 2, fps, config: { damping: 16 } }) }}>{sub}</div>
        ) : null}
      </div>
    </div>
  );
};

/** Glass chip with the logo and the brand name. */
export const LogoChip: React.FC<{ delay?: number; scale?: number }> = ({ delay = 0, scale = 1 }) => {
  const u = useUnit() * scale;
  const s = useSpring(delay, { damping: 11 });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 16 * u,
        padding: `${10 * u}px ${26 * u}px ${10 * u}px ${10 * u}px`,
        borderRadius: 999,
        background: "rgba(255,255,255,0.16)",
        border: `${2 * u}px solid rgba(255,255,255,0.28)`,
        transform: `scale(${s})`,
      }}
    >
      <Logo size={64 * u} style={{ borderRadius: 18 * u }} />
      <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 32 * u, color: "#FFFFFF", letterSpacing: 1 }}>JustYM</span>
    </div>
  );
};

const TopChip: React.FC<{ delay?: number }> = ({ delay }) => {
  const u = useUnit();
  const vertical = useIsVertical();
  return (
    <div style={{ position: "absolute", top: (vertical ? 120 : 60) * u, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <LogoChip delay={delay} />
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode; bg: string; color?: string; size?: number; delay?: number }> = ({ children, bg, color = PULSE.navy, size = 28, delay = 0 }) => {
  const u = useUnit();
  const s = useSpring(delay, { damping: 12 });
  return (
    <div style={{ display: "inline-block", fontFamily: FONT_BODY, fontWeight: 700, fontSize: size * u, letterSpacing: size * 0.25 * u, color, background: bg, padding: `${size * 0.33 * u}px ${size * u}px`, borderRadius: 999, transform: `scale(${s})` }}>
      {children}
    </div>
  );
};

/** Spinning starburst sticker. */
const Starburst: React.FC<{ size: number; color: string; points?: number; depth?: number; delay?: number; tilt?: number; children: React.ReactNode }> = ({
  size,
  color,
  points = 16,
  depth = 0.86,
  delay = 0,
  tilt = 12,
  children,
}) => {
  const f = useCurrentFrame();
  const s = useSpring(delay, { damping: 8, mass: 0.6 });
  const poly = Array.from({ length: points * 2 }, (_, k) => {
    const r = k % 2 ? 100 * depth : 100;
    const a = (k / (points * 2)) * Math.PI * 2;
    return `${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <div style={{ position: "relative", width: size, height: size, transform: `scale(${s}) rotate(${tilt + Math.sin(f / 8) * 4}deg)` }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute", inset: 0, transform: `rotate(${f * 1.5}deg)` }}>
        <polygon fill={color} points={poly} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, color: PULSE.navy, textAlign: "center", lineHeight: 0.95 }}>
        {children}
      </div>
    </div>
  );
};

/** "UP TO 75% OFF" -> big number in the middle of a sticker. */
const DiscountBurst: React.FC<{ text: string; size: number; color: string; delay?: number }> = ({ text, size, color, delay = 20 }) => {
  const m = text.match(/^(.*?)(\d+\s*%)(.*)$/);
  const top = m?.[1].trim() ?? "";
  const big = m?.[2].replace(/\s/g, "") ?? text;
  const bottom = m?.[3].trim() || (m ? "OFF" : "");
  return (
    <Starburst size={size} color={color} delay={delay}>
      {top ? <div style={{ fontWeight: 700, fontSize: size * 0.11 }}>{top}</div> : null}
      <div style={{ fontWeight: 900, fontSize: size * (big.length > 4 ? 0.22 : 0.3) }}>{big}</div>
      {bottom ? <div style={{ fontWeight: 800, fontSize: size * 0.12 }}>{bottom}</div> : null}
    </Starburst>
  );
};

const Confetti: React.FC<{ at: number; count?: number }> = ({ at, count = 70 }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = useUnit();
  const pal = usePalette();
  const t = f - at;
  if (t < 0) return null;
  const cols = [pal.accent, "#FFFFFF", PULSE.hot, PULSE.navy, pal.blobs[2]];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const ang = random(`ca${i}`) * Math.PI * 2;
        const v = (18 + random(`cv${i}`) * 30) * u;
        const x = width / 2 + Math.cos(ang) * v * t;
        const y = height * 0.47 + Math.sin(ang) * v * t + 0.9 * u * t * t;
        return (
          <div
            key={i}
            style={{ position: "absolute", left: x, top: y, width: 18 * u, height: 30 * u, background: cols[i % cols.length], borderRadius: 4 * u, transform: `rotate(${t * (10 + random(`cr${i}`) * 20)}deg)`, opacity: interpolate(t, [40, 60], [1, 0], clamp) }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- cards ----------

type CardData = { src: string; title: string; chip: string; price?: string };

const PhotoCard: React.FC<{ card: CardData; width: number; height: number; focus: number; chipColor: string }> = ({ card, width, height, focus, chipColor }) => {
  const u = useUnit();
  return (
    <div style={{ width, height, borderRadius: 48 * u, overflow: "hidden", position: "relative", background: "#1A2040", boxShadow: "0 40px 90px rgba(0,0,0,0.5)", border: `${4 * u}px solid rgba(255,255,255,0.35)` }}>
      {card.src ? <SafeImg src={card.src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.15 - 0.1 * focus})` }} /> : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,8,20,0) 45%, rgba(5,8,20,0.88) 100%)" }} />
      <div style={{ position: "absolute", left: 32 * u, right: 32 * u, bottom: 34 * u, fontFamily: FONT_BODY, color: "#FFFFFF" }}>
        {card.chip ? (
          <div style={{ display: "inline-block", fontWeight: 700, fontSize: 22 * u, letterSpacing: 3 * u, background: chipColor, padding: `${6 * u}px ${16 * u}px`, borderRadius: 999 }}>{card.chip}</div>
        ) : null}
        <div style={{ fontWeight: 800, fontSize: Math.min(46 * u, (width * 1.7) / Math.max(10, card.title.length)), lineHeight: 1.12, marginTop: 12 * u }}>{card.title}</div>
        {card.price ? (
          <div style={{ marginTop: 10 * u, display: "inline-flex", alignItems: "baseline", gap: 10 * u, background: "rgba(255,255,255,0.95)", color: PULSE.navy, borderRadius: 16 * u, padding: `${6 * u}px ${16 * u}px` }}>
            <span style={{ fontSize: 20 * u, fontWeight: 600, opacity: 0.7 }}>from</span>
            <span style={{ fontSize: 34 * u, fontWeight: 900, color: PULSE.hot }}>{countUp(card.price, focus)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 3D coverflow: the focus moves to the next card every two beats. */
const Coverflow: React.FC<{ cards: CardData[]; top: number; cardW: number; cardH: number; step: number; chipColor: string }> = ({ cards, top, cardW, cardH, step, chipColor }) => {
  const f = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const u = useUnit();
  let pos = -0.9 + spring({ frame: f - 2, fps, config: { damping: 16 } }) * 0.9;
  for (let k = 1; k < cards.length; k++) pos += spring({ frame: f - step * k, fps, config: { damping: 15, mass: 0.8 } });
  return (
    <div style={{ position: "absolute", top, left: 0, width, height: cardH }}>
      {cards.map((c, i) => {
        const d = i - pos;
        const ad = Math.abs(d);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: width / 2 - cardW / 2,
              top: 0,
              transform: `perspective(${1800 * u}px) translateX(${d * cardW * 0.84}px) translateZ(${-ad * 320 * u}px) rotateY(${-d * 38}deg)`,
              zIndex: Math.round(100 - ad * 10),
              opacity: interpolate(ad, [0, 1.6, 2.2], [1, 0.75, 0], clamp),
            }}
          >
            <PhotoCard card={c} width={cardW} height={cardH} focus={Math.max(0, 1 - ad)} chipColor={chipColor} />
          </div>
        );
      })}
    </div>
  );
};

const productCard = (p: Product, chip = "TICKETS"): CardData => ({ src: p.imageUrl, title: p.name, chip, price: p.priceText });

// ---------- scenes ----------

export const PulseScene: React.FC<SceneProps> = (props) => {
  const { index } = useTheme();
  const r = rand(props.spec.seed + index * 31, 7);
  const photos = allPhotos(props.spec, props.scene);
  switch (props.scene.type) {
    case "hook":
      return photos.length >= 3 && r < 0.65 ? <MontageHook {...props} /> : <TitleHook {...props} />;
    case "attraction": {
      const n = props.spec.scenes.slice(0, index).filter((s) => s.type === "attraction").length;
      return (n + Math.floor(rand(props.spec.seed, 8) * 2)) % 2 === 0 ? <CardAttraction {...props} /> : <FullAttraction {...props} />;
    }
    case "deals":
      return <DealsFlow {...props} />;
    case "app":
      return <AppPanel {...props} />;
    case "payment":
      return <PayScene {...props} />;
    case "outro":
      return <CtaScene {...props} />;
    default:
      return <ShoutScene {...props} />;
  }
};

function allPhotos(spec: VideoSpec, scene: Scene) {
  const others = spec.scenes.flatMap((s) => [s.imageUrl, ...s.products.map((p) => p.imageUrl)]).filter((src) => src && src !== scene.imageUrl);
  return unique([...others, scene.imageUrl].filter(Boolean)).slice(-8);
}

const upper = (s: string) => (isLatin(s) ? s.toUpperCase() : s);

/** Hook A: photos cut on every beat with clip reveals, then the title. */
const MontageHook: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const photos = allPhotos(spec, scene);
  const step = Math.max(8, Math.round(beat));
  const i = Math.min(photos.length - 1, Math.floor(f / step));
  const local = f - i * step;
  const last = i === photos.length - 1;
  const punch = last ? interpolate(local, [0, step], [1.28, 1.12], { ...clamp, easing: Easing.out(Easing.cubic) }) - local * 0.0008 : interpolate(local, [0, step], [1.28, 1.12], { easing: Easing.out(Easing.cubic) });
  const rot = last ? 0 : (random(`mr${i}`) - 0.5) * 6;
  const reveal = interpolate(local, [0, 5], [0, 100], { ...clamp, easing: Easing.out(Easing.quad) });
  const dir = i % 2 === 0;
  const textAt = Math.round(step * 2);
  const dim = interpolate(f, [textAt - 10, textAt + 10], [0.2, 0.55], clamp);
  const places = scene.kicker || unique(spec.scenes.map((s) => s.location.replace(/^@/, "").split("·")[0].trim()).filter(Boolean)).slice(0, 3).join(" · ");
  return (
    <AbsoluteFill style={{ background: PULSE.navy }}>
      {i > 0 ? <SafeImg src={photos[i - 1]} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.12)" }} /> : null}
      <AbsoluteFill style={{ clipPath: dir ? `inset(0 ${100 - reveal}% 0 0)` : `inset(${100 - reveal}% 0 0 0)` }}>
        <SafeImg src={photos[i]} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${punch}) rotate(${rot}deg)` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(10,15,36,${dim}) 0%, rgba(10,15,36,${dim + 0.25}) 100%)` }} />
      <CornerMarks />
      {places ? (
        <div style={{ position: "absolute", top: (vertical ? 210 : 120) * u, left: 0, right: 0, textAlign: "center", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 30 * u, letterSpacing: 10 * u, color: "#FFFFFF", opacity: interpolate(f, [4, 14], [0, 0.9], clamp) }}>
          {upper(places)}
        </div>
      ) : null}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: vertical ? height * 0.08 : 0 }}>
        <Kinetic text={upper(scene.headline)} delay={textAt} size={(vertical ? 150 : 140) * u} maxWidth={width * 0.86} />
        <Kinetic text={scene.highlight} delay={textAt + step * 0.75} size={(vertical ? 96 : 84) * u} maxWidth={width * 0.86} color={pal.accent} />
      </AbsoluteFill>
      <GlassCaption text={scene.subtitle} delay={textAt + step * 1.5} keywords={placeWords(spec)} />
    </AbsoluteFill>
  );
};

/** Hook B: hero photo card with giant stacked words slamming in. */
const TitleHook: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const card = useSpring(2, { damping: 13 });
  const zoom = interpolate(f, [0, durationInFrames], [1.25, 1.05]);
  const words = upper(scene.headline).split(/\s+/).filter(Boolean);
  const lines = isLatin(scene.headline) && words.length <= 3 ? words.map((w, i) => ({ text: w, color: i === 1 ? pal.accent : "#FFFFFF" })) : [{ text: scene.headline, color: "#FFFFFF" }];
  if (scene.highlight) lines.push({ text: scene.highlight, color: pal.accent });
  const cw = vertical ? width * 0.83 : width * 0.46;
  const ch = vertical ? height * 0.6 : height * 0.78;
  return (
    <AbsoluteFill>
      <MeshBg />
      {scene.imageUrl ? (
        <div
          style={{ position: "absolute", left: (width - cw) / 2, top: (height - ch) / 2 + (vertical ? 40 * u : 0), width: cw, height: ch, borderRadius: 60 * u, overflow: "hidden", transform: `scale(${0.6 + 0.4 * card}) rotate(${(1 - card) * -8}deg)`, opacity: card, boxShadow: "0 50px 120px rgba(0,0,0,0.5)" }}
        >
          <SafeImg src={scene.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,15,36,0.2) 25%, rgba(10,15,36,0.75) 100%)" }} />
        </div>
      ) : null}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <StackWords lines={lines.slice(0, 4)} delay={4} gap={Math.round(beat)} maxWidth={width * 0.9} size={(vertical ? 228 : 190) * u} />
      </AbsoluteFill>
      <TopChip delay={8} />
      <GlassCaption text={scene.subtitle} delay={Math.round(beat * 3)} keywords={placeWords(spec)} />
    </AbsoluteFill>
  );
};

/** Attraction A: tag + kinetic name over a 3D-swinging photo card. */
const CardAttraction: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = useSpring(2);
  const swing = spring({ frame: f - 4, fps, config: { damping: 13, mass: 0.9 } });
  const side = useR(1) < 0.5 ? 1 : -1;
  const product = scene.products[0];
  const name = scene.tag || product?.name || scene.headline;
  const cw = vertical ? width * 0.66 : width * 0.3;
  const ch = vertical ? height * 0.44 : height * 0.7;
  const cardTop = vertical ? height * 0.27 : height * 0.15;
  const cardLeft = vertical ? (width - cw) / 2 : width * 0.62 - cw / 2;
  const textW = vertical ? width * 0.88 : width * 0.42;
  const focus = interpolate(f, [beat * 2, beat * 3.5], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <MeshBg />
      <GhostWord text={upper((scene.location || name).replace(/^@/, ""))} top={vertical ? height * 0.6 : height * 0.55} size={(vertical ? 330 : 300) * u} />
      <div style={{ position: "absolute", top: (vertical ? 150 : 110) * u, left: vertical ? (width - textW) / 2 : width * 0.06, width: textW, display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", gap: 20 * u, opacity: head, transform: `translateY(${(1 - head) * -40 * u}px)` }}>
        {scene.location ? <Chip bg={pal.accent}>{upper(scene.location)}</Chip> : null}
        <Kinetic text={upper(name)} delay={4} size={(vertical ? 120 : 110) * u} maxWidth={textW} stagger={1.2} align={vertical ? "center" : "left"} />
      </div>
      <div
        style={{
          position: "absolute",
          left: cardLeft,
          top: cardTop + (vertical ? 120 * u : 0),
          transform: `perspective(${1800 * u}px) rotateY(${(1 - swing) * 50 * side + Math.sin(f / 30) * 3}deg) translateY(${(1 - swing) * 200 * u}px)`,
          opacity: Math.min(1, swing * 1.5),
        }}
      >
        <PhotoCard card={{ src: scene.imageUrl || product?.imageUrl || "", title: product ? product.name : "", chip: product ? "TICKETS" : "", price: product?.priceText }} width={cw} height={ch} focus={focus} chipColor={PULSE.hot} />
        {scene.discount ? (
          <div style={{ position: "absolute", right: -70 * u, top: -70 * u }}>
            <DiscountBurst text={scene.discount} size={230 * u} color={pal.accent} delay={Math.round(beat * 1.5)} />
          </div>
        ) : null}
      </div>
      {vertical ? (
        <GlassCaption text={[scene.headline, scene.highlight].filter(Boolean).join(" ")} sub={scene.subtitle} delay={Math.round(beat * 1.5)} keywords={placeWords(spec)} bottom={height * 0.12} />
      ) : (
        <div style={{ position: "absolute", left: width * 0.06, width: width * 0.42, top: height * 0.5 }}>
          <Kinetic text={scene.headline} delay={Math.round(beat)} size={64 * u} maxWidth={width * 0.4} align="left" weight={800} />
          <Kinetic text={scene.highlight} delay={Math.round(beat * 1.5)} size={58 * u} maxWidth={width * 0.4} align="left" weight={800} color={pal.accent} />
          {scene.subtitle ? <div style={{ marginTop: 14 * u, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 30 * u, color: "rgba(255,255,255,0.85)", opacity: interpolate(f, [beat * 2, beat * 2.5], [0, 1], clamp) }}>{scene.subtitle}</div> : null}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Attraction B: full-screen punch-in photo with kinetic caption. */
const FullAttraction: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const product = scene.products[0];
  const zoom = interpolate(f, [0, 8, durationInFrames], [1.3, 1.14, 1.04], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pan = (useR(2) - 0.5) * 4;
  const price = useSpring(Math.round(beat * 2), { damping: 13 });
  return (
    <AbsoluteFill style={{ background: PULSE.navy }}>
      <SafeImg src={scene.imageUrl || product?.imageUrl || ""} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom}) translateX(${pan * (f / durationInFrames)}%)` }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,15,36,0.55) 0%, rgba(10,15,36,0.05) 35%, rgba(10,15,36,0.15) 55%, rgba(10,15,36,0.9) 100%)" }} />
      <CornerMarks />
      <div style={{ position: "absolute", top: (vertical ? 220 : 130) * u, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * u }}>
        {scene.tag ? <Chip bg={pal.accent} delay={2}>{upper(scene.tag)}</Chip> : null}
        {scene.location ? <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 30 * u, letterSpacing: 8 * u, color: "#FFFFFF", opacity: interpolate(f, [6, 14], [0, 0.9], clamp) }}>{upper(scene.location)}</div> : null}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: vertical ? height * 0.27 : height * 0.2, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Kinetic text={scene.headline} delay={6} size={(vertical ? 110 : 96) * u} maxWidth={width * 0.88} />
        <Kinetic text={scene.highlight} delay={6 + beat * 0.75} size={(vertical ? 96 : 84) * u} maxWidth={width * 0.88} color={pal.accent} />
      </div>
      {product ? (
        <div style={{ position: "absolute", right: 60 * u, top: vertical ? height * 0.42 : height * 0.3, transform: `translateX(${(1 - price) * 500 * u}px) rotate(${-4 * price}deg)`, opacity: price }}>
          <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 28 * u, padding: `${18 * u}px ${28 * u}px`, fontFamily: FONT_BODY, color: PULSE.navy, boxShadow: "0 24px 50px rgba(0,0,0,0.35)", maxWidth: 430 * u }}>
            <div style={{ fontSize: 22 * u, fontWeight: 600, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</div>
            <div style={{ fontSize: 52 * u, fontWeight: 900, color: PULSE.hot, lineHeight: 1.1 }}>{countUp(product.priceText, price)}</div>
          </div>
        </div>
      ) : null}
      {scene.discount ? (
        <div style={{ position: "absolute", left: 50 * u, top: vertical ? height * 0.36 : height * 0.25 }}>
          <DiscountBurst text={scene.discount} size={220 * u} color={pal.accent} delay={Math.round(beat * 1.5)} />
        </div>
      ) : null}
      <GlassCaption text={scene.subtitle} delay={Math.round(beat * 1.5)} keywords={placeWords(spec)} bottom={vertical ? height * 0.13 : 50 * u} />
    </AbsoluteFill>
  );
};

/** Caption: giant stacked words over a tilted photo card. */
const ShoutScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const card = useSpring(0, { damping: 15 });
  const tilt = (useR(3) - 0.5) * 14;
  const latin = isLatin(scene.headline);
  const words = upper(scene.headline).split(/\s+/).filter(Boolean);
  const lines = latin && words.length <= 4 ? words.map((w) => ({ text: w, color: "#FFFFFF" })) : [{ text: scene.headline, color: "#FFFFFF" }];
  if (scene.highlight) lines.push({ text: scene.highlight, color: pal.accent });
  const cw = vertical ? width * 0.7 : width * 0.36;
  const ch = vertical ? height * 0.5 : height * 0.72;
  return (
    <AbsoluteFill>
      <MeshBg />
      {scene.imageUrl ? (
        <div style={{ position: "absolute", left: (width - cw) / 2, top: (height - ch) / 2, width: cw, height: ch, borderRadius: 50 * u, overflow: "hidden", opacity: card * 0.8, transform: `rotate(${tilt * card}deg) scale(${0.8 + 0.2 * card})`, boxShadow: "0 40px 100px rgba(0,0,0,0.5)" }}>
          <SafeImg src={scene.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.2 - f * 0.001})` }} />
          <AbsoluteFill style={{ background: "rgba(10,15,36,0.4)" }} />
        </div>
      ) : null}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <StackWords lines={lines.slice(0, 4)} delay={2} gap={Math.max(6, Math.round(beat * 0.5))} maxWidth={width * 0.9} size={(vertical ? (latin ? 200 : 110) : latin ? 170 : 96) * u} />
      </AbsoluteFill>
      <GlassCaption text={scene.subtitle} delay={Math.round(beat * 2)} keywords={placeWords(spec)} />
    </AbsoluteFill>
  );
};

/** Deals: product cards in a 3D coverflow with a discount sticker. */
const DealsFlow: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const head = useSpring(2);
  const products = scene.products.slice(0, 4);
  const cities = unique(products.map((p) => p.city).filter(Boolean));
  const cw = vertical ? width * 0.55 : width * 0.22;
  const ch = vertical ? height * 0.39 : height * 0.52;
  const textW = width * 0.88;
  return (
    <AbsoluteFill>
      <MeshBg colors={[PULSE.hot, pal.blobs[1], pal.blobs[2], PULSE.orange]} />
      <GhostWord text={upper(cities[0] ?? "DEALS")} top={vertical ? height * 0.6 : height * 0.62} size={(vertical ? 330 : 280) * u} />
      <div style={{ position: "absolute", top: (vertical ? 150 : 50) * u, left: (width - textW) / 2, width: textW, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u, opacity: head, transform: `translateY(${(1 - head) * -40 * u}px)` }}>
        {cities.length ? <Chip bg={pal.accent}>{upper(cities.slice(0, 2).join(" · "))}</Chip> : null}
        <Kinetic text={scene.headline} delay={4} size={(vertical ? 84 : 64) * u} maxWidth={textW} stagger={1.2} maxLines={vertical ? 2 : 1} />
        <Kinetic text={scene.highlight} delay={10} size={(vertical ? 72 : 56) * u} maxWidth={textW} color={pal.accent} maxLines={1} />
      </div>
      {products.length ? <Coverflow cards={products.map((p) => productCard(p, upper(p.city || "TICKETS")))} top={vertical ? height * 0.38 : height * 0.36} cardW={cw} cardH={ch} step={Math.round(beat * 2)} chipColor={PULSE.hot} /> : null}
      {scene.discount ? (
        <div style={{ position: "absolute", right: (vertical ? 40 : 200) * u, top: vertical ? height * 0.34 : height * 0.3, zIndex: 200 }}>
          <DiscountBurst text={scene.discount} size={(vertical ? 250 : 220) * u} color={pal.accent} delay={Math.round(beat * 1.3)} />
        </div>
      ) : null}
      <GlassCaption text={scene.subtitle} delay={Math.round(beat * 2)} keywords={placeWords(spec)} bottom={vertical ? height * 0.13 : 34 * u} />
    </AbsoluteFill>
  );
};

/** App: a search panel types the city, results slide in, one gets booked. */
const AppPanel: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const products = scene.products.slice(0, vertical ? 5 : 4);
  const city = (scene.tag || products[0]?.city || "Bangkok").replace(/^@/, "");
  const panel = useSpring(10, { damping: 16 });
  const typeStart = 22;
  const typed = city.slice(0, Math.max(0, Math.floor((f - typeStart) / 2.5)));
  const listAt = typeStart + city.length * 2.5 + 6;
  const tapAt = Math.round(durationInFrames * 0.6);
  const toastAt = Math.round(durationInFrames * 0.72);
  const tapIndex = Math.min(products.length - 1, 1);
  const toast = useSpring(toastAt, { damping: 12 });
  const bgSrc = scene.imageUrl || products[0]?.imageUrl || "";
  const pw = vertical ? width - 140 * u : width * 0.5;
  const left = vertical ? 70 * u : width * 0.46;
  const top = vertical ? height * 0.33 : height * 0.12;
  return (
    <AbsoluteFill style={{ background: PULSE.navy }}>
      {bgSrc ? <SafeImg src={bgSrc} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(f, [0, durationInFrames], [1.5, 1.35])})`, filter: "blur(14px) brightness(0.5) saturate(1.3)" }} /> : <MeshBg />}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(10,15,36,0.6), ${rgba(PULSE.hot, 0.35)})` }} />
      <div style={{ position: "absolute", top: vertical ? 150 * u : height * 0.2, left: vertical ? 60 * u : 70 * u, width: vertical ? width - 120 * u : width * 0.36, display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start" }}>
        <Kinetic text={scene.headline} delay={4} size={(vertical ? 88 : 72) * u} maxWidth={vertical ? width - 120 * u : width * 0.36} align={vertical ? "center" : "left"} stagger={1.2} />
        <Kinetic text={scene.highlight} delay={10} size={(vertical ? 80 : 64) * u} maxWidth={vertical ? width - 120 * u : width * 0.36} align={vertical ? "center" : "left"} color={pal.accent} />
      </div>
      <div style={{ position: "absolute", left, top, width: pw, transform: `translateY(${(1 - panel) * 500 * u}px)`, opacity: panel, background: "rgba(255,255,255,0.97)", borderRadius: 44 * u, padding: 28 * u, boxShadow: "0 50px 100px rgba(0,0,0,0.45)", fontFamily: FONT_BODY }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 * u, background: "#F3F4F6", borderRadius: 24 * u, padding: `${18 * u}px ${24 * u}px` }}>
          <svg width={32 * u} height={32 * u} viewBox="0 0 24 24">
            <path fill={PULSE.hot} d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
          </svg>
          <span style={{ fontSize: 36 * u, fontWeight: 700, color: PULSE.navy }}>
            {typed}
            <span style={{ opacity: f % 16 < 8 ? 1 : 0, color: PULSE.hot }}>|</span>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 24 * u, fontWeight: 600, color: "#FFFFFF", background: PULSE.orange, padding: `${10 * u}px ${20 * u}px`, borderRadius: 16 * u }}>Search</span>
        </div>
        {products.map((p, i) => {
          const s = spring({ frame: f - listAt - i * 6, fps, config: { damping: 15 } });
          const tapped = i === tapIndex && f >= tapAt;
          const press = i === tapIndex ? interpolate(f, [tapAt - 2, tapAt, tapAt + 5], [1, 0.86, 1], clamp) : 1;
          const ripple = i === tapIndex ? interpolate(f, [tapAt, tapAt + 14], [0, 1], clamp) : 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 * u, marginTop: 20 * u, opacity: s, transform: `translateX(${(1 - s) * 300 * u}px)` }}>
              <div style={{ width: 150 * u, height: 104 * u, borderRadius: 20 * u, overflow: "hidden", flexShrink: 0, background: "#E5E7EB" }}>
                {p.imageUrl ? <SafeImg src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 28 * u, fontWeight: 700, color: PULSE.navy, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 24 * u, fontWeight: 800, color: PULSE.hot, marginTop: 4 * u }}>{p.priceText}</div>
              </div>
              <div style={{ position: "relative", flexShrink: 0, transform: `scale(${press})` }}>
                {ripple > 0 && ripple < 1 ? <div style={{ position: "absolute", left: "50%", top: "50%", width: 160 * u, height: 160 * u, marginLeft: -80 * u, marginTop: -80 * u, borderRadius: "50%", background: rgba(PULSE.hot, 0.35 * (1 - ripple)), transform: `scale(${ripple})` }} /> : null}
                <div style={{ position: "relative", fontSize: 24 * u, fontWeight: 700, color: tapped ? "#FFFFFF" : PULSE.hot, background: tapped ? PULSE.green : "transparent", border: `${3 * u}px solid ${tapped ? PULSE.green : PULSE.hot}`, padding: `${8 * u}px ${20 * u}px`, borderRadius: 16 * u }}>
                  {tapped ? "Booked ✓" : "Book"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: vertical ? height * 0.1 : 50 * u, display: "flex", justifyContent: "center", opacity: toast, transform: `translateY(${(1 - toast) * 80 * u}px) scale(${0.8 + 0.2 * toast})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 * u, background: PULSE.navy, border: `${3 * u}px solid ${pal.accent}`, borderRadius: 999, padding: `${14 * u}px ${32 * u}px`, fontFamily: FONT_BODY, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
          <div style={{ width: 22 * u, height: 22 * u, borderRadius: "50%", background: PULSE.green, boxShadow: `0 0 0 ${(8 + Math.sin(f / 4) * 6) * u}px rgba(22,163,74,0.3)` }} />
          <span style={{ fontSize: 32 * u, fontWeight: 800, color: "#FFFFFF" }}>Booked!</span>
          <span style={{ fontSize: 30 * u, fontWeight: 600, color: pal.accent }}>{products[tapIndex]?.city || city}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const WALLETS = [
  { name: "KBZPay", color: "#1F4FA3" },
  { name: "AYA Pay", color: "#D7262C" },
  { name: "Wave Pay", color: "#F5B400" },
  { name: "MMQR", color: "#1C6E4A" },
];

/** Payment: wallets pop in on the beat, then a success check. */
const PayScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const successAt = Math.round(durationInFrames * 0.55);
  const ring = interpolate(f, [beat, successAt], [0, 1], clamp);
  const ok = useSpring(successAt, { damping: 9 });
  const R = 150 * u;
  const circ = 2 * Math.PI * 88;
  return (
    <AbsoluteFill>
      <MeshBg colors={[PULSE.orange, PULSE.hot, pal.blobs[2], pal.accent]} />
      <div style={{ position: "absolute", top: (vertical ? 170 : 60) * u, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Kinetic text={scene.headline} delay={2} size={(vertical ? 88 : 72) * u} maxWidth={width * 0.86} stagger={1.2} />
        <Kinetic text={scene.highlight} delay={8} size={(vertical ? 80 : 64) * u} maxWidth={width * 0.86} color={pal.accent} />
      </div>
      <div style={{ position: "absolute", left: width / 2 - R, top: (vertical ? height * 0.36 : height * 0.36) - R * 0.2, width: R * 2, height: R * 2 }}>
        <svg viewBox="0 0 200 200" width={R * 2} height={R * 2} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx="100" cy="100" r="88" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="10" />
          <circle cx="100" cy="100" r="88" fill="none" stroke={f >= successAt ? PULSE.green : "#FFFFFF"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - ring)}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY }}>
          {f < successAt ? (
            <span style={{ fontSize: 54 * u, fontWeight: 900, color: "#FFFFFF", letterSpacing: 2 }}>MMQR</span>
          ) : (
            <div style={{ width: R * 1.4, height: R * 1.4, borderRadius: "50%", background: PULSE.green, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${ok})`, fontSize: 110 * u, color: "#FFFFFF", fontWeight: 900 }}>✓</div>
          )}
        </div>
      </div>
      <div style={{ position: "absolute", left: 60 * u, right: 60 * u, top: vertical ? height * 0.57 : height * 0.68, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22 * u }}>
        {WALLETS.map((w, i) => {
          const s = spring({ frame: f - beat * (0.5 + i * 0.5), fps, config: { damping: 10, mass: 0.6 } });
          return (
            <div key={w.name} style={{ display: "flex", alignItems: "center", gap: 14 * u, background: "rgba(255,255,255,0.95)", borderRadius: 999, padding: `${14 * u}px ${30 * u}px ${14 * u}px ${16 * u}px`, transform: `scale(${s}) rotate(${(1 - s) * (i % 2 ? 12 : -12)}deg)`, boxShadow: "0 16px 34px rgba(0,0,0,0.3)" }}>
              <div style={{ width: 40 * u, height: 40 * u, borderRadius: "50%", background: w.color }} />
              <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 34 * u, color: PULSE.navy }}>{w.name}</span>
            </div>
          );
        })}
      </div>
      <GlassCaption text={scene.subtitle} delay={Math.round(beat * 2.5)} keywords={["KBZPay", "AYA", "Wave", "MMQR"]} bottom={vertical ? height * 0.12 : 40 * u} />
    </AbsoluteFill>
  );
};

/** Outro: rotating rays, mascot, pulsing justym.me button and confetti. */
const CtaScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const { u, vertical, width, height, beat, pal } = useLayout(spec);
  const f = useCurrentFrame();
  const btn = useSpring(Math.round(beat * 1.6), { damping: 10 });
  const beatP = Math.exp(-(f % beat) / 3.5);
  const shine = interpolate((f - 40) % 60, [0, 25], [-120, 220], clamp);
  const rays = 18;
  const R = Math.max(width, height) * 1.4;
  const headline = scene.headline || "BOOK NOW";
  const mascot = (vertical ? 600 : 420) * u;
  return (
    <AbsoluteFill style={{ background: PULSE.hot, overflow: "hidden" }}>
      <RadialAt x={0.5} y={0.4} stops={[[pal.accent, 0], [PULSE.orange, 40], [PULSE.hot, 100]]} />
      <svg viewBox="-100 -100 200 200" width={R * 2} height={R * 2} style={{ position: "absolute", left: width / 2 - R, top: height * 0.42 - R, transform: `rotate(${f * 0.4}deg)`, opacity: 0.18 }}>
        {Array.from({ length: rays }, (_, k) => {
          const a0 = (k / rays) * Math.PI * 2;
          const a1 = a0 + (Math.PI * 2) / rays / 2.4;
          return <polygon key={k} fill="#FFFFFF" points={`0,0 ${100 * Math.cos(a0)},${100 * Math.sin(a0)} ${100 * Math.cos(a1)},${100 * Math.sin(a1)}`} />;
        })}
      </svg>
      <TopChip delay={2} />
      <div style={{ position: "absolute", top: (vertical ? 250 : 150) * u, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Kinetic text={upper(headline)} delay={4} size={(vertical ? 130 : 110) * u} maxWidth={width * 0.86} />
        <Kinetic text={scene.highlight} delay={4 + beat * 0.75} size={(vertical ? 60 : 50) * u} maxWidth={width * 0.8} weight={700} color={PULSE.navy} shadow={false} />
      </div>
      <div style={{ position: "absolute", width: mascot, height: mascot, left: width / 2 - mascot / 2 + (vertical ? 0 : width * 0.28), top: vertical ? height * 0.335 : height * 0.3, transform: `translateY(${Math.sin(f / 7) * 12 * u}px)` }}>
        <Mascot size={mascot} delay={6} style={{ left: 0, top: 0 }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? height * 0.67 : height * 0.62, display: "flex", justifyContent: "center", ...(vertical ? {} : { justifyContent: "flex-start", paddingLeft: width * 0.08 }) }}>
        <div style={{ position: "relative", overflow: "hidden", background: PULSE.navy, borderRadius: 999, padding: `${26 * u}px ${66 * u}px`, transform: `scale(${btn * (1 + beatP * 0.04)})`, boxShadow: "0 30px 60px rgba(0,0,0,0.35)", border: `${4 * u}px solid #FFFFFF` }}>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 900, fontSize: 90 * u, color: "#FFFFFF", letterSpacing: -1 }}>
            justym<span style={{ color: PULSE.orange }}>.me</span>
          </span>
          <div style={{ position: "absolute", top: -40 * u, bottom: -40 * u, width: 90 * u, left: `${shine}%`, transform: "skewX(-20deg)", background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))" }} />
        </div>
      </div>
      <GlassCaption text={scene.subtitle} delay={Math.round(beat * 2.5)} bottom={vertical ? height * 0.12 : 40 * u} />
      <Confetti at={Math.round(beat * 3)} />
    </AbsoluteFill>
  );
};

// ---------- whole-video layers (all templates) ----------

/** How strongly the picture "breathes" on each beat, per template. */
const PULSE_AMOUNT: Record<string, number> = { pulse: 0.014, calling: 0.01, flash: 0.012, neon: 0.012, journal: 0.005, cinematic: 0.004 };

/** Subtle zoom kick on every beat of the music. */
export const BeatPulse: React.FC<{ spec: VideoSpec; t: Template; children: React.ReactNode }> = ({ spec, t, children }) => {
  const f = useCurrentFrame();
  const bpm = musicBpm(spec.music);
  if (!bpm) return <AbsoluteFill>{children}</AbsoluteFill>;
  const beat = (FPS * 60) / bpm;
  const p = Math.exp(-(f % beat) / 3.5);
  return <AbsoluteFill style={{ transform: `scale(${1 + p * (PULSE_AMOUNT[t.id] ?? 0.008)})` }}>{children}</AbsoluteFill>;
};

/** Story-style segmented progress bar (one segment per scene). */
export const StoryProgress: React.FC<{ spec: VideoSpec; t: Template }> = ({ spec, t }) => {
  const f = useCurrentFrame();
  const u = useUnit();
  const { height } = useVideoConfig();
  const { cuts, total } = sceneTimeline(spec);
  const bounds = [0, ...cuts.slice(0, -1), total];
  const top = t.photo === "letterbox" ? height * 0.1 - 22 * u : 30 * u;
  const track = t.light ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.28)";
  const fill = t.light ? t.colors.text : "#FFFFFF";
  return (
    <div style={{ position: "absolute", top, left: 48 * u, right: 48 * u, display: "flex", gap: 10 * u, pointerEvents: "none" }}>
      {bounds.slice(0, -1).map((a, i) => (
        <div key={i} style={{ flex: 1, height: 7 * u, borderRadius: 4 * u, background: track, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${interpolate(f, [a, bounds[i + 1]], [0, 100], clamp)}%`, background: fill, borderRadius: 4 * u }} />
        </div>
      ))}
    </div>
  );
};

/** White flash on every cut, brighter on the signature moments (Pulse only). */
export const CutFlashes: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const { cuts, starts, total } = sceneTimeline(spec);
  let o = 0;
  cuts.slice(0, -1).forEach((c, i) => {
    const big = spec.scenes[i].transition === "signature" || i === 0;
    o = Math.max(o, interpolate(f, [c - 2, c, c + 7], [0, big ? 0.85 : 0.45, 0], clamp));
  });
  // Last flash as the outro's confetti pops.
  const pop = spec.scenes.at(-1)?.type === "outro" ? starts[starts.length - 1] + Math.round(beatFrames(spec) * 3) : total;
  if (pop < total) o = Math.max(o, interpolate(f, [pop - 2, pop, pop + 7], [0, 0.6, 0], clamp));
  return <AbsoluteFill style={{ background: "#FFFFFF", opacity: o, pointerEvents: "none" }} />;
};
