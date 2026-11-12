import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { ThemeProvider } from "./components";
import { TemplateFX } from "./fx";
import { SFX, type SfxName } from "./music";
import { SceneView } from "./scenes";
import { signatureTransition } from "./transitions";
import { sceneTimeline, TRANSITION_FRAMES, type VideoSpec } from "./schema";
import { getTemplate, type Template } from "./templates";
import "./fonts";

export const GeneratedVideo: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const { frames } = sceneTimeline(spec);
  const t = getTemplate(spec.template);
  return (
    <ThemeProvider value={{ t, seed: spec.seed, index: 0 }}>
      <AbsoluteFill style={{ backgroundColor: t.colors.bg }}>
        <TransitionSeries>
          {spec.scenes.flatMap((scene, i) => {
            const items = [
              <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames[i]} name={`${i + 1}. ${scene.type}`}>
                <SceneView scene={scene} spec={spec} index={i} />
              </TransitionSeries.Sequence>,
            ];
            const isLast = i === spec.scenes.length - 1;
            if (!isLast && scene.transition !== "cut") {
              const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });
              items.push(
                scene.transition === "signature" ? (
                  <TransitionSeries.Transition key={`t${i}`} timing={timing} presentation={signatureTransition(t, i)} />
                ) : (
                  <TransitionSeries.Transition key={`t${i}`} timing={timing} presentation={fade()} />
                ),
              );
            }
            return items;
          })}
        </TransitionSeries>
        <TemplateFX />
        {spec.music ? <Music file={spec.music} /> : null}
        {spec.sfx ? <SoundEffects spec={spec} t={t} /> : null}
      </AbsoluteFill>
    </ThemeProvider>
  );
};

/** Background music from /public/music: looped, faded in and out. */
const Music: React.FC<{ file: string }> = ({ file }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <Audio
      src={staticFile(`music/${file}`)}
      loop
      volume={(f) =>
        interpolate(f, [0, fps * 0.5, durationInFrames - fps * 1.5, durationInFrames], [0, 0.7, 0.7, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

type Cue = { at: number; name: SfxName; volume: number };

const SFX_LENGTH: Record<SfxName, number> = { whoosh: 18, pop: 7, impact: 42, ding: 36, riser: 48, click: 3, sparkle: 27, swipe: 11, stamp: 12 };

/**
 * Sound design: whooshes on cuts, a riser into the outro, and hits on each
 * scene's key moment (letters popping, cards landing, payment success...).
 * Frames match the animations in scenes.tsx.
 */
function soundCues(spec: VideoSpec, t: Template): Cue[] {
  const { frames, starts, cuts } = sceneTimeline(spec);
  const cues: Cue[] = [];
  const add = (at: number, name: SfxName, volume: number) => {
    if (at >= 0) cues.push({ at: Math.round(at), name, volume });
  };

  spec.scenes.forEach((scene, i) => {
    const s = starts[i];
    const f = frames[i];
    // Scene key moments.
    if (scene.type === "hook") {
      if (t.hook === "pop") {
        add(s + 24, "pop", 0.5);
        add(s + 26, "sparkle", 0.3);
      }
      if (t.hook === "slam") add(s + 14, "impact", 0.7);
      if (t.hook === "stamp") add(s + 22, "stamp", 0.7);
      if (t.hook === "flicker") add(s + 9, "sparkle", 0.45);
      if (t.hook === "curtain") {
        add(s + 4, "whoosh", 0.35);
        add(s + 30, "impact", 0.35);
      }
    }
    if (scene.type === "attraction" && scene.products.length) add(s + 9, "pop", 0.35);
    if (scene.type === "deals") scene.products.slice(0, 4).forEach((_, k) => add(s + 8 + k * 5, "pop", 0.28));
    if (scene.type === "deals" && scene.discount) add(s + 20, "sparkle", 0.35);
    if (scene.type === "app") {
      add(s + 6, "whoosh", 0.3);
      add(s + Math.round(f * 0.6), "click", 0.6);
      add(s + Math.round(f * 0.72), "ding", 0.45);
    }
    if (scene.type === "payment") add(s + Math.round(f * 0.55), "ding", 0.5);
    if (scene.type === "outro") {
      add(s - 46, "riser", 0.3);
      add(s + 2, t.id === "flash" || t.id === "calling" ? "impact" : "sparkle", 0.45);
    }
    // The cut into the next scene.
    if (i < spec.scenes.length - 1 && scene.transition !== "cut") {
      const big = scene.transition === "signature";
      const name: SfxName = t.signature === "slide" ? "swipe" : "whoosh";
      add(cuts[i] - (name === "swipe" ? 5 : 9), name, big ? 0.5 : 0.28);
      if (big && t.signature === "flash") add(cuts[i] - 2, "sparkle", 0.35);
      if (big && (t.signature === "wipe" || t.signature === "orange-wipe")) add(cuts[i] - 1, "impact", 0.3);
    }
  });
  return cues;
}

const SoundEffects: React.FC<{ spec: VideoSpec; t: Template }> = ({ spec, t }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      {soundCues(spec, t)
        .filter((c) => c.at < durationInFrames - 2)
        .map((c, i) => (
          <Sequence key={i} from={c.at} durationInFrames={Math.min(SFX_LENGTH[c.name] + 2, durationInFrames - c.at)} layout="none" name={`sfx ${c.name}`}>
            <Audio src={staticFile(SFX[c.name])} volume={c.volume} />
          </Sequence>
        ))}
    </>
  );
};
