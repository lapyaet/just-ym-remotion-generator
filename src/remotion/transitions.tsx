import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { Template } from "./templates";

type ColorProps = { color: string; accent: string };

/** A circle grows over the outgoing scene, then shrinks away over the next one. */
const CircleWipe: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
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
            background: `radial-gradient(circle, ${passedProps.accent} 0%, ${passedProps.color} 60%)`,
            transform: `scale(${radius})`,
            flexShrink: 0,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Fade to a solid colour, then up from it (cinematic dip-to-black). */
const Dip: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  const cover = exiting ? Math.min(1, p * 2) : Math.max(0, 1 - (p - 0.5) * 2);
  const visible = exiting ? p < 0.5 : p >= 0.5;
  return (
    <AbsoluteFill style={{ opacity: visible ? 1 : 0 }}>
      {children}
      <AbsoluteFill style={{ background: passedProps.color, opacity: cover }} />
    </AbsoluteFill>
  );
};

/** Quick bright flash between scenes (neon). */
const Flash: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  const visible = exiting ? p < 0.5 : p >= 0.5;
  const flash = Math.max(0, 1 - Math.abs(p - 0.5) * 4);
  return (
    <AbsoluteFill style={{ opacity: visible ? 1 : 0, transform: `scale(${1 + flash * 0.06})` }}>
      {children}
      <AbsoluteFill style={{ background: `radial-gradient(circle, #FFFFFF 0%, ${passedProps.color} 55%, ${passedProps.accent} 100%)`, opacity: flash }} />
    </AbsoluteFill>
  );
};

/**
 * Zoom-blur cut (Modern Pulse): the old scene rushes towards the camera and
 * blurs out while the new one settles in from a blur, with a white flash.
 */
const ZoomBlur: React.FC<TransitionPresentationComponentProps<{ flash: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  if (presentationDirection === "exiting") {
    const e = Easing.in(Easing.cubic)(p);
    return <AbsoluteFill style={{ transform: `scale(${1 + 0.25 * e})`, filter: e > 0.02 ? `blur(${18 * e}px)` : undefined }}>{children}</AbsoluteFill>;
  }
  const e = Easing.out(Easing.cubic)(p);
  const flash = passedProps.flash * Math.max(0, 1 - Math.abs(p - 0.4) * 3.5);
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, p * 1.8), transform: `scale(${1.15 - 0.15 * e})`, filter: e < 0.98 ? `blur(${14 * (1 - e)}px)` : undefined }}>
      {children}
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash }} />
    </AbsoluteFill>
  );
};

export function zoomBlur(flash: number): TransitionPresentation<Record<string, unknown>> {
  return { component: ZoomBlur, props: { flash } } as unknown as TransitionPresentation<Record<string, unknown>>;
}

const make = (component: React.FC<TransitionPresentationComponentProps<ColorProps>>, props: ColorProps): TransitionPresentation<ColorProps> => ({ component, props });

/** The template's signature transition, used for its 1-2 big moments. */
export function signatureTransition(t: Template, index: number): TransitionPresentation<Record<string, unknown>> {
  const colors = { color: t.colors.primary, accent: t.colors.accent };
  const any = <P extends Record<string, unknown>>(p: TransitionPresentation<P>) => p as unknown as TransitionPresentation<Record<string, unknown>>;
  switch (t.signature) {
    case "dip":
      return any(make(Dip, { color: "#000000", accent: "#000000" }));
    case "slide":
      return any(slide({ direction: index % 2 ? "from-left" : "from-right" }));
    case "flash":
      return any(make(Flash, colors));
    case "zoom":
      return zoomBlur(0.8);
    case "wipe":
      return any(wipe({ direction: index % 2 ? "from-top-right" : "from-left" }));
    default:
      return any(make(CircleWipe, { color: t.colors.primary, accent: t.id === "calling" ? "#FFB07A" : t.colors.accent }));
  }
}
