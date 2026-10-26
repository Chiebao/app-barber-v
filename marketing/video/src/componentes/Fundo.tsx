import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COR } from "../tema";

/** Fundo HUD: grade fina, brilho dourado que respira e vinheta. */
export function Fundo() {
  const f = useCurrentFrame();
  const respira = 0.55 + 0.15 * Math.sin(f / 22);
  const deriva = interpolate(f, [0, 900], [0, -120]);
  return (
    <AbsoluteFill style={{ backgroundColor: COR.fundo, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${COR.borda}55 1px, transparent 1px), linear-gradient(90deg, ${COR.borda}55 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          backgroundPosition: `0 ${deriva}px`,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 85%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 620px at 50% 58%, ${COR.ouro}${Math.round(respira * 40).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)" }} />
    </AbsoluteFill>
  );
}
