import React, { createContext, useContext, useState } from "react";
import { AbsoluteFill, Img as RemotionImg, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_HAND, FONT_SERIF, fontFor } from "./fonts";
import { ASSETS, type Product } from "./schema";
import { rand, TEMPLATES, type Template } from "./templates";

// ---------- template context ----------

type ThemeState = { t: Template; seed: number; index: number };
const ThemeContext = createContext<ThemeState>({ t: TEMPLATES.calling, seed: 0, index: 0 });
export const ThemeProvider = ThemeContext.Provider;
/** The active template, the video's seed and the current scene index. */
export const useTheme = () => useContext(ThemeContext);
/** Deterministic random number in [0,1) for this video + scene + slot. */
export function useRand(slot: number) {
  const { seed, index } = useTheme();
  return rand(seed + index * 7919, slot);
}

/** <Img> that waits longer and retries, so a slow image server doesn't fail a render. */
export const Img: React.FC<React.ComponentProps<typeof RemotionImg>> = (props) => (
  <RemotionImg delayRenderTimeoutInMilliseconds={60_000} delayRenderRetries={2} maxRetries={3} {...props} />
);

/** Scale factor: designs are made for a 1080px-wide (short side) frame. */
export function useUnit() {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
}

export function useIsVertical() {
  const { width, height } = useVideoConfig();
  return height > width;
}

/** 0 -> 1 spring that starts `delay` frames into the scene. */
export function useEnter(delay = 0, damping = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6 } });
}

/**
 * A radial gradient centred at (x, y) (fractions of the frame) that looks the
 * same in the preview and in the browser MP4 export. The exporter only draws
 * radial gradients centred in their element, so this puts a centred one on an
 * oversized layer. `stops` are [colour, percent], measured to the farthest
 * corner like CSS's default.
 */
export const RadialAt: React.FC<{ x: number; y: number; stops: [string, number][] }> = ({ x, y, stops }) => {
  const { width, height } = useVideoConfig();
  const cx = x * width;
  const cy = y * height;
  const r = Math.max(Math.hypot(cx, cy), Math.hypot(width - cx, cy), Math.hypot(cx, height - cy), Math.hypot(width - cx, height - cy));
  // A centred "circle" gradient reaches its square's corners at r * sqrt(2).
  const css = stops.map(([c, p]) => `${c} ${(p / Math.SQRT2).toFixed(2)}%`).join(", ");
  return <div style={{ position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, background: `radial-gradient(circle, ${css})`, pointerEvents: "none" }} />;
};

/** Whether text in this template sits on top of the photo (vs. on paper / a colour block). */
export const textOnPhoto = (t: Template) => t.photo === "fullbleed" || t.photo === "letterbox" || t.photo === "neon";

// ---------- photo treatments ----------

/** Slow push-in / pull-out / pan, chosen per scene from the seed. */
function useKenBurns() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const r = useRand(1);
  const p = interpolate(frame, [0, durationInFrames], [0, 1]);
  if (r < 0.3) return `scale(${1.04 + 0.1 * p})`;
  if (r < 0.55) return `scale(${1.14 - 0.1 * p})`;
  if (r < 0.78) return `scale(1.12) translateX(${(p - 0.5) * 5}%)`;
  return `scale(1.12) translateX(${(0.5 - p) * 5}%)`;
}

const Photo: React.FC<{ src: string; style?: React.CSSProperties; blur?: number }> = ({ src, style, blur = 0 }) => {
  const [failed, setFailed] = useState(false);
  const transform = useKenBurns();
  const { t } = useTheme();
  if (!src || failed) {
    return (
      <AbsoluteFill style={{ background: t.colors.bg, overflow: "hidden", ...style }}>
        <RadialAt x={0.3} y={0.2} stops={[[`${t.colors.primary}66`, 0], [t.colors.bg, 70]]} />
      </AbsoluteFill>
    );
  }
  return (
    <Img
      src={src}
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover", transform, filter: blur ? `blur(${blur}px)` : undefined, ...style }}
    />
  );
};

/**
 * The scene background in the template's photo style. `framed` scenes in the
 * journal/split templates show the photo as a polaroid / top half; other scenes
 * (payment, outro) use plain backgrounds of their own.
 */
export const SceneBackground: React.FC<{ src: string; dim?: number; blur?: number }> = ({ src, dim = 0.35, blur = 0 }) => {
  const { t } = useTheme();
  const { height } = useVideoConfig();
  const shade = (a: number) => `rgba(${t.colors.shade},${a})`;
  const gradient = `linear-gradient(180deg, ${shade(dim + 0.25)} 0%, ${shade(dim * 0.4)} 28%, ${shade(dim * 0.4)} 55%, ${shade(dim + 0.45)} 100%)`;

  if (t.photo === "polaroid") return <Paper />;

  if (t.photo === "split") {
    return (
      <AbsoluteFill style={{ backgroundColor: t.colors.bg }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: height * 0.58, overflow: "hidden", clipPath: "polygon(0 0, 100% 0, 100% 88%, 0 100%)" }}>
          <Photo src={src} blur={blur} />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${shade(0.35)} 0%, transparent 40%)` }} />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: t.colors.bg, overflow: "hidden" }}>
      <Photo src={src} blur={blur} />
      <AbsoluteFill style={{ background: gradient }} />
      {t.photo === "neon" ? (
        <>
          <AbsoluteFill style={{ background: `linear-gradient(135deg, ${t.colors.primary}55 0%, transparent 45%, ${t.colors.accent}44 100%)` }} />
          <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,0.65) 100%)" }} />
        </>
      ) : null}
      {t.photo === "letterbox" ? <Letterbox /> : null}
    </AbsoluteFill>
  );
};

/** Cinematic black bars. */
export const Letterbox: React.FC = () => {
  const { height } = useVideoConfig();
  const bar = height * 0.1;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
      <RadialAt x={0.5} y={0.45} stops={[["rgba(0,0,0,0)", 55], ["rgba(0,0,0,0.55)", 100]]} />
    </>
  );
};

/** Cream paper with a soft vignette (journal template). */
export const Paper: React.FC = () => {
  const { t } = useTheme();
  return (
    <AbsoluteFill style={{ backgroundColor: t.colors.bg }}>
      <RadialAt x={0.2} y={0.15} stops={[["rgba(255,255,255,0.7)", 0], ["rgba(255,255,255,0)", 40]]} />
      <RadialAt x={0.85} y={0.9} stops={[["rgba(201,160,110,0.25)", 0], ["rgba(201,160,110,0)", 45]]} />
    </AbsoluteFill>
  );
};

/** Tilted polaroid with tape (journal template). */
export const Polaroid: React.FC<{ src: string; width: number; height: number; style?: React.CSSProperties; delay?: number }> = ({
  src,
  width,
  height,
  style,
  delay = 0,
}) => {
  const u = useUnit();
  const t = useEnter(delay, 13);
  const tilt = (useRand(2) - 0.5) * 9;
  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        padding: `${20 * u}px ${20 * u}px ${80 * u}px`,
        background: "#FFFFFF",
        boxShadow: "0 18px 40px rgba(60,40,20,0.28)",
        transform: `translateY(${(1 - t) * -60 * u}px) rotate(${tilt + (1 - t) * 8}deg)`,
        opacity: t,
        ...style,
      }}
    >
      <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#ddd" }}>
        <Photo src={src} />
      </div>
      <div
        style={{
          position: "absolute",
          top: -22 * u,
          left: "50%",
          width: 170 * u,
          height: 46 * u,
          marginLeft: -85 * u,
          background: "rgba(255,214,170,0.75)",
          transform: "rotate(-3deg)",
        }}
      />
    </div>
  );
};

// ---------- brand ----------

export const Logo: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile(ASSETS.logo)} style={{ width: size, height: size, borderRadius: size * 0.08, ...style }} />
);

/** The logo in the top-right corner, styled per template. */
export const CornerLogo: React.FC = () => {
  const u = useUnit();
  const { t } = useTheme();
  const { height } = useVideoConfig();
  const top = t.photo === "letterbox" ? height * 0.1 + 24 * u : 56 * u;
  const style: React.CSSProperties = { position: "absolute", top, right: 48 * u };
  if (t.id === "journal") return <Logo size={104 * u} style={{ ...style, transform: "rotate(6deg)", boxShadow: "0 8px 18px rgba(60,40,20,0.25)" }} />;
  if (t.id === "neon") return <Logo size={92 * u} style={{ ...style, boxShadow: `0 0 26px ${t.colors.primary}, 0 0 6px ${t.colors.accent}` }} />;
  if (t.id === "cinematic") return <Logo size={80 * u} style={{ ...style, opacity: 0.92 }} />;
  return <Logo size={96 * u} style={{ ...style, boxShadow: "0 6px 24px rgba(0,0,0,0.3)" }} />;
};

// ---------- text ----------

export const Pill: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  bg,
  color,
  size = 34,
  style,
}) => {
  const u = useUnit();
  const { t } = useTheme();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12 * u,
        padding: `${size * 0.32 * u}px ${size * 0.9 * u}px`,
        borderRadius: t.id === "flash" ? 6 * u : 999,
        background: bg ?? t.colors.primary,
        color: color ?? (t.light ? "#FFFFFF" : t.id === "cinematic" ? "#111" : "#FFFFFF"),
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize: size * u,
        letterSpacing: "0.02em",
        boxShadow: t.id === "neon" ? `0 0 22px ${t.colors.primary}` : "0 8px 24px rgba(0,0,0,0.25)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Text-shadow glow for the neon template. */
const glow = (c: string, u: number) => `0 0 ${6 * u}px ${c}, 0 0 ${18 * u}px ${c}, 0 0 ${40 * u}px ${c}`;

/** Flicker-on opacity for neon text. */
function useFlicker(delay: number) {
  const f = useCurrentFrame() - delay;
  if (f < 0) return 0;
  const pattern = [1, 0, 1, 1, 0, 0, 1, 0.4, 1];
  return f < pattern.length ? pattern[f] : 1;
}

/**
 * Kinetic text: animates word by word.
 *  rise    - each word slides up out of a mask
 *  blur    - each word fades in from a blur
 *  flicker - each word flickers on like neon
 *  slam    - each word slams in from big to normal size
 *  write   - the whole line is revealed left to right, like handwriting
 */
export const Words: React.FC<{ text: string; delay?: number; mode: "rise" | "blur" | "flicker" | "slam" | "write"; stagger?: number; style?: React.CSSProperties }> = ({
  text,
  delay = 0,
  mode,
  stagger = 3,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text) return null;
  if (mode === "write") {
    const p = interpolate(frame - delay, [0, Math.max(10, text.length * 0.9)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <span style={{ display: "inline-block", clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)`, ...style }}>{text}</span>;
  }
  const parts = text.split(/(\s+)/);
  let w = -1;
  return (
    <span style={style}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
        w++;
        const d = delay + w * stagger;
        const e = spring({ frame: frame - d, fps, config: { damping: mode === "slam" ? 11 : 15, mass: 0.6 } });
        if (mode === "rise") {
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - e) * 110}%)` }}>{part}</span>
            </span>
          );
        }
        if (mode === "blur") {
          return <span key={i} style={{ display: "inline-block", opacity: e, filter: `blur(${(1 - e) * 10}px)`, transform: `translateY(${(1 - e) * 12}px)` }}>{part}</span>;
        }
        if (mode === "flicker") {
          const f = frame - d;
          const pattern = [0, 1, 0, 0, 1, 0.5, 1];
          const o = f < 0 ? 0 : f < pattern.length ? pattern[f] : 1;
          return <span key={i} style={{ display: "inline-block", opacity: o }}>{part}</span>;
        }
        return <span key={i} style={{ display: "inline-block", opacity: Math.min(1, e * 2), transform: `scale(${1.8 - 0.8 * e})` }}>{part}</span>;
      })}
    </span>
  );
};

/** "฿1,050" counting up from 0 as `progress` goes 0 -> 1. */
export function countUp(priceText: string, progress: number) {
  const m = priceText.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return priceText;
  const value = Number(m[2].replace(/,/g, ""));
  const current = Math.round(value * Math.min(1, Math.max(0, progress)));
  return `${m[1]}${current.toLocaleString("en-US")}${m[3]}`;
}

/** Headline + highlight + subtitle, styled by the template. */
export const Caption: React.FC<{
  headline: string;
  highlight: string;
  subtitle?: string;
  size?: number;
  align?: "center" | "left";
  delay?: number;
  onPhoto?: boolean;
}> = ({ headline, highlight, subtitle, size = 64, align = "center", delay = 0, onPhoto = true }) => {
  const u = useUnit();
  const { t } = useTheme();
  const a = useEnter(delay, t.caption === "elegant" ? 28 : 14);
  const b = useEnter(delay + (t.caption === "elegant" ? 9 : 5), t.caption === "elegant" ? 28 : 14);
  const c = useEnter(delay + 12);
  const rise = (v: number, d = 40): React.CSSProperties => ({ opacity: v, transform: `translateY(${(1 - v) * d * u}px)` });
  const textColor = onPhoto && t.light ? "#FFFFFF" : t.colors.text;
  const shadow = onPhoto ? "0 4px 18px rgba(0,0,0,0.55)" : undefined;
  const headlineFont = fontFor(t.fonts.headline);

  const sub = subtitle ? (
    <div style={{ ...rise(c, 20), color: textColor, fontFamily: FONT_BODY, fontWeight: 500, fontStyle: "italic", fontSize: size * 0.46 * u, marginTop: 12 * u, opacity: c * 0.9, textShadow: shadow }}>
      {subtitle}
    </div>
  ) : null;

  if (t.caption === "elegant") {
    return (
      <div style={{ textAlign: align, fontFamily: headlineFont, color: textColor, textShadow: shadow, lineHeight: 1.25 }}>
        {headline ? <div style={{ fontWeight: 600, fontSize: size * 0.82 * u, letterSpacing: "0.01em" }}><Words text={headline} delay={delay} mode="blur" stagger={4} /></div> : null}
        {highlight ? (
          <>
            <div style={{ width: 120 * u * a, height: 2 * u, background: t.colors.primary, margin: `${16 * u}px ${align === "center" ? "auto" : "0"}` }} />
            <div style={{ fontWeight: 600, fontStyle: "italic", fontSize: size * 0.78 * u, color: t.colors.primary }}><Words text={highlight} delay={delay + 10} mode="blur" stagger={4} /></div>
          </>
        ) : null}
        {sub}
      </div>
    );
  }

  if (t.caption === "handwritten") {
    return (
      <div style={{ textAlign: align, fontFamily: headlineFont, color: textColor, lineHeight: 1.1, transform: "rotate(-1.5deg)" }}>
        {headline ? <div style={{ fontWeight: 700, fontSize: size * 1.15 * u }}><Words text={headline} delay={delay} mode="write" /></div> : null}
        {highlight ? (
          <div style={{ ...rise(b), marginTop: 6 * u }}>
            <span
              style={{
                display: "inline-block",
                fontWeight: 700,
                fontSize: size * 1.1 * u,
                padding: `0 ${14 * u}px`,
                background: `linear-gradient(180deg, transparent 52%, ${t.colors.primary}aa 52%, ${t.colors.primary}aa 92%, transparent 92%)`,
              }}
            >
              {highlight}
            </span>
          </div>
        ) : null}
        {subtitle ? (
          <div style={{ ...rise(c, 20), fontFamily: FONT_BODY, fontWeight: 500, fontSize: size * 0.42 * u, marginTop: 14 * u, color: t.colors.muted }}>{subtitle}</div>
        ) : null}
      </div>
    );
  }

  if (t.caption === "neon") {
    return (
      <div style={{ textAlign: align, fontFamily: headlineFont, lineHeight: 1.05, textTransform: "uppercase" }}>
        {headline ? (
          <div style={{ fontSize: size * 1.25 * u, color: "#FFFFFF", textShadow: glow(t.colors.primary, u), letterSpacing: "0.03em" }}><Words text={headline} delay={delay} mode="flicker" stagger={4} /></div>
        ) : null}
        {highlight ? (
          <div style={{ fontSize: size * 1.25 * u, color: t.colors.accent, textShadow: glow(t.colors.accent, u), letterSpacing: "0.03em" }}><Words text={highlight} delay={delay + 8} mode="flicker" stagger={4} /></div>
        ) : null}
        {subtitle ? (
          <div style={{ ...rise(c, 20), textTransform: "none", fontFamily: FONT_BODY, fontWeight: 500, fontSize: size * 0.44 * u, marginTop: 12 * u, color: "#FFFFFF", textShadow: shadow }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    );
  }

  if (t.caption === "blocky") {
    const slideIn = (v: number): React.CSSProperties => ({ opacity: v, transform: `translateX(${(1 - v) * -80 * u}px) skewX(${(1 - v) * -12}deg)` });
    const block = (bg: string, color: string): React.CSSProperties => ({
      display: "inline-block",
      background: bg,
      color,
      padding: `${4 * u}px ${18 * u}px`,
      fontFamily: headlineFont,
      fontSize: size * 1.05 * u,
      lineHeight: 1.15,
      textTransform: "uppercase",
    });
    return (
      <div style={{ textAlign: align }}>
        {headline ? (
          <div style={slideIn(a)}>
            <span style={block("#111111", "#FFC83D")}><Words text={headline} delay={delay + 2} mode="slam" stagger={3} /></span>
          </div>
        ) : null}
        {highlight ? (
          <div style={{ ...slideIn(b), marginTop: 8 * u }}>
            <span style={block(t.colors.accent, "#111111")}>{highlight}</span>
          </div>
        ) : null}
        {subtitle ? (
          <div style={{ ...rise(c, 20), fontFamily: FONT_BODY, fontWeight: 700, fontSize: size * 0.44 * u, marginTop: 14 * u, color: onPhoto ? "#FFFFFF" : "#111111", textShadow: shadow }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    );
  }

  // twoTone (classic Just YM)
  return (
    <div style={{ textAlign: align, fontFamily: headlineFont, textShadow: shadow, lineHeight: 1.25 }}>
      {headline ? <div style={{ color: textColor, fontWeight: 800, fontSize: size * u }}><Words text={headline} delay={delay} mode="rise" stagger={3} /></div> : null}
      {highlight ? (
        <div style={{ position: "relative", display: "inline-block", color: t.colors.primary, fontWeight: 800, fontSize: size * u }}>
          <Words text={highlight} delay={delay + 6} mode="rise" stagger={3} />
          <div style={{ position: "absolute", left: 0, bottom: -4 * u, height: 8 * u, width: `${b * 100}%`, borderRadius: 999, background: t.colors.primary, opacity: 0.9, boxShadow: shadow }} />
        </div>
      ) : null}
      {sub}
    </div>
  );
};

/** Attraction name + location, styled by the template. */
export const Tag: React.FC<{ tag: string; location: string; onPhoto?: boolean; align?: "center" | "left" }> = ({ tag, location, onPhoto = true, align = "center" }) => {
  const u = useUnit();
  const { t } = useTheme();
  const enter = useEnter(2, 12);
  const flicker = useFlicker(4);
  if (!tag && !location) return null;
  const light = onPhoto ? "#FFFFFF" : t.colors.text;
  const locStyle: React.CSSProperties = { marginTop: 14 * u, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 26 * u, letterSpacing: "0.28em", color: light, textShadow: onPhoto ? "0 2px 10px rgba(0,0,0,0.6)" : undefined };
  const wrap: React.CSSProperties = { textAlign: align, opacity: enter, transform: `translateY(${(1 - enter) * -30 * u}px)` };

  if (t.tag === "rule") {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 * u, fontFamily: FONT_SERIF, fontWeight: 600, fontSize: 34 * u, letterSpacing: "0.22em", color: t.colors.primary }}>
          <span style={{ width: 70 * u * enter, height: 2 * u, background: t.colors.primary }} />
          {tag}
          <span style={{ width: 70 * u * enter, height: 2 * u, background: t.colors.primary }} />
        </div>
        {location ? <div style={{ ...locStyle, fontFamily: FONT_SERIF, fontStyle: "italic", letterSpacing: "0.08em", fontWeight: 600 }}>{location}</div> : null}
      </div>
    );
  }
  if (t.tag === "stamp") {
    return (
      <div style={{ ...wrap, transform: `rotate(-6deg) scale(${0.6 + 0.4 * enter})` }}>
        {tag ? (
          <div style={{ display: "inline-block", padding: `${10 * u}px ${26 * u}px`, border: `${5 * u}px solid ${t.colors.accent}`, borderRadius: 14 * u, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30 * u, letterSpacing: "0.12em", color: t.colors.accent }}>
            {tag}
          </div>
        ) : null}
        {location ? <div style={{ marginTop: 6 * u, fontFamily: FONT_HAND, fontWeight: 700, fontSize: 44 * u, color: t.colors.text }}>📍 {location.replace(/^@/, "")}</div> : null}
      </div>
    );
  }
  if (t.tag === "outline") {
    return (
      <div style={{ ...wrap, opacity: flicker }}>
        {tag ? (
          <div style={{ display: "inline-block", padding: `${10 * u}px ${30 * u}px`, borderRadius: 999, border: `${3 * u}px solid ${t.colors.primary}`, boxShadow: `0 0 18px ${t.colors.primary}, inset 0 0 12px ${t.colors.primary}`, fontFamily: fontFor("bebas"), fontSize: 44 * u, letterSpacing: "0.08em", color: "#FFFFFF", textShadow: glow(t.colors.primary, u * 0.6) }}>
            {tag}
          </div>
        ) : null}
        {location ? <div style={{ ...locStyle, color: t.colors.accent, textShadow: glow(t.colors.accent, u * 0.4) }}>{location}</div> : null}
      </div>
    );
  }
  if (t.tag === "block") {
    return (
      <div style={{ ...wrap, transform: `translateX(${(1 - enter) * -120 * u}px)` }}>
        {tag ? <div style={{ display: "inline-block", background: "#111111", color: "#FFC83D", padding: `${8 * u}px ${24 * u}px`, fontFamily: fontFor("impact"), fontSize: 44 * u, letterSpacing: "0.04em" }}>{tag}</div> : null}
        {location ? <div style={{ ...locStyle, color: "#FFFFFF" }}>{location}</div> : null}
      </div>
    );
  }
  return (
    <div style={wrap}>
      {tag ? <Pill size={36}>{tag}</Pill> : null}
      {location ? <div style={locStyle}>{location}</div> : null}
    </div>
  );
};

// ---------- price cards ----------

/** Big price card for one product, styled by the template. */
export const ProductCard: React.FC<{ product: Product; discount?: string; delay?: number; width?: number; from?: "left" | "right" }> = ({ product, discount, delay = 8, width = 620, from = "left" }) => {
  const u = useUnit();
  const { t } = useTheme();
  const enter = useEnter(delay, 12);
  const badge = useEnter(delay + 10, 9);
  const frame = useCurrentFrame();
  const priceProgress = interpolate(frame - delay - 4, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const motion: React.CSSProperties = { position: "relative", transform: `translateX(${(1 - enter) * (from === "left" ? -120 : 120) * u}px) scale(${0.85 + 0.15 * enter})`, opacity: enter };

  const base: React.CSSProperties = {
    position: "relative",
    width: width * u,
    display: "flex",
    gap: 22 * u,
    padding: 20 * u,
    fontFamily: FONT_BODY,
    color: t.colors.cardText,
    background: t.colors.cardBg,
    borderRadius: 28 * u,
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
  };
  if (t.card === "glass") Object.assign(base, { border: `${1.5 * u}px solid rgba(233,196,106,0.55)`, borderRadius: 6 * u, boxShadow: "0 18px 50px rgba(0,0,0,0.5)" });
  if (t.card === "neon") Object.assign(base, { border: `${3 * u}px solid ${t.colors.primary}`, borderRadius: 22 * u, boxShadow: `0 0 26px ${t.colors.primary}88, inset 0 0 18px ${t.colors.primary}55` });
  if (t.card === "ticket") Object.assign(base, { borderRadius: 16 * u, boxShadow: "0 14px 30px rgba(60,40,20,0.25)", border: `${2 * u}px solid rgba(43,33,24,0.12)` });
  if (t.card === "tag") Object.assign(base, { borderRadius: 10 * u, transform: "rotate(-2deg)", boxShadow: "8px 10px 0 #111111" });

  const priceFont = t.card === "glass" ? FONT_SERIF : t.card === "neon" ? fontFor("bebas") : t.card === "tag" ? fontFor("impact") : FONT_BODY;
  const price = product.priceText ? (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 * u, marginTop: 6 * u }}>
      <span style={{ fontSize: 20 * u, opacity: 0.65, fontWeight: 500 }}>From</span>
      <span style={{ fontFamily: priceFont, fontSize: (t.card === "neon" || t.card === "tag" ? 56 : 46) * u, fontWeight: 800, color: t.colors.price, textShadow: t.card === "neon" ? glow(t.colors.price, u * 0.5) : undefined }}>
        {countUp(product.priceText, priceProgress)}
      </span>
    </div>
  ) : null;

  return (
    <div style={motion}>
      <div style={base}>
        <Img src={product.imageUrl} style={{ width: 190 * u, height: 150 * u, objectFit: "cover", borderRadius: (t.card === "glass" ? 2 : 16) * u, flexShrink: 0 }} />
        {t.card === "ticket" ? (
          <div style={{ position: "relative", width: 0, borderLeft: `${3 * u}px dashed rgba(43,33,24,0.3)`, margin: `-${20 * u}px 0` }}>
            <span style={{ position: "absolute", top: -14 * u, left: -17 * u, width: 30 * u, height: 30 * u, borderRadius: "50%", background: t.colors.bg }} />
            <span style={{ position: "absolute", bottom: -14 * u, left: -17 * u, width: 30 * u, height: 30 * u, borderRadius: "50%", background: t.colors.bg }} />
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
          {product.city ? <div style={{ fontSize: 20 * u, opacity: 0.65, fontWeight: 500 }}>{t.card === "ticket" ? "ADMIT ONE · " : "📍 "}{product.city}</div> : null}
          <div style={{ fontFamily: t.card === "glass" ? FONT_SERIF : FONT_BODY, fontSize: 30 * u, fontWeight: 800, lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.name}
          </div>
          {price}
          <div style={{ fontSize: 19 * u, color: t.light || t.card === "white" ? "#16A34A" : "#4ADE80", fontWeight: 700, marginTop: 4 * u }}>✓ Instant confirmation</div>
        </div>
      </div>
      {discount ? (
        <div
          style={{
            position: "absolute",
            top: -22 * u,
            right: -16 * u,
            background: t.id === "neon" ? t.colors.accent : "#E8352B",
            color: t.id === "neon" ? "#07040F" : "#FFFFFF",
            fontWeight: 800,
            fontFamily: FONT_BODY,
            fontSize: 26 * u,
            padding: `${8 * u}px ${18 * u}px`,
            borderRadius: 14 * u,
            transform: `rotate(-6deg) scale(${badge})`,
            boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
          }}
        >
          {discount}
        </div>
      ) : null}
    </div>
  );
};

/** Small card for the deals grid, styled by the template. */
export const MiniCard: React.FC<{ product: Product; delay: number; index: number }> = ({ product, delay, index }) => {
  const u = useUnit();
  const { t } = useTheme();
  const enter = useEnter(delay, 11);
  const tilt = t.id === "journal" ? (index % 2 ? 4 : -3) : t.id === "flash" ? (index % 2 ? -2 : 2) : 0;
  const frameStyle: React.CSSProperties =
    t.card === "neon"
      ? { border: `${3 * u}px solid ${index % 2 ? t.colors.accent : t.colors.primary}`, boxShadow: `0 0 22px ${index % 2 ? t.colors.accent : t.colors.primary}77` }
      : t.card === "glass"
        ? { border: `${1.5 * u}px solid rgba(233,196,106,0.5)` }
        : t.card === "tag"
          ? { boxShadow: "8px 10px 0 #111111" }
          : t.card === "ticket"
            ? { padding: 12 * u, paddingBottom: 0, boxShadow: "0 12px 26px rgba(60,40,20,0.25)" }
            : { boxShadow: "0 14px 40px rgba(0,0,0,0.35)" };
  return (
    <div
      style={{
        width: 420 * u,
        background: t.colors.cardBg,
        color: t.colors.cardText,
        borderRadius: (t.card === "glass" || t.card === "tag" ? 6 : 24) * u,
        overflow: "hidden",
        fontFamily: FONT_BODY,
        transform: `translateY(${(1 - enter) * 80 * u}px) scale(${0.8 + 0.2 * enter}) rotate(${tilt}deg)`,
        opacity: enter,
        ...frameStyle,
      }}
    >
      <Img src={product.imageUrl} style={{ width: "100%", height: 230 * u, objectFit: "cover", display: "block" }} />
      <div style={{ padding: `${14 * u}px ${18 * u}px ${18 * u}px` }}>
        <div style={{ fontFamily: t.card === "glass" ? FONT_SERIF : FONT_BODY, fontSize: 24 * u, fontWeight: 700, lineHeight: 1.2, height: 58 * u, overflow: "hidden" }}>{product.name}</div>
        {product.priceText ? (
          <div style={{ fontSize: 34 * u, fontWeight: 800, color: t.colors.price, marginTop: 4 * u }}>
            <span style={{ fontSize: 18 * u, opacity: 0.65, fontWeight: 500, color: t.colors.cardText }}>From </span>
            {product.priceText}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Round "UP TO 63% OFF" sticker (a starburst in the flash template). */
export const DiscountSticker: React.FC<{ text: string; delay?: number; size?: number }> = ({ text, delay = 20, size = 230 }) => {
  const u = useUnit();
  const { t } = useTheme();
  const enter = useEnter(delay, 8);
  const frame = useCurrentFrame();
  const [lead, ...rest] = text.split(/\s(?=\d)/);
  const big = rest.length ? rest.join(" ") : lead;
  const star = "polygon(50% 0%, 61% 12%, 77% 6%, 80% 22%, 96% 25%, 90% 40%, 100% 52%, 88% 62%, 93% 78%, 76% 79%, 70% 95%, 56% 87%, 44% 100%, 34% 87%, 19% 94%, 17% 78%, 2% 74%, 9% 60%, 0% 47%, 11% 37%, 6% 21%, 22% 20%, 26% 5%, 40% 12%)";
  const look: React.CSSProperties =
    t.id === "flash"
      ? { background: "#E8352B", color: "#FFFFFF", clipPath: star }
      : t.id === "neon"
        ? { background: "#07040F", color: t.colors.accent, border: `${4 * u}px solid ${t.colors.accent}`, boxShadow: `0 0 30px ${t.colors.accent}`, borderRadius: "50%" }
        : t.id === "cinematic"
          ? { background: "linear-gradient(135deg, #F3D98B, #C89116)", color: "#111", borderRadius: "50%", fontFamily: FONT_SERIF }
          : t.id === "journal"
            ? { background: "transparent", color: "#C0392B", border: `${6 * u}px double #C0392B`, borderRadius: "50%" }
            : { background: `radial-gradient(circle, #FFD34D 0%, ${t.colors.primary} 72%)`, color: "#B3261E", border: `${6 * u}px solid #FFFFFF`, borderRadius: "50%" };
  return (
    <div
      style={{
        width: size * u,
        height: size * u,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_BODY,
        fontWeight: 800,
        textAlign: "center",
        lineHeight: 1,
        transform: `scale(${enter}) rotate(${-12 + Math.sin(frame / 8) * 3}deg)`,
        boxShadow: t.id === "flash" || t.id === "journal" ? undefined : "0 14px 40px rgba(0,0,0,0.35)",
        ...look,
      }}
    >
      {rest.length ? <div style={{ fontSize: size * 0.13 * u }}>{lead}</div> : null}
      <div style={{ fontSize: size * 0.24 * u }}>{big}</div>
    </div>
  );
};

/** "*Prices shown on justym.me ..." line at the very bottom. */
export const PriceNote: React.FC<{ text: string; onPhoto?: boolean }> = ({ text, onPhoto = true }) => {
  const u = useUnit();
  const { t } = useTheme();
  const { height } = useVideoConfig();
  if (!text) return null;
  const dark = !onPhoto && t.light;
  return (
    <div
      style={{
        position: "absolute",
        bottom: t.photo === "letterbox" ? height * 0.1 + 10 * u : 26 * u,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT_BODY,
        fontSize: 18 * u,
        color: dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.75)",
        textShadow: dark ? undefined : "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      {text}
    </div>
  );
};

/** The Just YM mascot, waving its arm. */
export const Mascot: React.FC<{ size: number; style?: React.CSSProperties; delay?: number }> = ({ size, style, delay = 0 }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(delay, 10);
  const wave = Math.sin((frame - delay) / 4.5) * 14;
  return (
    <div style={{ position: "absolute", width: size, height: size, transform: `translateY(${(1 - enter) * size * 0.6}px)`, opacity: enter, ...style }}>
      <Img src={staticFile(ASSETS.mascotBody)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <Img
        src={staticFile(ASSETS.mascotArm)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transformOrigin: "80% 22%", transform: `rotate(${wave}deg)` }}
      />
    </div>
  );
};

export { glow, useFlicker };
