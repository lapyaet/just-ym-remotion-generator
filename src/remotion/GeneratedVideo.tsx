import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, staticFile, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { SceneView } from "./scenes";
import { orangeWipe } from "./transitions";
import { BRAND, sceneFrames, TRANSITION_FRAMES, type VideoSpec } from "./schema";
import "./fonts";

export const GeneratedVideo: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const frames = sceneFrames(spec);
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.ink }}>
      <TransitionSeries>
        {spec.scenes.flatMap((scene, i) => {
          const items = [
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames[i]} name={`${i + 1}. ${scene.type}`}>
              <SceneView scene={scene} spec={spec} />
            </TransitionSeries.Sequence>,
          ];
          const isLast = i === spec.scenes.length - 1;
          if (!isLast && scene.transition !== "cut") {
            const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });
            items.push(
              scene.transition === "orange-wipe" ? (
                <TransitionSeries.Transition key={`t${i}`} timing={timing} presentation={orangeWipe()} />
              ) : (
                <TransitionSeries.Transition key={`t${i}`} timing={timing} presentation={fade()} />
              ),
            );
          }
          return items;
        })}
      </TransitionSeries>
      {spec.music ? <Music file={spec.music} /> : null}
    </AbsoluteFill>
  );
};

/** Background music from /public/music: looped, faded in and out. */
const Music: React.FC<{ file: string }> = ({ file }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <Html5Audio
      src={staticFile(`music/${file}`)}
      loop
      volume={(f) =>
        interpolate(f, [0, fps * 0.5, durationInFrames - fps * 1.5, durationInFrames], [0, 0.8, 0.8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};
