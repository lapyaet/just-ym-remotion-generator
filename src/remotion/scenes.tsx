import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Caption,
  CornerLogo,
  Img,
  DiscountSticker,
  Logo,
  Mascot,
  MiniCard,
  PhotoBackground,
  Pill,
  PriceNote,
  ProductCard,
  useEnter,
  useIsVertical,
  useUnit,
} from "./components";
import { FONT_BODY, FONT_FUN, FONT_IMPACT } from "./fonts";
import { BRAND, type Scene, type VideoSpec } from "./schema";

type SceneProps = { scene: Scene; spec: VideoSpec };

export const SceneView: React.FC<SceneProps> = (props) => {
  switch (props.scene.type) {
    case "hook":
      return <HookScene {...props} />;
    case "attraction":
      return <AttractionScene {...props} />;
    case "deals":
      return <DealsScene {...props} />;
    case "payment":
      return <PaymentScene {...props} />;
    case "outro":
      return <OutroScene {...props} />;
    default:
      return <CaptionScene {...props} />;
  }
};

// ---------- hook: logo stamp, then "Hello" + BIG popping letters ----------

const HookScene: React.FC<SceneProps> = ({ scene }) => {
  const u = useUnit();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = useIsVertical();
  const stamp = useEnter(0, 10);
  // Logo pops in the middle, then flies to the corner.
  const fly = interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoSize = interpolate(fly, [0, 1], [260 * u, 96 * u]);
  const x = interpolate(fly, [0, 1], [width / 2 - logoSize / 2, width - 48 * u - 96 * u]);
  const y = interpolate(fly, [0, 1], [height / 2 - logoSize / 2, 56 * u]);
  const word = scene.headline || "JUST YM";
  // Split into real characters (graphemes) so Burmese vowel signs stay attached.
  const letters = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)].map((g) => g.segment);
  const isLatin = /^[\p{Script=Latin}\d\s!?&'’.-]+$/u.test(word);
  // Fit the word to ~88% of the frame width (Lilita One is ~0.62em per letter).
  const letterSize = Math.min(230 * u, (width * 0.88) / (Math.max(3, letters.length) * (isLatin ? 0.64 : 1.2)));
  const kicker = useEnter(22, 9);
  const pill = useEnter(32 + Math.min(letters.length, 12) * 2, 12);

  return (
    <AbsoluteFill>
      <PhotoBackground src={scene.imageUrl} dim={0.25} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: vertical ? "flex-start" : "center", paddingTop: vertical ? height * 0.22 : 0 }}>
        {scene.kicker ? (
          <div
            style={{
              fontFamily: FONT_FUN,
              fontSize: 120 * u,
              color: BRAND.orange,
              transform: `rotate(-6deg) scale(${kicker}) translateX(${60 * u}px)`,
              marginBottom: -20 * u,
              textShadow: outline(7 * u),
            }}
          >
            {scene.kicker}
          </div>
        ) : null}
        <div style={{ display: "flex", fontFamily: FONT_FUN, fontSize: letterSize, lineHeight: 1.15 }}>
          {isLatin ? letters.map((ch, i) => <Letter key={i} ch={ch} delay={26 + i * 2} />) : <Letter ch={word} delay={26} />}
        </div>
        {scene.subtitle ? (
          <div style={{ marginTop: 30 * u, transform: `scale(${pill})`, opacity: pill }}>
            <Pill bg={BRAND.white} color={BRAND.orangeDeep} size={34}>
              {scene.subtitle}
            </Pill>
          </div>
        ) : null}
      </AbsoluteFill>
      <Logo size={logoSize} style={{ position: "absolute", left: x, top: y, transform: `scale(${stamp})` }} />
    </AbsoluteFill>
  );
};

/** Thick white outline (16 offset shadows) plus a soft drop shadow. */
function outline(w: number) {
  const steps = 16;
  const rings = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return `${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${BRAND.white}`;
  });
  return [...rings, `0 ${w * 1.4}px ${w * 3}px rgba(0,0,0,0.35)`].join(", ");
}

const Letter: React.FC<{ ch: string; delay: number }> = ({ ch, delay }) => {
  const u = useUnit();
  const t = useEnter(delay, 8);
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "pre",
        color: BRAND.orange,
        textShadow: outline(9 * u),
        transform: `translateY(${(1 - t) * 120 * u}px) scale(${0.4 + 0.6 * t})`,
        opacity: Math.min(1, t * 2),
      }}
    >
      {ch}
    </span>
  );
};

// ---------- attraction: name pill, @location, price card, caption ----------

const AttractionScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const u = useUnit();
  const { height } = useVideoConfig();
  const vertical = useIsVertical();
  const top = useEnter(2, 12);
  const product = scene.products[0];
  return (
    <AbsoluteFill>
      <PhotoBackground src={scene.imageUrl} />
      <CornerLogo />
      <div style={{ position: "absolute", top: (vertical ? 200 : 90) * u, left: 0, right: 0, textAlign: "center", opacity: top, transform: `translateY(${(1 - top) * -30 * u}px)` }}>
        {scene.tag ? <Pill size={36}>{scene.tag}</Pill> : null}
        {scene.location ? (
          <div style={{ marginTop: 16 * u, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 26 * u, letterSpacing: "0.28em", color: BRAND.white, textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
            {scene.location}
          </div>
        ) : null}
      </div>
      {product ? (
        <div style={{ position: "absolute", left: 56 * u, top: vertical ? height * 0.5 : height * 0.36 }}>
          <ProductCard product={product} discount={scene.discount} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 60 * u, right: 60 * u, bottom: (vertical ? 170 : 90) * u }}>
        <Caption headline={scene.headline} highlight={scene.highlight} subtitle={scene.subtitle} delay={4} size={vertical ? 62 : 54} />
      </div>
      {product ? <PriceNote text={spec.priceNote} /> : null}
    </AbsoluteFill>
  );
};

// ---------- caption: big "WORTH IT!" moment or a two-line caption ----------

const CaptionScene: React.FC<SceneProps> = ({ scene }) => {
  const u = useUnit();
  const vertical = useIsVertical();
  const isShout = scene.headline.length <= 16 && /^[\p{Lu}\d\s!?+.,'’-]+$/u.test(scene.headline);
  const t = useEnter(2, 9);
  return (
    <AbsoluteFill>
      <PhotoBackground src={scene.imageUrl} />
      <CornerLogo />
      {isShout ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: vertical ? "flex-start" : "center", paddingTop: vertical ? 330 * u : 0 }}>
          <div
            style={{
              fontFamily: FONT_IMPACT,
              fontSize: (vertical ? 200 : 180) * u,
              color: BRAND.white,
              lineHeight: 1,
              textShadow: "0 10px 30px rgba(0,0,0,0.45)",
              transform: `scale(${0.6 + 0.4 * t}) rotate(${(1 - t) * -8}deg)`,
              opacity: t,
            }}
          >
            {scene.headline}
          </div>
          <div style={{ marginTop: 10 * u }}>
            <Caption headline="" highlight={scene.highlight} subtitle={scene.subtitle} size={56} delay={8} />
          </div>
        </AbsoluteFill>
      ) : (
        <div style={{ position: "absolute", top: (vertical ? 220 : 120) * u, left: 70 * u, right: 70 * u }}>
          <Caption headline={scene.headline} highlight={scene.highlight} subtitle={scene.subtitle} size={vertical ? 66 : 58} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- deals: grid of product cards + optional discount sticker ----------

const DealsScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const u = useUnit();
  const vertical = useIsVertical();
  const pill = useEnter(30, 12);
  const products = scene.products.slice(0, 4);
  return (
    <AbsoluteFill>
      <PhotoBackground src={scene.imageUrl} dim={0.55} blur={14} />
      <CornerLogo />
      <div style={{ position: "absolute", top: (vertical ? 200 : 70) * u, left: 70 * u, right: 70 * u }}>
        <Caption headline={scene.headline} highlight={scene.highlight} size={vertical ? 62 : 52} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: (vertical ? 120 : 150) * u }}>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${vertical ? 2 : Math.min(4, products.length)}, auto)`, gap: 28 * u }}>
          {products.map((p, i) => (
            <MiniCard key={p.pageUrl + i} product={p} delay={6 + i * 5} />
          ))}
          {scene.discount ? (
            <div style={{ position: "absolute", top: -150 * u, right: -40 * u }}>
              <DiscountSticker text={scene.discount} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      {scene.subtitle ? (
        <div style={{ position: "absolute", bottom: (vertical ? 120 : 60) * u, left: 0, right: 0, textAlign: "center", transform: `scale(${pill})`, opacity: pill }}>
          <Pill bg={BRAND.white} color={BRAND.orangeDeep} size={32}>
            ✓ {scene.subtitle}
          </Pill>
        </div>
      ) : null}
      <PriceNote text={spec.priceNote} />
    </AbsoluteFill>
  );
};

// ---------- payment: Myanmar wallets, no cash needed, payment successful ----------

const WALLETS = [
  { name: "KBZPay", color: "#1F4FA3" },
  { name: "AYA Pay", color: "#D7262C" },
  { name: "Wave Pay", color: "#F5B400" },
  { name: "MMQR", color: "#1C6E4A" },
];

const PaymentScene: React.FC<SceneProps> = ({ scene }) => {
  const u = useUnit();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const vertical = useIsVertical();
  const icon = useEnter(6, 9);
  const successAt = Math.round(durationInFrames * 0.55);
  const success = useEnter(successAt, 10);
  const iconOut = interpolate(frame, [successAt - 4, successAt + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, #FFA466 0%, ${BRAND.orange} 45%, ${BRAND.orangeDeep} 100%)` }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 80% 15%, rgba(255,255,255,0.25), transparent 35%), radial-gradient(circle at 10% 85%, rgba(255,255,255,0.18), transparent 40%)" }} />
      <CornerLogo />
      <div style={{ position: "absolute", top: (vertical ? 220 : 90) * u, left: 70 * u, right: 70 * u }}>
        <PaymentCaption scene={scene} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: (vertical ? 80 : 160) * u }}>
        <div style={{ position: "relative", width: 640 * u, height: 640 * u, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* "No cash" baht icon */}
          <div style={{ position: "absolute", transform: `scale(${icon * iconOut})`, width: 260 * u, height: 260 * u, borderRadius: "50%", background: BRAND.white, border: `${18 * u}px solid #E8352B`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 150 * u, color: BRAND.ink }}>฿</span>
            <div style={{ position: "absolute", width: 300 * u, height: 18 * u, background: "#E8352B", transform: "rotate(-45deg)" }} />
          </div>
          {/* Wallet chips around it */}
          {WALLETS.map((w, i) => (
            <WalletChip key={w.name} {...w} index={i} />
          ))}
          {/* Payment successful card */}
          <div style={{ position: "absolute", transform: `scale(${success})`, opacity: success, width: 440 * u, padding: `${40 * u}px ${30 * u}px`, background: BRAND.white, borderRadius: 32 * u, textAlign: "center", fontFamily: FONT_BODY, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ width: 110 * u, height: 110 * u, margin: "0 auto", borderRadius: "50%", background: "#DCFCE7", color: BRAND.green, fontSize: 70 * u, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
            <div style={{ marginTop: 20 * u, fontSize: 36 * u, fontWeight: 800, color: BRAND.ink }}>Payment successful!</div>
            <div style={{ marginTop: 6 * u, fontSize: 22 * u, color: "#8a8178" }}>Tickets sent instantly</div>
          </div>
        </div>
      </AbsoluteFill>
      {scene.subtitle ? (
        <div style={{ position: "absolute", bottom: (vertical ? 150 : 60) * u, left: 60 * u, right: 60 * u, textAlign: "center", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 34 * u, color: BRAND.white, textShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>
          {scene.subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const PaymentCaption: React.FC<{ scene: Scene }> = ({ scene }) => {
  const u = useUnit();
  const a = useEnter(0);
  const b = useEnter(5);
  return (
    <div style={{ textAlign: "center", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 62 * u, lineHeight: 1.25 }}>
      <div style={{ color: BRAND.white, opacity: a, transform: `translateY(${(1 - a) * 30 * u}px)` }}>{scene.headline}</div>
      {scene.highlight ? (
        <div style={{ color: "#3A1A05", opacity: b, transform: `translateY(${(1 - b) * 30 * u}px)` }}>{scene.highlight}</div>
      ) : null}
    </div>
  );
};

const WalletChip: React.FC<{ name: string; color: string; index: number }> = ({ name, color, index }) => {
  const u = useUnit();
  const frame = useCurrentFrame();
  const t = useEnter(12 + index * 5, 9);
  const spots = [
    { x: -250, y: -230 },
    { x: 250, y: -200 },
    { x: -260, y: 220 },
    { x: 250, y: 240 },
  ][index];
  const bob = Math.sin((frame + index * 9) / 10) * 8 * u;
  return (
    <div
      style={{
        position: "absolute",
        transform: `translate(${spots.x * u}px, ${spots.y * u + bob}px) scale(${t})`,
        display: "flex",
        alignItems: "center",
        gap: 12 * u,
        padding: `${16 * u}px ${24 * u}px`,
        background: BRAND.white,
        borderRadius: 22 * u,
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize: 30 * u,
        color,
        boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
      }}
    >
      <span style={{ width: 22 * u, height: 22 * u, borderRadius: "50%", background: color }} />
      {name}
    </div>
  );
};

// ---------- outro: logo, "Your Moment.", framed photo, CTA, mascot ----------

const OutroScene: React.FC<SceneProps> = ({ scene }) => {
  const u = useUnit();
  const { height } = useVideoConfig();
  const vertical = useIsVertical();
  const logo = useEnter(0, 10);
  const frameIn = useEnter(6, 12);
  const title = useEnter(12, 10);
  const cta = useEnter(22, 10);
  const frame = useCurrentFrame();
  const ctaPulse = 1 + Math.max(0, Math.sin((frame - 30) / 6)) * 0.04;
  const hasPhoto = Boolean(scene.imageUrl);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BRAND.peach} 0%, #FFE2CC 60%, #FFC9A3 100%)`, alignItems: "center", fontFamily: FONT_BODY }}>
      <div style={{ marginTop: (vertical ? 150 : 50) * u, transform: `scale(${logo})` }}>
        <Logo size={(vertical ? 170 : 130) * u} />
      </div>
      {hasPhoto ? (
        <div
          style={{
            marginTop: 40 * u,
            width: (vertical ? 640 : 520) * u,
            height: (vertical ? 760 : 360) * u,
            borderRadius: 36 * u,
            border: `${12 * u}px solid ${BRAND.orange}`,
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
            transform: `rotate(${(1 - frameIn) * -10 - 2}deg) scale(${0.7 + 0.3 * frameIn})`,
            opacity: frameIn,
          }}
        >
          <Img src={scene.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <div style={{ height: vertical ? height * 0.12 : 20 * u }} />
      )}
      <div style={{ marginTop: 40 * u, textAlign: "center", opacity: title, transform: `translateY(${(1 - title) * 40 * u}px)` }}>
        <div style={{ fontSize: (vertical ? 100 : 80) * u, fontWeight: 800, color: BRAND.orangeDeep, lineHeight: 1.1 }}>{scene.headline || "Your Moment."}</div>
        {scene.highlight ? <div style={{ marginTop: 12 * u, fontSize: 36 * u, fontWeight: 600, color: "#4A2A12" }}>{scene.highlight}</div> : null}
      </div>
      <div style={{ marginTop: 36 * u, transform: `scale(${cta * ctaPulse})`, opacity: cta }}>
        <Pill size={38}>Book now · justym.me →</Pill>
      </div>
      <Mascot size={(vertical ? 340 : 260) * u} delay={14} style={{ left: 10 * u, bottom: (vertical ? 20 : 0) * u }} />
    </AbsoluteFill>
  );
};
