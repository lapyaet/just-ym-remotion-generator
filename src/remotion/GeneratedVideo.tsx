import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS, type Scene, type VideoSpec } from "./schema";

const FONTS: Record<VideoSpec["theme"]["font"], string> = {
  sans: "Inter, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', Menlo, Consolas, monospace",
  display: "'Arial Black', Impact, 'Helvetica Neue', sans-serif",
};

type Theme = VideoSpec["theme"];

export const GeneratedVideo: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const durations = spec.scenes.map((s) => Math.round(s.durationInSeconds * FPS));
  const starts = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <AbsoluteFill style={{ backgroundColor: spec.theme.background, fontFamily: FONTS[spec.theme.font] }}>
      {spec.scenes.map((scene, i) => {
        const duration = durations[i];
        const start = starts[i];
        return (
          <Sequence key={i} from={start} durationInFrames={duration} name={`${i + 1}. ${scene.type}`}>
            <SceneView scene={scene} theme={spec.theme} duration={duration} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const Background: React.FC<{ kind: Scene["background"]; theme: Theme }> = ({ kind, theme }) => {
  const frame = useCurrentFrame();
  const drift = frame * 0.4;
  const style: React.CSSProperties = { backgroundColor: theme.background };
  if (kind === "gradient") {
    style.backgroundImage = `linear-gradient(${135 + drift * 0.2}deg, ${theme.background} 0%, ${theme.primary}55 55%, ${theme.accent}33 100%)`;
  } else if (kind === "radial") {
    style.backgroundImage = `radial-gradient(circle at ${50 + Math.sin(frame / 40) * 15}% ${45 + Math.cos(frame / 50) * 10}%, ${theme.primary}66 0%, ${theme.background} 65%)`;
  } else if (kind === "grid") {
    style.backgroundImage = `linear-gradient(${theme.text}11 2px, transparent 2px), linear-gradient(90deg, ${theme.text}11 2px, transparent 2px)`;
    style.backgroundSize = "80px 80px";
    style.backgroundPosition = `${drift}px ${drift}px`;
  }
  return <AbsoluteFill style={style} />;
};

/** Entrance (and exit fade) for a child, offset by `delay` frames. */
const Animated: React.FC<{
  animation: Scene["animation"];
  delay?: number;
  duration: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ animation, delay = 0, duration, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let transform = "none";
  if (animation === "slide-up") transform = `translateY(${(1 - t) * 80}px)`;
  if (animation === "zoom") transform = `scale(${0.8 + t * 0.2})`;
  return <div style={{ opacity: t * exit, transform, ...style }}>{children}</div>;
};

const Typewriter: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  const chars = Math.floor(interpolate(frame - delay, [0, text.length * 1.2], [0, text.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.linear,
  }));
  return (
    <>
      {text.slice(0, chars)}
      <span style={{ opacity: frame % 30 < 15 ? 1 : 0 }}>|</span>
    </>
  );
};

const SceneView: React.FC<{ scene: Scene; theme: Theme; duration: number }> = ({ scene, theme, duration }) => {
  const { width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080; // scale type to the frame
  const anim = scene.animation;
  const heading = anim === "typewriter" ? <Typewriter text={scene.heading} /> : scene.heading;

  const headingSize = { title: 120, text: 84, bullets: 80, quote: 52, stat: 220, outro: 110 }[scene.type] * unit;

  return (
    <AbsoluteFill>
      <Background kind={scene.background} theme={theme} />
      <AbsoluteFill
        style={{
          padding: 100 * unit,
          justifyContent: "center",
          alignItems: scene.type === "bullets" || scene.type === "text" ? "flex-start" : "center",
          textAlign: scene.type === "bullets" || scene.type === "text" ? "left" : "center",
          color: theme.text,
          gap: 36 * unit,
        }}
      >
        {scene.emoji ? (
          <Animated animation="zoom" duration={duration}>
            <div style={{ fontSize: 120 * unit }}>{scene.emoji}</div>
          </Animated>
        ) : null}

        {scene.type === "quote" ? (
          <>
            <Animated animation={anim === "typewriter" ? "fade" : anim} duration={duration}>
              <div style={{ fontSize: 72 * unit, lineHeight: 1.25, fontStyle: "italic", maxWidth: 1500 * unit }}>
                “{scene.body}”
              </div>
            </Animated>
            <Animated animation="fade" delay={15} duration={duration}>
              <div style={{ fontSize: headingSize, color: theme.accent }}>— {scene.heading}</div>
            </Animated>
          </>
        ) : (
          <>
            <Animated animation={anim === "typewriter" ? "fade" : anim} duration={duration}>
              <div
                style={{
                  fontSize: headingSize,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: scene.type === "stat" ? theme.primary : theme.text,
                  maxWidth: 1600 * unit,
                }}
              >
                {heading}
              </div>
            </Animated>

            {scene.type !== "bullets" && scene.body ? (
              <Animated animation="fade" delay={12} duration={duration}>
                <div style={{ fontSize: 44 * unit, lineHeight: 1.35, opacity: 0.85, maxWidth: 1400 * unit }}>
                  {scene.body}
                </div>
              </Animated>
            ) : null}

            {scene.type === "bullets" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 * unit }}>
                {scene.items.map((item, i) => (
                  <Animated key={i} animation="slide-up" delay={12 + i * 8} duration={duration}>
                    <div style={{ display: "flex", alignItems: "center", gap: 24 * unit, fontSize: 52 * unit }}>
                      <span style={{ width: 18 * unit, height: 18 * unit, borderRadius: 999, background: theme.accent, flexShrink: 0 }} />
                      {item}
                    </div>
                  </Animated>
                ))}
              </div>
            ) : null}

            {scene.type === "title" || scene.type === "outro" ? (
              <Animated animation="fade" delay={18} duration={duration}>
                <div style={{ width: 160 * unit, height: 10 * unit, borderRadius: 999, background: theme.accent }} />
              </Animated>
            ) : null}
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
