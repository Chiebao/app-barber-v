import type { ReactNode } from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { COR, FPS, TEXTO } from "../tema";

export type Evento =
  | { tipo: "toque"; t: number; x: number; y: number; rotulo: string | null }
  | { tipo: "digita"; t: number; texto: string }
  | { tipo: "marca"; t: number; rotulo: string };

export type Gravacao = { duracao: number; largura: number; altura: number; eventos: Evento[] };

// Medidas do aparelho no quadro de 1080x1920.
export const TELA_L = 560;
export const BARRA = 62; // barra de status desenhada por cima da gravação
const ESCALA_TELA = TELA_L / 390;
export const TELA_A = Math.round(844 * ESCALA_TELA) + BARRA;
const MOLDURA = 18;
export const CELULAR_L = TELA_L + MOLDURA * 2;
export const CELULAR_A = TELA_A + MOLDURA * 2;

/** Quadro (relativo ao início do vídeo) em que um instante da gravação aparece. */
export const quadroDe = (t: number, velocidade: number) => Math.round((t / velocidade) * FPS);

function BarraDeStatus() {
  return (
    <div
      style={{
        height: BARRA, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 40px 0", color: COR.texto, fontFamily: TEXTO, fontWeight: 700, fontSize: 22,
        backgroundColor: COR.fundo2, position: "relative",
      }}
    >
      <span>9:41</span>
      <div style={{ position: "absolute", left: "50%", top: 12, width: 150, height: 40, marginLeft: -75, borderRadius: 999, background: "#000" }} />
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <svg width="30" height="18" viewBox="0 0 30 18"><g fill={COR.texto}>{[0, 1, 2, 3].map(i => <rect key={i} x={i * 8} y={12 - i * 4} width="5" height={6 + i * 4} rx="1.5" />)}</g></svg>
        <svg width="40" height="20" viewBox="0 0 40 20"><rect x="1" y="1" width="33" height="18" rx="5" fill="none" stroke={COR.texto} strokeOpacity=".5" strokeWidth="2" /><rect x="4" y="4" width="24" height="12" rx="3" fill={COR.texto} /><rect x="36" y="7" width="3" height="6" rx="1.5" fill={COR.texto} fillOpacity=".5" /></svg>
      </span>
    </div>
  );
}

/** O "dedo": um ponto que encosta e uma onda dourada que se abre. */
function Toques({ eventos, velocidade }: { eventos: Evento[]; velocidade: number }) {
  const f = useCurrentFrame();
  return (
    <>
      {eventos.filter((e): e is Extract<Evento, { tipo: "toque" }> => e.tipo === "toque").map((e, i) => {
        const fe = quadroDe(e.t, velocidade) + 2; // o toque é registrado 140ms antes do clique
        const d = f - fe;
        // Curto de propósito: a tela troca ~0,2s depois do toque, e a onda que
        // sobra por cima da tela nova parece tocar no botão errado.
        if (d < -7 || d > 9) return null;
        const x = e.x * TELA_L, y = BARRA + e.y * (TELA_A - BARRA);
        const ponto = interpolate(d, [-7, 0, 5], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const raio = interpolate(d, [0, 9], [18, 80], { extrapolateLeft: "clamp", easing: Easing.out(Easing.cubic) });
        const onda = interpolate(d, [0, 2, 9], [0, 0.95, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: 999, background: "rgba(255,255,255,0.55)", border: "3px solid rgba(255,255,255,0.9)", transform: `scale(${0.6 + ponto * 0.4})`, opacity: ponto, boxShadow: "0 6px 24px rgba(0,0,0,.45)" }} />
            <div style={{ position: "absolute", left: x - raio, top: y - raio, width: raio * 2, height: raio * 2, borderRadius: 999, border: `5px solid ${COR.ouro}`, background: `${COR.ouro}22`, opacity: onda }} />
          </div>
        );
      })}
    </>
  );
}

/**
 * Celular com a gravação do app dentro. `children` desenha por cima da tela
 * (notificação). Quando a gravação acaba, a tela fica parada no último quadro.
 */
export function Celular({ video, gravacao, velocidade, children }: {
  video: string; gravacao: Gravacao; velocidade: number; children?: ReactNode;
}) {
  const ultimo = quadroDe(gravacao.duracao, velocidade) - 2;
  return (
    <div
      style={{
        width: CELULAR_L, height: CELULAR_A, borderRadius: 92, padding: MOLDURA, position: "relative",
        background: "linear-gradient(145deg, #3a3a44 0%, #0d0d12 35%, #24242c 60%, #050507 100%)",
        boxShadow: `0 0 0 2px #54545e inset, 0 60px 120px rgba(0,0,0,.7), 0 0 90px ${COR.ouro}26`,
      }}
    >
      <div style={{ width: TELA_L, height: TELA_A, borderRadius: 76, overflow: "hidden", position: "relative", background: COR.fundo2 }}>
        <BarraDeStatus />
        <Freeze frame={ultimo} active={(f) => f >= ultimo}>
          <OffthreadVideo
            src={staticFile(video)}
            playbackRate={velocidade}
            muted
            style={{ width: TELA_L, height: TELA_A - BARRA, display: "block" }}
          />
          <AbsoluteFill>
            <Toques eventos={gravacao.eventos} velocidade={velocidade} />
          </AbsoluteFill>
        </Freeze>
        {children}
      </div>
      {/* reflexo no vidro */}
      <div style={{ position: "absolute", inset: MOLDURA, borderRadius: 76, pointerEvents: "none", background: "linear-gradient(120deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 28%)" }} />
    </div>
  );
}
