import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Caption,
  countUp,
  CornerLogo,
  DiscountSticker,
  glow,
  Img,
  Letterbox,
  Logo,
  Mascot,
  MiniCard,
  Paper,
  Pill,
  Polaroid,
  PriceNote,
  ProductCard,
  SceneBackground,
  Tag,
  textOnPhoto,
  ThemeProvider,
  useEnter,
  useFlicker,
  useIsVertical,
  useRand,
  useTheme,
  useUnit,
} from "./components";
import { FONT_BODY, FONT_HAND, FONT_SERIF, fontFor } from "./fonts";
import { type Scene, type VideoSpec } from "./schema";
import { getTemplate } from "./templates";
import { Burst, Confetti } from "./fx";

type SceneProps = { scene: Scene; spec: VideoSpec };

export const SceneView: React.FC<SceneProps & { index: number }> = ({ index, ...props }) => {
  const t = getTemplate(props.spec.template);
  return (
    <ThemeProvider value={{ t, seed: props.spec.seed, index }}>
      <SceneSwitch {...props} />
    </ThemeProvider>
  );
};

const SceneSwitch: React.FC<SceneProps> = (props) => {
  switch (props.scene.type) {
    case "hook":
      return <HookScene {...props} />;
    case "attraction":
      return <AttractionScene {...props} />;
    case "deals":
      return <DealsScene {...props} />;
    case "app":
      return <AppScene {...props} />;
    case "payment":
      return <PaymentScene {...props} />;
    case "outro":
      return <OutroScene {...props} />;
    default:
      return <CaptionScene {...props} />;
  }
};

/** Where the photo / text live for the current template. */
function useLayout() {
  const { t } = useTheme();
  const { width, height } = useVideoConfig();
  const u = useUnit();
  const vertical = useIsVertical();
  const bar = t.photo === "letterbox" ? height * 0.1 : 0;
  const polaroid = {
    width: vertical ? width * 0.8 : width * 0.4,
    height: vertical ? height * 0.43 : height * 0.74,
    left: vertical ? width * 0.1 : width * 0.06,
    top: vertical ? height * 0.1 : height * 0.12,
  };
  return { t, u, vertical, width, height, bar, polaroid, onPhoto: textOnPhoto(t) };
}

/** Background + framed photo for scenes that show a photo. */
const PhotoLayer: React.FC<{ src: string; dim?: number; blur?: number }> = ({ src, dim, blur }) => {
  const { t, polaroid } = useLayout();
  return (
    <>
      <SceneBackground src={src} dim={dim} blur={blur} />
      {t.photo === "polaroid" && src ? <Polaroid src={src} {...polaroid} style={{ left: polaroid.left, top: polaroid.top }} /> : null}
    </>
  );
};

// ---------- hook ----------

const HookScene: React.FC<SceneProps> = (props) => {
  const { t } = useTheme();
  if (t.hook === "curtain") return <CurtainHook {...props} />;
  if (t.hook === "stamp") return <StampHook {...props} />;
  if (t.hook === "flicker") return <FlickerHook {...props} />;
  if (t.hook === "slam") return <SlamHook {...props} />;
  return <PopHook {...props} />;
};

/** Is Calling: logo stamps in the middle and flies to the corner, letters pop. */
const PopHook: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, vertical, width, height } = useLayout();
  const frame = useCurrentFrame();
  const stamp = useEnter(0, 10);
  const fly = interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoSize = interpolate(fly, [0, 1], [260 * u, 96 * u]);
  const x = interpolate(fly, [0, 1], [width / 2 - logoSize / 2, width - 48 * u - 96 * u]);
  const y = interpolate(fly, [0, 1], [height / 2 - logoSize / 2, 56 * u]);
  const word = scene.headline || "JUST YM";
  const letters = graphemes(word);
  const latin = isLatin(word);
  const size = Math.min(230 * u, (width * 0.88) / (Math.max(3, letters.length) * (latin ? 0.64 : 1.2)));
  const kicker = useEnter(22, 9);
  const pill = useEnter(32 + Math.min(letters.length, 12) * 2, 12);
  return (
    <AbsoluteFill>
      <SceneBackground src={scene.imageUrl} dim={0.25} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: vertical ? "flex-start" : "center", paddingTop: vertical ? height * 0.22 : 0 }}>
        {scene.kicker ? (
          <div style={{ fontFamily: fontFor("fun"), fontSize: 120 * u, color: t.colors.primary, transform: `rotate(-6deg) scale(${kicker}) translateX(${60 * u}px)`, marginBottom: -20 * u, textShadow: outline(7 * u) }}>
            {scene.kicker}
          </div>
        ) : null}
        <div style={{ display: "flex", fontFamily: fontFor("fun"), fontSize: size, lineHeight: 1.15 }}>
          {latin ? letters.map((ch, i) => <PopLetter key={i} ch={ch} delay={26 + i * 2} />) : <PopLetter ch={word} delay={26} />}
        </div>
        {scene.subtitle ? (
          <div style={{ marginTop: 30 * u, transform: `scale(${pill})`, opacity: pill }}>
            <Pill bg="#FFFFFF" color="#F26B1D" size={34}>
              {scene.subtitle}
            </Pill>
          </div>
        ) : null}
      </AbsoluteFill>
      <Burst at={26} color="#FFD08A" y={vertical ? "32%" : "50%"} />
      <Logo size={logoSize} style={{ position: "absolute", left: x, top: y, transform: `scale(${stamp})`, boxShadow: "0 6px 24px rgba(0,0,0,0.3)" }} />
    </AbsoluteFill>
  );
};

const PopLetter: React.FC<{ ch: string; delay: number }> = ({ ch, delay }) => {
  const u = useUnit();
  const { t } = useTheme();
  const e = useEnter(delay, 8);
  return (
    <span style={{ display: "inline-block", whiteSpace: "pre", color: t.colors.primary, textShadow: outline(9 * u), transform: `translateY(${(1 - e) * 120 * u}px) scale(${0.4 + 0.6 * e})`, opacity: Math.min(1, e * 2) }}>
      {ch}
    </span>
  );
};

/** Cinematic: velvet curtains open on a letterboxed photo, serif title. */
const CurtainHook: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, width } = useLayout();
  const frame = useCurrentFrame();
  const open = interpolate(frame, [6, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const title = useEnter(34, 30);
  const kicker = useEnter(26, 30);
  const curtain = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: width / 2 + 4,
    [side]: 0,
    transform: `translateX(${(side === "left" ? -1 : 1) * open * (width / 2 + 10)}px)`,
    background: "linear-gradient(90deg, #3B0B1A 0%, #6A1730 12%, #3B0B1A 24%, #6A1730 36%, #3B0B1A 48%, #6A1730 60%, #3B0B1A 72%, #6A1730 84%, #3B0B1A 100%)",
    boxShadow: "0 0 60px rgba(0,0,0,0.6)",
  });
  return (
    <AbsoluteFill>
      <SceneBackground src={scene.imageUrl} dim={0.3} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80 * u }}>
        {scene.kicker ? (
          <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 54 * u, color: t.colors.primary, opacity: kicker, transform: `translateY(${(1 - kicker) * 20 * u}px)` }}>{scene.kicker}</div>
        ) : null}
        <div style={{ fontFamily: FONT_SERIF, fontWeight: 800, fontSize: Math.min(150 * u, (width * 0.86) / Math.max(4, graphemes(scene.headline).length * 0.7)), letterSpacing: "0.08em", color: t.colors.text, opacity: title, textShadow: "0 6px 30px rgba(0,0,0,0.6)" }}>
          {scene.headline}
        </div>
        <div style={{ width: 220 * u * title, height: 2 * u, background: t.colors.primary, margin: `${20 * u}px auto` }} />
        {scene.subtitle ? <div style={{ fontFamily: FONT_BODY, fontSize: 32 * u, color: t.colors.muted, opacity: title, letterSpacing: "0.06em" }}>{scene.subtitle}</div> : null}
      </AbsoluteFill>
      <div style={curtain("left")} />
      <div style={curtain("right")} />
      <Letterbox />
      <CornerLogo />
    </AbsoluteFill>
  );
};

/** Travel Journal: polaroid drops in, a passport stamp thumps down. */
const StampHook: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, vertical, width, height, polaroid } = useLayout();
  const frame = useCurrentFrame();
  const thump = interpolate(frame, [18, 26], [2.2, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const show = frame >= 18 ? 1 : 0;
  const hello = useEnter(30, 12);
  return (
    <AbsoluteFill>
      <Paper />
      {scene.imageUrl ? <Polaroid src={scene.imageUrl} {...polaroid} style={{ left: polaroid.left, top: polaroid.top }} /> : null}
      <div
        style={{
          position: "absolute",
          left: vertical ? width / 2 - 230 * u : width * 0.55,
          top: vertical ? height * 0.47 : height * 0.25,
          width: 460 * u,
          height: 460 * u,
          borderRadius: "50%",
          border: `${10 * u}px double ${t.colors.accent}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: t.colors.accent,
          transform: `rotate(-12deg) scale(${thump})`,
          opacity: show * 0.92,
          background: "rgba(246,238,223,0.6)",
        }}
      >
        <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 26 * u, letterSpacing: "0.3em" }}>✈ ARRIVED ✈</div>
        <div style={{ fontFamily: fontFor("impact"), fontSize: Math.min(110 * u, (400 * u) / Math.max(4, graphemes(scene.headline).length * 0.6)), letterSpacing: "0.04em", lineHeight: 1.1 }}>
          {scene.headline}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 24 * u, letterSpacing: "0.2em" }}>JUST YM</div>
      </div>
      <Burst at={20} color={t.colors.accent} x={vertical ? "50%" : "70%"} y={vertical ? "59%" : "45%"} size={700} />
      {scene.kicker ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: (vertical ? 250 : 90) * u, textAlign: "center", fontFamily: FONT_HAND, fontWeight: 700, fontSize: 130 * u, color: t.colors.text, opacity: hello, transform: `rotate(-4deg) translateY(${(1 - hello) * 30 * u}px)` }}>
          {scene.kicker}!
        </div>
      ) : null}
      {scene.subtitle ? (
        <div style={{ position: "absolute", left: 60 * u, right: 60 * u, bottom: (vertical ? 160 : 40) * u, textAlign: "center", fontFamily: FONT_BODY, fontSize: 34 * u, color: t.colors.muted, opacity: hello }}>{scene.subtitle}</div>
      ) : null}
      <CornerLogo />
    </AbsoluteFill>
  );
};

/** Neon Night: the city name flickers on like a neon sign. */
const FlickerHook: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, width } = useLayout();
  const on = useFlicker(10);
  const kicker = useFlicker(4);
  const sub = useEnter(26, 12);
  const frame = useCurrentFrame();
  const buzz = 0.92 + Math.sin(frame / 2.3) * 0.04;
  return (
    <AbsoluteFill>
      <SceneBackground src={scene.imageUrl} dim={0.5} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {scene.kicker ? (
          <div style={{ fontFamily: fontFor("bebas"), fontSize: 80 * u, letterSpacing: "0.2em", color: t.colors.accent, textShadow: glow(t.colors.accent, u), opacity: kicker }}>{scene.kicker}</div>
        ) : null}
        <Burst at={10} color={t.colors.primary} y="50%" size={1000} />
        <div style={{ fontFamily: fontFor("bebas"), fontSize: Math.min(300 * u, (width * 0.9) / Math.max(3, graphemes(scene.headline).length * 0.5)), lineHeight: 0.95, color: "#FFFFFF", textShadow: glow(t.colors.primary, u * 1.4), opacity: on * buzz }}>
          {scene.headline}
        </div>
        {scene.subtitle ? (
          <div style={{ marginTop: 30 * u, opacity: sub }}>
            <span style={{ display: "inline-block", padding: `${10 * u}px ${28 * u}px`, borderRadius: 999, border: `${3 * u}px solid ${t.colors.accent}`, boxShadow: `0 0 18px ${t.colors.accent}`, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 32 * u, color: "#FFFFFF" }}>
              {scene.subtitle}
            </span>
          </div>
        ) : null}
      </AbsoluteFill>
      <CornerLogo />
    </AbsoluteFill>
  );
};

/** Flash Sale: the city name slams onto a black bar and the screen shakes. */
const SlamHook: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, vertical, width, height } = useLayout();
  const frame = useCurrentFrame();
  const slam = interpolate(frame, [8, 16], [3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visible = frame >= 8 ? 1 : 0;
  const shake = frame >= 16 && frame < 26 ? Math.sin(frame * 3.1) * (26 - frame) * 1.4 * u : 0;
  const kicker = useEnter(2, 10);
  const sub = useEnter(24, 11);
  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      <SceneBackground src={scene.imageUrl} />
      <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? height * 0.6 : height * 0.52, textAlign: "center" }}>
        {scene.kicker ? (
          <div style={{ display: "inline-block", background: t.colors.accent, color: "#111", fontFamily: fontFor("impact"), fontSize: 54 * u, padding: `${4 * u}px ${22 * u}px`, transform: `rotate(-3deg) scale(${kicker})` }}>{scene.kicker}</div>
        ) : null}
        <div
          style={{
            marginTop: 14 * u,
            background: "#111111",
            color: "#FFC83D",
            fontFamily: fontFor("impact"),
            fontSize: Math.min(220 * u, (width * 0.92) / Math.max(3, graphemes(scene.headline).length * 0.55)),
            lineHeight: 1.05,
            padding: `${10 * u}px 0`,
            transform: `scale(${slam}) rotate(-2deg)`,
            opacity: visible,
          }}
        >
          {scene.headline}
        </div>
        {scene.subtitle ? <div style={{ marginTop: 26 * u, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38 * u, color: "#111", opacity: sub }}>{scene.subtitle}</div> : null}
      </div>
      <Burst at={15} color="#111111" y={vertical ? "66%" : "60%"} size={1100} />
      <Confetti count={40} burstAt={15} />
      <CornerLogo />
    </AbsoluteFill>
  );
};

// ---------- attraction ----------

const AttractionScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const { t, u, vertical, height, bar, polaroid, onPhoto } = useLayout();
  const product = scene.products[0];
  const flip = useRand(3);
  const sideRoll = useRand(4);
  const alignRoll = useRand(5);
  const captionOnTop = t.captionPlacement === "alternate" && flip > 0.5;
  // Layout variation from the seed: card on the left or right, text centred or left-aligned.
  const side: "left" | "right" = t.photo === "polaroid" ? "left" : sideRoll < 0.5 ? "left" : "right";
  const align: "center" | "left" = t.caption === "elegant" || t.photo === "polaroid" ? "center" : alignRoll < 0.45 ? "left" : "center";

  // Positions per photo style.
  let tagTop = (vertical ? 200 : 90) * u + bar;
  let cardTop = vertical ? height * 0.5 : height * 0.36;
  let captionBottom = (vertical ? 170 : 90) * u + bar;
  if (t.photo === "polaroid") {
    tagTop = polaroid.top + polaroid.height - 30 * u;
    cardTop = vertical ? height * 0.62 : height * 0.5;
    captionBottom = (vertical ? 110 : 60) * u;
  } else if (t.photo === "split") {
    cardTop = vertical ? height * 0.42 : height * 0.4;
    captionBottom = (vertical ? 150 : 60) * u;
  } else if (captionOnTop) {
    cardTop = vertical ? height * 0.62 : height * 0.5;
  }

  return (
    <AbsoluteFill>
      <PhotoLayer src={scene.imageUrl} />
      <CornerLogo />
      <div style={{ position: "absolute", top: tagTop, left: t.photo === "polaroid" ? polaroid.left + polaroid.width * 0.35 : align === "left" ? 60 * u : 0, right: align === "left" ? 60 * u : 0 }}>
        <Tag tag={scene.tag} location={scene.location} onPhoto={t.photo !== "polaroid"} align={t.photo === "polaroid" ? "center" : align} />
      </div>
      {product ? (
        <div style={{ position: "absolute", top: cardTop, ...(side === "left" ? { left: 56 * u } : { right: 56 * u }) }}>
          <ProductCard product={product} discount={scene.discount} from={side} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 60 * u, right: 60 * u, ...(captionOnTop ? { top: tagTop + 170 * u } : { bottom: captionBottom }) }}>
        <Caption headline={scene.headline} highlight={scene.highlight} subtitle={scene.subtitle} delay={4} size={vertical ? 62 : 54} onPhoto={onPhoto} align={align} />
      </div>
      {product ? <PriceNote text={spec.priceNote} onPhoto={onPhoto} /> : null}
    </AbsoluteFill>
  );
};

// ---------- caption ----------

const CaptionScene: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, vertical, bar, polaroid, onPhoto } = useLayout();
  const isShout = scene.headline.length <= 16 && /^[\p{Lu}\d\s!?+.,'’-]+$/u.test(scene.headline);
  const e = useEnter(2, 9);
  const flicker = useFlicker(2);
  const shoutStyle: React.CSSProperties =
    t.id === "neon"
      ? { fontFamily: fontFor("bebas"), color: "#FFFFFF", textShadow: glow(t.colors.primary, u * 1.3), opacity: flicker }
      : t.id === "cinematic"
        ? { fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 800, color: t.colors.text, textShadow: "0 10px 30px rgba(0,0,0,0.5)", opacity: e }
        : t.id === "journal"
          ? { fontFamily: FONT_HAND, fontWeight: 700, color: t.colors.text, transform: `rotate(-5deg) scale(${0.6 + 0.4 * e})`, opacity: e }
          : t.id === "flash"
            ? { fontFamily: fontFor("impact"), color: "#FFC83D", background: "#111", padding: `0 ${24 * u}px`, transform: `scale(${0.6 + 0.4 * e}) rotate(-3deg)`, opacity: e }
            : { fontFamily: fontFor("impact"), color: "#FFFFFF", textShadow: "0 10px 30px rgba(0,0,0,0.45)", transform: `scale(${0.6 + 0.4 * e}) rotate(${(1 - e) * -8}deg)`, opacity: e };
  // Fit the shout to ~90% of the frame width; average glyph width differs per font.
  const { width } = useVideoConfig();
  const glyph = t.id === "cinematic" ? 0.66 : t.id === "journal" ? 0.46 : t.id === "neon" ? 0.42 : 0.5;
  const shoutSize = Math.min((vertical ? 200 : 170) * u, (width * 0.88) / (Math.max(4, graphemes(scene.headline).length) * glyph));
  const shoutTop = t.photo === "polaroid" ? polaroid.top + polaroid.height + 40 * u : t.photo === "split" ? (vertical ? 1140 : 620) * u : (vertical ? 330 : 0) * u + bar;
  return (
    <AbsoluteFill>
      <PhotoLayer src={scene.imageUrl} />
      <CornerLogo />
      {isShout ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: vertical || !onPhoto ? "flex-start" : "center", paddingTop: shoutTop }}>
          <div style={{ fontSize: shoutSize, lineHeight: 1, whiteSpace: "nowrap", ...shoutStyle }}>{scene.headline}</div>
          <div style={{ marginTop: 16 * u }}>
            <Caption headline="" highlight={scene.highlight} subtitle={scene.subtitle} size={56} delay={8} onPhoto={onPhoto} />
          </div>
        </AbsoluteFill>
      ) : (
        <div style={{ position: "absolute", left: 70 * u, right: 70 * u, ...(onPhoto ? { top: (vertical ? 220 : 120) * u + bar } : { bottom: (vertical ? 170 : 60) * u }) }}>
          <Caption headline={scene.headline} highlight={scene.highlight} subtitle={scene.subtitle} size={vertical ? 66 : 58} onPhoto={onPhoto} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- deals ----------

const DealsScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const { t, u, vertical, bar, onPhoto } = useLayout();
  const pill = useEnter(30, 12);
  const products = scene.products.slice(0, 4);
  const background =
    t.photo === "polaroid" ? <Paper /> : t.photo === "split" ? <AbsoluteFill style={{ background: t.colors.bg }} /> : <SceneBackground src={scene.imageUrl} dim={0.55} blur={14} />;
  return (
    <AbsoluteFill>
      {background}
      {t.photo === "split" ? <SplitStripes /> : null}
      <CornerLogo />
      <div style={{ position: "absolute", top: (vertical ? 200 : 70) * u + bar, left: 70 * u, right: 70 * u }}>
        <Caption headline={scene.headline} highlight={scene.highlight} size={vertical ? 62 : 52} onPhoto={onPhoto} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: (vertical ? 140 : 160) * u }}>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${vertical ? 2 : Math.min(4, products.length)}, auto)`, gap: 28 * u }}>
          {products.map((p, i) => (
            <MiniCard key={p.pageUrl + i} product={p} delay={6 + i * 5} index={i} />
          ))}
          {scene.discount ? (
            <div style={{ position: "absolute", top: -150 * u, right: -40 * u }}>
              <DiscountSticker text={scene.discount} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      {scene.subtitle ? (
        <div style={{ position: "absolute", bottom: (vertical ? 120 : 60) * u + bar, left: 0, right: 0, textAlign: "center", transform: `scale(${pill})`, opacity: pill }}>
          <Pill bg={t.id === "flash" ? "#111111" : "#FFFFFF"} color={t.id === "flash" ? "#FFC83D" : t.id === "neon" ? "#07040F" : t.id === "cinematic" ? "#111" : "#F26B1D"} size={32}>
            ✓ {scene.subtitle}
          </Pill>
        </div>
      ) : null}
      <PriceNote text={spec.priceNote} onPhoto={onPhoto} />
    </AbsoluteFill>
  );
};

/** Diagonal hazard stripes at the top and bottom (flash template). */
const SplitStripes: React.FC = () => {
  const u = useUnit();
  const stripe: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: 34 * u,
    background:
      "linear-gradient(135deg, #111 0%, #111 12.5%, #FFC83D 12.5%, #FFC83D 25%, #111 25%, #111 37.5%, #FFC83D 37.5%, #FFC83D 50%, #111 50%, #111 62.5%, #FFC83D 62.5%, #FFC83D 75%, #111 75%, #111 87.5%, #FFC83D 87.5%)",
  };
  return (
    <>
      <div style={{ ...stripe, top: 0 }} />
      <div style={{ ...stripe, bottom: 0 }} />
    </>
  );
};

// ---------- app: phone showing the justym.me app ----------

const AppScene: React.FC<SceneProps> = ({ scene, spec }) => {
  const { t, u, vertical, height, bar, onPhoto } = useLayout();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const products = scene.products.slice(0, 5);
  const city = (scene.tag || products[0]?.city || "Bangkok").replace(/^@/, "");
  const phoneIn = useEnter(0, 13);
  const tapAt = Math.round(durationInFrames * 0.6);
  const toastAt = Math.round(durationInFrames * 0.72);
  const toast = useEnter(toastAt, 12);
  const typed = Math.floor(interpolate(frame, [8, 8 + city.length * 2.2], [0, city.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const resultsIn = useEnter(18 + city.length * 2, 14);

  const phoneW = (vertical ? 600 : 420) * u;
  const phoneH = (vertical ? 1160 : 820) * u;
  const cardH = 190 * u;
  const gap = 18 * u;
  const listH = products.length * (cardH + gap);
  const visible = phoneH - 420 * u;
  const scroll = interpolate(frame, [30, tapAt - 6], [0, Math.max(0, listH - visible)], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => x * x * (3 - 2 * x) });
  const tapIndex = Math.min(products.length - 1, Math.max(0, Math.round((scroll + visible * 0.45) / (cardH + gap))));
  const tapLocal = frame - tapAt;
  const dark = t.id === "neon" || t.id === "cinematic";
  const screenBg = dark ? "#0E0C14" : "#FFFFFF";
  const screenText = dark ? "#FFFFFF" : "#16120F";
  const background =
    t.photo === "polaroid" ? <Paper /> : t.photo === "split" ? <AbsoluteFill style={{ background: t.colors.bg }} /> : <SceneBackground src={scene.imageUrl || products[0]?.imageUrl || ""} dim={0.6} blur={18} />;

  return (
    <AbsoluteFill>
      {background}
      <CornerLogo />
      <div style={{ position: "absolute", top: (vertical ? 150 : 60) * u + bar, left: 70 * u, right: 70 * u }}>
        <Caption headline={scene.headline} highlight={scene.highlight} size={vertical ? 56 : 46} onPhoto={onPhoto} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: vertical ? height * 0.27 : height * 0.2,
          width: phoneW,
          height: phoneH,
          marginLeft: -phoneW / 2,
          borderRadius: 78 * u,
          background: "#111",
          padding: 16 * u,
          boxShadow: t.id === "neon" ? `0 0 40px ${t.colors.primary}88, 0 30px 80px rgba(0,0,0,0.6)` : "0 40px 90px rgba(0,0,0,0.45)",
          transform: `translateY(${(1 - phoneIn) * 300 * u}px) rotate(${(1 - phoneIn) * 6 - 2}deg)`,
          opacity: phoneIn,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 64 * u, overflow: "hidden", background: screenBg, fontFamily: FONT_BODY, color: screenText }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: `${22 * u}px ${44 * u}px 0`, fontSize: 22 * u, fontWeight: 700 }}>
            <span>9:41</span>
            <span>●●● 100%</span>
          </div>
          <div style={{ position: "absolute", top: 18 * u, left: "50%", width: 170 * u, height: 40 * u, marginLeft: -85 * u, borderRadius: 999, background: "#111" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 * u, padding: `${30 * u}px ${32 * u}px ${18 * u}px` }}>
            <Logo size={56 * u} />
            <div style={{ fontWeight: 800, fontSize: 30 * u }}>Just YM</div>
            <div style={{ marginLeft: "auto", fontSize: 30 * u }}>🛒</div>
          </div>
          <div style={{ margin: `0 ${32 * u}px`, display: "flex", gap: 12 * u }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 * u, padding: `${16 * u}px ${22 * u}px`, borderRadius: 18 * u, border: `${2 * u}px solid ${dark ? "rgba(255,255,255,0.15)" : "#E7E1DA"}`, fontSize: 26 * u }}>
              <span style={{ opacity: 0.6 }}>📍</span>
              <span style={{ fontWeight: 600 }}>{city.slice(0, typed)}</span>
              <span style={{ width: 3 * u, height: 30 * u, background: "#FF914D", opacity: frame % 20 < 10 ? 1 : 0 }} />
            </div>
            <div style={{ padding: `${16 * u}px ${20 * u}px`, borderRadius: 18 * u, background: "#FF914D", color: "#FFFFFF", fontWeight: 800, fontSize: 24 * u }}>Search</div>
          </div>
          <div style={{ padding: `${20 * u}px ${32 * u}px ${10 * u}px`, fontSize: 24 * u, fontWeight: 700, opacity: resultsIn }}>
            {products.length} Tickets Found in {city}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 330 * u, bottom: 0, overflow: "hidden" }}>
            <div style={{ transform: `translateY(${-scroll}px)`, padding: `0 ${28 * u}px` }}>
              {products.map((p, i) => {
                const appear = Math.max(0, Math.min(1, resultsIn * 1.6 - i * 0.15));
                const tapped = i === tapIndex && tapLocal >= 0;
                return (
                  <div
                    key={p.pageUrl + i}
                    style={{
                      position: "relative",
                      display: "flex",
                      gap: gap,
                      height: cardH,
                      marginBottom: gap,
                      padding: 14 * u,
                      borderRadius: 22 * u,
                      background: dark ? "rgba(255,255,255,0.06)" : "#FFF8F2",
                      border: `${(tapped ? 4 : 2) * u}px solid ${tapped ? "#FF914D" : dark ? "rgba(255,255,255,0.1)" : "#F1E6DC"}`,
                      transform: `translateY(${(1 - appear) * 60 * u}px) scale(${tapped ? interpolate(tapLocal, [0, 4, 10], [1, 0.96, 1], { extrapolateRight: "clamp" }) : 1})`,
                      opacity: appear,
                    }}
                  >
                    <Img src={p.imageUrl} style={{ width: 170 * u, height: "100%", objectFit: "cover", borderRadius: 14 * u, flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                      <div style={{ fontSize: 19 * u, opacity: 0.6 }}>📍 {p.city || city}</div>
                      <div style={{ fontSize: 25 * u, fontWeight: 800, lineHeight: 1.2, maxHeight: 62 * u, overflow: "hidden" }}>{p.name}</div>
                      {p.priceText ? (
                        <div style={{ fontSize: 30 * u, fontWeight: 800, color: "#F26B1D" }}>
                          <span style={{ fontSize: 17 * u, opacity: 0.6, color: screenText, fontWeight: 500 }}>From </span>
                          {countUp(p.priceText, appear)}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 17 * u, color: "#16A34A", fontWeight: 700 }}>✓ Instant confirmation</div>
                    </div>
                    {i === 0 && scene.discount ? (
                      <div style={{ position: "absolute", top: -12 * u, right: 12 * u, background: "#E8352B", color: "#FFF", fontWeight: 800, fontSize: 20 * u, padding: `${4 * u}px ${12 * u}px`, borderRadius: 10 * u, transform: "rotate(-4deg)" }}>{scene.discount}</div>
                    ) : null}
                    {tapped ? (
                      <div style={{ position: "absolute", left: "55%", top: "50%", width: 0, height: 0 }}>
                        <div style={{ position: "absolute", width: 120 * u, height: 120 * u, left: -60 * u, top: -60 * u, borderRadius: "50%", border: `${4 * u}px solid #FF914D`, transform: `scale(${interpolate(tapLocal, [0, 14], [0.3, 1.6], { extrapolateRight: "clamp" })})`, opacity: interpolate(tapLocal, [0, 14], [1, 0], { extrapolateRight: "clamp" }) }} />
                        <div style={{ position: "absolute", width: 64 * u, height: 64 * u, left: -32 * u, top: -32 * u, borderRadius: "50%", background: "rgba(255,145,77,0.45)", border: `${3 * u}px solid #FFFFFF` }} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ position: "absolute", left: 28 * u, right: 28 * u, top: 70 * u, padding: `${22 * u}px ${26 * u}px`, borderRadius: 22 * u, background: "#16A34A", color: "#FFFFFF", fontWeight: 800, fontSize: 26 * u, boxShadow: "0 16px 40px rgba(0,0,0,0.3)", transform: `translateY(${(1 - toast) * -160 * u}px)`, opacity: toast }}>
            ✓ Booked! Tickets sent to your email
          </div>
        </div>
      </div>
      <Burst at={toastAt} color="#4ADE80" y={vertical ? "38%" : "35%"} size={700} />
      {products.some((p) => p.priceText) ? <PriceNote text={spec.priceNote} onPhoto={onPhoto} /> : null}
    </AbsoluteFill>
  );
};

// ---------- payment ----------

const WALLETS = [
  { name: "KBZPay", color: "#1F4FA3" },
  { name: "AYA Pay", color: "#D7262C" },
  { name: "Wave Pay", color: "#F5B400" },
  { name: "MMQR", color: "#1C6E4A" },
];

const PaymentScene: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, vertical, bar } = useLayout();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const icon = useEnter(6, 9);
  const successAt = Math.round(durationInFrames * 0.55);
  const success = useEnter(successAt, 10);
  const iconOut = interpolate(frame, [successAt - 4, successAt + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = useEnter(0);
  const b = useEnter(5);
  const bg =
    t.id === "calling"
      ? `linear-gradient(160deg, #FFA466 0%, ${t.colors.primary} 45%, #F26B1D 100%)`
      : t.id === "flash" || t.id === "journal"
        ? t.colors.bg
        : t.id === "neon"
          ? t.colors.bg
          : `radial-gradient(circle at 50% 30%, #2A2418, ${t.colors.bg} 70%)`;
  const headColor = t.light ? t.colors.text : "#FFFFFF";
  const accentColor = t.id === "calling" ? "#3A1A05" : t.id === "flash" ? "#E8352B" : t.colors.primary;
  return (
    <AbsoluteFill style={{ background: bg }}>
      {t.id === "neon" ? (
        <>
          <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, ${t.colors.primary}66, rgba(0,0,0,0) 45%)` }} />
          <AbsoluteFill style={{ background: `radial-gradient(circle at 80% 85%, ${t.colors.accent}55, rgba(0,0,0,0) 45%)` }} />
        </>
      ) : null}
      {t.photo === "polaroid" ? <Paper /> : null}
      {t.photo === "letterbox" ? <Letterbox /> : null}
      {t.photo === "split" ? <SplitStripes /> : null}
      <CornerLogo />
      <div style={{ position: "absolute", top: (vertical ? 220 : 90) * u + bar, left: 70 * u, right: 70 * u, textAlign: "center", fontFamily: fontFor(t.fonts.headline), fontWeight: 800, fontSize: (t.fonts.headline === "hand" ? 74 : 62) * u, lineHeight: 1.25 }}>
        <div style={{ color: headColor, opacity: a, transform: `translateY(${(1 - a) * 30 * u}px)`, textShadow: t.id === "neon" ? glow(t.colors.primary, u * 0.6) : undefined }}>{scene.headline}</div>
        {scene.highlight ? (
          <div style={{ color: accentColor, opacity: b, transform: `translateY(${(1 - b) * 30 * u}px)`, textShadow: t.id === "neon" ? glow(t.colors.accent, u * 0.6) : undefined }}>{scene.highlight}</div>
        ) : null}
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: (vertical ? 80 : 160) * u }}>
        <div style={{ position: "relative", width: 640 * u, height: 640 * u, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", transform: `scale(${icon * iconOut})`, width: 260 * u, height: 260 * u, borderRadius: "50%", background: "#FFFFFF", border: `${18 * u}px solid #E8352B`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 150 * u, color: "#16120F" }}>฿</span>
            <div style={{ position: "absolute", width: 300 * u, height: 18 * u, background: "#E8352B", transform: "rotate(-45deg)" }} />
          </div>
          {WALLETS.map((w, i) => (
            <WalletChip key={w.name} {...w} index={i} />
          ))}
          <Burst at={successAt} color="#4ADE80" size={800} y="50%" />
          <div style={{ position: "absolute", transform: `scale(${success})`, opacity: success, width: 440 * u, padding: `${40 * u}px ${30 * u}px`, background: t.id === "neon" ? t.colors.cardBg : "#FFFFFF", border: t.id === "neon" ? `${3 * u}px solid ${t.colors.accent}` : undefined, borderRadius: 32 * u, textAlign: "center", fontFamily: FONT_BODY, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ width: 110 * u, height: 110 * u, margin: "0 auto", borderRadius: "50%", background: "#DCFCE7", color: "#16A34A", fontSize: 70 * u, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
            <div style={{ marginTop: 20 * u, fontSize: 36 * u, fontWeight: 800, color: t.id === "neon" ? "#FFFFFF" : "#16120F" }}>Payment successful!</div>
            <div style={{ marginTop: 6 * u, fontSize: 22 * u, color: "#8a8178" }}>Tickets sent instantly</div>
          </div>
        </div>
      </AbsoluteFill>
      {scene.subtitle ? (
        <div style={{ position: "absolute", bottom: (vertical ? 150 : 60) * u + bar, left: 60 * u, right: 60 * u, textAlign: "center", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 34 * u, color: headColor }}>{scene.subtitle}</div>
      ) : null}
    </AbsoluteFill>
  );
};

const WalletChip: React.FC<{ name: string; color: string; index: number }> = ({ name, color, index }) => {
  const u = useUnit();
  const frame = useCurrentFrame();
  const e = useEnter(12 + index * 5, 9);
  const spots = [
    { x: -250, y: -230 },
    { x: 250, y: -200 },
    { x: -260, y: 220 },
    { x: 250, y: 240 },
  ][index];
  const bob = Math.sin((frame + index * 9) / 10) * 8 * u;
  return (
    <div style={{ position: "absolute", transform: `translate(${spots.x * u}px, ${spots.y * u + bob}px) scale(${e})`, display: "flex", alignItems: "center", gap: 12 * u, padding: `${16 * u}px ${24 * u}px`, background: "#FFFFFF", borderRadius: 22 * u, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30 * u, color, boxShadow: "0 12px 30px rgba(0,0,0,0.22)" }}>
      <span style={{ width: 22 * u, height: 22 * u, borderRadius: "50%", background: color }} />
      {name}
    </div>
  );
};

// ---------- outro ----------

const OutroScene: React.FC<SceneProps> = ({ scene }) => {
  const { t, u, vertical, height } = useLayout();
  const logo = useEnter(0, 10);
  const frameIn = useEnter(6, 12);
  const title = useEnter(12, t.id === "cinematic" ? 26 : 10);
  const cta = useEnter(22, 10);
  const frame = useCurrentFrame();
  const ctaPulse = 1 + Math.max(0, Math.sin((frame - 30) / 6)) * 0.04;
  const flicker = useFlicker(12);
  const hasPhoto = Boolean(scene.imageUrl);
  const bg =
    t.id === "calling"
      ? "linear-gradient(180deg, #FFF1E6 0%, #FFE2CC 60%, #FFC9A3 100%)"
      : t.id === "journal" || t.id === "flash"
        ? t.colors.bg
        : t.id === "neon"
          ? `radial-gradient(circle at 50% 35%, ${t.colors.primary}44, ${t.colors.bg} 65%)`
          : `radial-gradient(circle at 50% 40%, #241F16, ${t.colors.bg} 70%)`;
  const headStyle: React.CSSProperties =
    t.id === "neon"
      ? { fontFamily: fontFor("bebas"), color: "#FFFFFF", textShadow: glow(t.colors.primary, u * 1.2), opacity: flicker, letterSpacing: "0.04em" }
      : t.id === "cinematic"
        ? { fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 600, color: t.colors.primary }
        : t.id === "journal"
          ? { fontFamily: FONT_HAND, fontWeight: 700, color: t.colors.text, transform: "rotate(-3deg)" }
          : t.id === "flash"
            ? { fontFamily: fontFor("impact"), color: "#FFC83D", background: "#111", padding: `0 ${26 * u}px`, display: "inline-block", transform: "rotate(-2deg)" }
            : { fontFamily: FONT_BODY, fontWeight: 800, color: "#F26B1D" };
  const subColor = t.light || t.id === "calling" ? "#4A2A12" : t.colors.muted;
  const ctaPill =
    t.id === "cinematic" ? (
      <span style={{ display: "inline-block", padding: `${14 * u}px ${40 * u}px`, border: `${2 * u}px solid ${t.colors.primary}`, color: t.colors.primary, fontFamily: FONT_SERIF, fontSize: 36 * u, letterSpacing: "0.12em" }}>BOOK · JUSTYM.ME</span>
    ) : t.id === "neon" ? (
      <span style={{ display: "inline-block", padding: `${14 * u}px ${40 * u}px`, borderRadius: 999, border: `${3 * u}px solid ${t.colors.accent}`, boxShadow: `0 0 24px ${t.colors.accent}`, color: "#FFFFFF", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 36 * u }}>Book now · justym.me →</span>
    ) : t.id === "flash" ? (
      <Pill bg="#111111" color="#FFC83D" size={40}>
        BOOK NOW · JUSTYM.ME →
      </Pill>
    ) : t.id === "journal" ? (
      <span style={{ display: "inline-block", padding: `${12 * u}px ${34 * u}px`, border: `${5 * u}px solid ${t.colors.accent}`, borderRadius: 14 * u, color: t.colors.accent, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 34 * u, letterSpacing: "0.08em", transform: "rotate(-3deg)" }}>BOOK AT JUSTYM.ME</span>
    ) : (
      <Pill size={38}>Book now · justym.me →</Pill>
    );
  return (
    <AbsoluteFill style={{ background: bg, alignItems: "center", fontFamily: FONT_BODY }}>
      {t.photo === "polaroid" ? <Paper /> : null}
      {t.photo === "letterbox" ? <Letterbox /> : null}
      {t.photo === "split" ? <SplitStripes /> : null}
      <div style={{ marginTop: (vertical ? 150 : 50) * u + (t.photo === "letterbox" ? height * 0.1 : 0), transform: `scale(${logo})` }}>
        <Logo size={(vertical ? 170 : 130) * u} style={{ boxShadow: t.id === "neon" ? `0 0 30px ${t.colors.primary}` : "0 6px 24px rgba(0,0,0,0.2)" }} />
      </div>
      {hasPhoto ? (
        <div
          style={{
            marginTop: 40 * u,
            width: (vertical ? 640 : 520) * u,
            height: (vertical ? 700 : 340) * u,
            borderRadius: (t.id === "journal" ? 0 : t.id === "cinematic" ? 4 : 36) * u,
            border: t.id === "journal" ? `${18 * u}px solid #FFFFFF` : `${10 * u}px solid ${t.id === "neon" ? t.colors.accent : t.id === "flash" ? "#111" : t.colors.primary}`,
            borderBottomWidth: (t.id === "journal" ? 70 : 10) * u,
            overflow: "hidden",
            boxShadow: t.id === "neon" ? `0 0 34px ${t.colors.accent}` : "0 24px 60px rgba(0,0,0,0.25)",
            transform: `rotate(${(1 - frameIn) * -10 - 2}deg) scale(${0.7 + 0.3 * frameIn})`,
            opacity: frameIn,
          }}
        >
          <Img src={scene.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <div style={{ height: vertical ? height * 0.12 : 20 * u }} />
      )}
      <div style={{ marginTop: 40 * u, textAlign: "center", opacity: t.id === "neon" ? 1 : title, transform: `translateY(${(1 - title) * 40 * u}px)` }}>
        <div style={{ fontSize: (vertical ? 100 : 80) * u * (t.id === "journal" ? 1.25 : t.id === "neon" ? 1.3 : 1), lineHeight: 1.1, ...headStyle }}>{scene.headline || "Your Moment."}</div>
        {scene.highlight ? <div style={{ marginTop: 14 * u, fontSize: 36 * u, fontWeight: 600, color: subColor }}>{scene.highlight}</div> : null}
      </div>
      <div style={{ marginTop: 36 * u, transform: `scale(${cta * ctaPulse})`, opacity: cta }}>{ctaPill}</div>
      {t.mascot ? <Mascot size={(vertical ? 340 : 260) * u} delay={14} style={{ left: 10 * u, bottom: (vertical ? 20 : 0) * u }} /> : null}
    </AbsoluteFill>
  );
};

// ---------- helpers ----------

function graphemes(word: string) {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)].map((g) => g.segment);
}

function isLatin(word: string) {
  return /^[\p{Script=Latin}\d\s!?&'’.-]+$/u.test(word);
}

/** Thick white outline (16 offset shadows) plus a soft drop shadow. */
function outline(w: number) {
  const steps = 16;
  const rings = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return `${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 #FFFFFF`;
  });
  return [...rings, `0 ${w * 1.4}px ${w * 3}px rgba(0,0,0,0.35)`].join(", ");
}
