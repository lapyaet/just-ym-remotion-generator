import React from "react";
import { Composition } from "remotion";
import { GeneratedVideo } from "./GeneratedVideo";
import { COMPOSITION_ID, DIMENSIONS, FPS, totalFrames, type VideoSpec } from "./schema";

// Used by Remotion Studio (`npm run studio`) and by the server renderer.
const sampleSpec: VideoSpec = {
  title: "Sample video",
  aspectRatio: "16:9",
  theme: { background: "#0f172a", primary: "#6366f1", accent: "#f59e0b", text: "#f8fafc", font: "sans" },
  scenes: [
    { type: "title", heading: "Make videos from a prompt", body: "", items: [], emoji: "🎬", durationInSeconds: 3, animation: "zoom", background: "radial" },
    { type: "bullets", heading: "How it works", body: "", items: ["Describe your video", "Claude writes the script", "Remotion renders the MP4"], emoji: "", durationInSeconds: 5, animation: "slide-up", background: "grid" },
    { type: "outro", heading: "Try it now", body: "Sign in with Google to start", items: [], emoji: "🚀", durationInSeconds: 3, animation: "fade", background: "gradient" },
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={GeneratedVideo}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={totalFrames(sampleSpec)}
    defaultProps={{ spec: sampleSpec }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, totalFrames(props.spec)),
      ...DIMENSIONS[props.spec.aspectRatio],
    })}
  />
);
