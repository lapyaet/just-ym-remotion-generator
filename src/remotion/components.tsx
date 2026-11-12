import React, { useState } from "react";
import { AbsoluteFill, Img as RemotionImg, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY } from "./fonts";
import { ASSETS, BRAND, type Product } from "./schema";

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

/** Full-screen photo with a slow push-in and top/bottom shading for text. */
export const PhotoBackground: React.FC<{ src: string; dim?: number; blur?: number }> = ({ src, dim = 0.35, blur = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const [failed, setFailed] = useState(false);
  const scale = interpolate(frame, [0, durationInFrames], [1.04, 1.14]);
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.ink }}>
      {src && !failed ? (
        <Img
          src={src}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, filter: blur ? `blur(${blur}px)` : undefined }}
        />
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, ${BRAND.orange}55, ${BRAND.ink} 70%)` }} />
      )}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${dim + 0.25}) 0%, rgba(0,0,0,${dim * 0.4}) 28%, rgba(0,0,0,${dim * 0.4}) 55%, rgba(0,0,0,${dim + 0.4}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Logo: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img
    src={staticFile(ASSETS.logo)}
    style={{ width: size, height: size, borderRadius: size * 0.08, boxShadow: "0 6px 24px rgba(0,0,0,0.3)", ...style }}
  />
);

/** The small logo tile in the top-right corner, as in every Just YM reel. */
export const CornerLogo: React.FC = () => {
  const u = useUnit();
  return <Logo size={96 * u} style={{ position: "absolute", top: 56 * u, right: 48 * u }} />;
};

export const Pill: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  bg = BRAND.orange,
  color = BRAND.white,
  size = 34,
  style,
}) => {
  const u = useUnit();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12 * u,
        padding: `${size * 0.32 * u}px ${size * 0.9 * u}px`,
        borderRadius: 999,
        background: bg,
        color,
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize: size * u,
        letterSpacing: "0.02em",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** White line + orange line + small subtitle, the standard reel caption. */
export const Caption: React.FC<{
  headline: string;
  highlight: string;
  subtitle?: string;
  size?: number;
  align?: "center" | "left";
  delay?: number;
}> = ({ headline, highlight, subtitle, size = 64, align = "center", delay = 0 }) => {
  const u = useUnit();
  const a = useEnter(delay);
  const b = useEnter(delay + 5);
  const c = useEnter(delay + 10);
  const line = (t: number): React.CSSProperties => ({ opacity: t, transform: `translateY(${(1 - t) * 40 * u}px)` });
  const shadow = "0 4px 18px rgba(0,0,0,0.55)";
  return (
    <div style={{ textAlign: align, fontFamily: FONT_BODY, textShadow: shadow, lineHeight: 1.25 }}>
      {headline ? (
        <div style={{ ...line(a), color: BRAND.white, fontWeight: 800, fontSize: size * u }}>{headline}</div>
      ) : null}
      {highlight ? (
        <div style={{ ...line(b), color: BRAND.orange, fontWeight: 800, fontSize: size * u }}>{highlight}</div>
      ) : null}
      {subtitle ? (
        <div style={{ ...line(c), color: BRAND.white, fontWeight: 500, fontStyle: "italic", fontSize: size * 0.48 * u, marginTop: 10 * u, opacity: c * 0.92 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};

/** Big white-card price tag for one product. */
export const ProductCard: React.FC<{ product: Product; discount?: string; delay?: number; width?: number }> = ({
  product,
  discount,
  delay = 8,
  width = 620,
}) => {
  const u = useUnit();
  const t = useEnter(delay, 12);
  const badge = useEnter(delay + 10, 9);
  return (
    <div
      style={{
        position: "relative",
        width: width * u,
        display: "flex",
        gap: 22 * u,
        padding: 20 * u,
        background: BRAND.white,
        borderRadius: 28 * u,
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        fontFamily: FONT_BODY,
        transform: `translateX(${(1 - t) * -120 * u}px) scale(${0.85 + 0.15 * t})`,
        opacity: t,
      }}
    >
      <Img src={product.imageUrl} style={{ width: 190 * u, height: 150 * u, objectFit: "cover", borderRadius: 18 * u, flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        {product.city ? <div style={{ fontSize: 20 * u, color: "#8a8178", fontWeight: 500 }}>📍 {product.city}</div> : null}
        <div style={{ fontSize: 30 * u, fontWeight: 800, color: BRAND.ink, lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {product.name}
        </div>
        {product.priceText ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 * u, marginTop: 6 * u }}>
            <span style={{ fontSize: 20 * u, color: "#8a8178", fontWeight: 500 }}>From</span>
            <span style={{ fontSize: 46 * u, fontWeight: 800, color: BRAND.orangeDeep }}>{product.priceText}</span>
          </div>
        ) : null}
        <div style={{ fontSize: 19 * u, color: BRAND.green, fontWeight: 700, marginTop: 4 * u }}>✓ Instant confirmation</div>
      </div>
      {discount ? (
        <div
          style={{
            position: "absolute",
            top: -22 * u,
            right: -16 * u,
            background: "#E8352B",
            color: BRAND.white,
            fontWeight: 800,
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

/** Small card for the deals grid. */
export const MiniCard: React.FC<{ product: Product; delay: number }> = ({ product, delay }) => {
  const u = useUnit();
  const t = useEnter(delay, 11);
  return (
    <div
      style={{
        width: 420 * u,
        background: BRAND.white,
        borderRadius: 24 * u,
        overflow: "hidden",
        boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
        fontFamily: FONT_BODY,
        transform: `translateY(${(1 - t) * 80 * u}px) scale(${0.8 + 0.2 * t})`,
        opacity: t,
      }}
    >
      <Img src={product.imageUrl} style={{ width: "100%", height: 230 * u, objectFit: "cover" }} />
      <div style={{ padding: `${14 * u}px ${18 * u}px ${18 * u}px` }}>
        <div style={{ fontSize: 24 * u, fontWeight: 700, color: BRAND.ink, lineHeight: 1.2, height: 58 * u, overflow: "hidden" }}>{product.name}</div>
        {product.priceText ? (
          <div style={{ fontSize: 34 * u, fontWeight: 800, color: BRAND.orangeDeep, marginTop: 4 * u }}>
            <span style={{ fontSize: 18 * u, color: "#8a8178", fontWeight: 500 }}>From </span>
            {product.priceText}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Round "UP TO 63% OFF" sticker. */
export const DiscountSticker: React.FC<{ text: string; delay?: number; size?: number }> = ({ text, delay = 20, size = 230 }) => {
  const u = useUnit();
  const t = useEnter(delay, 8);
  const frame = useCurrentFrame();
  const [lead, ...rest] = text.split(/\s(?=\d)/);
  const big = rest.length ? rest.join(" ") : lead;
  return (
    <div
      style={{
        width: size * u,
        height: size * u,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, #FFD34D, ${BRAND.orange})`,
        border: `${6 * u}px solid ${BRAND.white}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_BODY,
        color: "#B3261E",
        fontWeight: 800,
        textAlign: "center",
        lineHeight: 1,
        transform: `scale(${t}) rotate(${-12 + Math.sin(frame / 8) * 3}deg)`,
        boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
      }}
    >
      {rest.length ? <div style={{ fontSize: size * 0.13 * u }}>{lead}</div> : null}
      <div style={{ fontSize: size * 0.24 * u }}>{big}</div>
    </div>
  );
};

/** "*Prices shown on justym.me ..." line at the very bottom. */
export const PriceNote: React.FC<{ text: string }> = ({ text }) => {
  const u = useUnit();
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 26 * u,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT_BODY,
        fontSize: 18 * u,
        color: "rgba(255,255,255,0.75)",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      {text}
    </div>
  );
};

/** The Just YM mascot, waving its arm. */
export const Mascot: React.FC<{ size: number; style?: React.CSSProperties; delay?: number }> = ({ size, style, delay = 0 }) => {
  const frame = useCurrentFrame();
  const t = useEnter(delay, 10);
  const wave = Math.sin((frame - delay) / 4.5) * 14;
  return (
    <div style={{ position: "absolute", width: size, height: size, transform: `translateY(${(1 - t) * size * 0.6}px)`, opacity: t, ...style }}>
      <Img src={staticFile(ASSETS.mascotBody)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <Img
        src={staticFile(ASSETS.mascotArm)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transformOrigin: "80% 22%", transform: `rotate(${wave}deg)` }}
      />
    </div>
  );
};
