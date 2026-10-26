import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, GRADIENTE_OURO, TEXTO } from "../tema";
import { Frase } from "./Texto";

/** Logo com um brilho que passa, a frase do produto e a chamada. */
export function Encerramento({ duracao, chamada }: { duracao: number; chamada: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 15, stiffness: 90 } });
  const brilho = interpolate(f, [10, 40], [-120, 220], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chip = spring({ frame: f - 26, fps, config: { damping: 12, stiffness: 140 } });
  const pulsa = 1 + 0.03 * Math.sin(Math.max(0, f - 40) / 5);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
      <div style={{ position: "relative", width: 620, height: 775, transform: `scale(${0.8 + entra * 0.2})`, opacity: entra }}>
        <Img
          src={staticFile("logo-completo.webp")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "absolute", inset: 0, mixBlendMode: "screen",
            background: `linear-gradient(105deg, transparent ${brilho - 20}%, rgba(255,240,200,.55) ${brilho}%, transparent ${brilho + 20}%)`,
            maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 55%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 55%, transparent 90%)",
          }}
        />
      </div>
      <div style={{ marginTop: -40 }}>
        <Frase texto="A agenda que trabalha *sozinha.*" duracao={duracao + 20} tamanho={64} atraso={3} />
      </div>
      <div
        style={{
          fontFamily: TEXTO, fontWeight: 800, fontSize: 38, letterSpacing: 4, textTransform: "uppercase",
          color: "#0B0B14", backgroundImage: GRADIENTE_OURO, padding: "24px 56px",
          clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px))",
          transform: `scale(${chip * pulsa})`, opacity: chip,
          boxShadow: `0 0 60px ${COR.ouro}55`,
        }}
      >
        {chamada}
      </div>
    </AbsoluteFill>
  );
}
