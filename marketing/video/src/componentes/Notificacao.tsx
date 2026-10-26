import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, TEXTO } from "../tema";

/** Push do celular do barbeiro — mesmo texto que `api/appointments` manda. */
export function Notificacao({ titulo, corpo }: { titulo: string; corpo: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const desce = spring({ frame: f, fps, config: { damping: 13, stiffness: 120 } });
  return (
    <div
      style={{
        position: "absolute", left: 16, right: 16, top: 70,
        transform: `translateY(${(1 - desce) * -240}px) scale(${0.92 + desce * 0.08})`, opacity: Math.min(1, desce * 1.5),
        background: "rgba(30, 30, 40, 0.82)", backdropFilter: "blur(24px)",
        borderRadius: 34, padding: "22px 24px", display: "flex", gap: 18, alignItems: "flex-start",
        boxShadow: `0 24px 60px rgba(0,0,0,.55), 0 0 0 1.5px ${COR.ouro}55`,
        fontFamily: TEXTO,
      }}
    >
      <Img src={staticFile("logo.png")} style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: COR.texto2, fontSize: 19, fontWeight: 700, letterSpacing: 1 }}>
          <span>BARBERPRO</span><span>agora</span>
        </div>
        <div style={{ color: COR.texto, fontSize: 25, fontWeight: 800, marginTop: 4 }}>{titulo}</div>
        <div style={{ color: "#D6D6DE", fontSize: 22, fontWeight: 500, marginTop: 2, lineHeight: 1.3 }}>{corpo}</div>
      </div>
    </div>
  );
}
