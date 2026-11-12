import React from "react";
import { AbsoluteFill } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { BRAND } from "./schema";

type Props = Record<string, never>;

/**
 * Orange circle that grows over the outgoing scene, then shrinks away to
 * reveal the next one (the Just YM reel transition).
 */
const OrangeWipe: React.FC<TransitionPresentationComponentProps<Props>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const exiting = presentationDirection === "exiting";
  // 0..0.5: circle grows over the old scene; 0.5..1: circle shrinks over the new one.
  const radius = exiting ? Math.min(1, p * 2) : Math.max(0, 1 - (p - 0.5) * 2);
  const visible = exiting ? p < 0.5 : p >= 0.5;
  return (
    <AbsoluteFill style={{ opacity: visible ? 1 : 0 }}>
      {children}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", overflow: "hidden", pointerEvents: "none" }}>
        <div
          style={{
            width: "250vmax",
            height: "250vmax",
            borderRadius: "50%",
            background: `radial-gradient(circle, #FFB07A 0%, ${BRAND.orange} 55%, ${BRAND.orangeDeep} 100%)`,
            transform: `scale(${radius})`,
            flexShrink: 0,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const orangeWipe = (): TransitionPresentation<Props> => ({ component: OrangeWipe, props: {} });
