import React from "react";
import { Composition } from "remotion";
import { GeneratedVideo } from "./GeneratedVideo";
import { COMPOSITION_ID, DIMENSIONS, emptyScene, FPS, totalFrames, type VideoSpec } from "./schema";

const DREAM_WORLD = {
  name: "Dream World Bangkok",
  city: "Bangkok",
  imageUrl: "https://api.justym.me/file/image/product/media/696f24db9b2ac5b1393bb766_NNV2mPJK38tYXMFX135im.jpg",
  priceText: "฿1,000",
  pageUrl: "https://www.justym.me/en/ticket/dream-world-bangkok/696f374de7f923b345648a3d",
};

// Used by Remotion Studio (`npm run studio`) and as the default props.
const sampleSpec: VideoSpec = {
  version: 2,
  template: "pulse",
  seed: 1,
  sfx: true,
  title: "Bangkok is Calling",
  aspectRatio: "9:16",
  priceNote: "*Prices shown on justym.me. Subject to change.",
  music: "sunny-pop.mp3",
  scenes: [
    emptyScene("hook", { kicker: "Hello", headline: "BANGKOK", subtitle: "Your trip starts here", imageUrl: DREAM_WORLD.imageUrl }),
    emptyScene("attraction", {
      tag: "DREAM WORLD",
      location: "@BANGKOK",
      headline: "Bangkok ရဲ့ နာမည်ကြီး",
      highlight: "Dream World လက်မှတ်",
      subtitle: "Bangkok's famous theme park",
      imageUrl: DREAM_WORLD.imageUrl,
      products: [DREAM_WORLD],
      durationInSeconds: 3.5,
      transition: "signature",
    }),
    emptyScene("payment", { headline: "ဘတ်ငွေ လဲစရာ မလို!", highlight: "KPay · AYA Pay နဲ့ ချက်ချင်း", subtitle: "Pay instantly with Myanmar wallets", durationInSeconds: 3.5 }),
    emptyScene("outro", { headline: "Your Moment.", highlight: "Book now on justym.me", durationInSeconds: 3.5, transition: "cut" }),
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={GeneratedVideo}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={totalFrames(sampleSpec)}
    defaultProps={{ spec: sampleSpec }}
    calculateMetadata={({ props }) => ({
      durationInFrames: totalFrames(props.spec),
      ...DIMENSIONS[props.spec.aspectRatio],
    })}
  />
);
