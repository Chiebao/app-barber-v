import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Fundo } from "./componentes/Fundo";
import { Celular, CELULAR_A, TELA_A, quadroDe, type Gravacao } from "./componentes/Celular";
import { Frase } from "./componentes/Texto";
import { Notificacao } from "./componentes/Notificacao";
import { Encerramento } from "./componentes/Encerramento";
import gravacaoJson from "./gravacoes/cliente-agenda.json";

const gravacao = gravacaoJson as Gravacao;

// Amostra de estilo (~17s): gancho → o cliente agenda sozinho → o barbeiro
// recebe o aviso → logo e chamada.
const VELOCIDADE = 1.25;
const GANCHO = 66;               // quadros só com a pergunta
const VIDEO = 70;                // quando a gravação começa a tocar
const marca = (rotulo: string) => {
  const e = gravacao.eventos.find(ev => ev.tipo === "marca" && ev.rotulo === rotulo);
  if (!e) throw new Error(`marca "${rotulo}" não está na gravação`);
  return VIDEO + quadroDe(e.t, VELOCIDADE);
};
const CONFIRMOU = marca("confirmar");
const AVISO = CONFIRMOU + 22;
const FIM_CELULAR = AVISO + 95;
const ENCERRAMENTO = 80;
export const DURACAO_AMOSTRA = FIM_CELULAR + ENCERRAMENTO;

const LEGENDAS: { de: number; ate: number; texto: string }[] = [
  { de: VIDEO - 6, ate: marca("telefone"), texto: "Seu cliente abre o *link*" },
  { de: marca("telefone"), ate: marca("servico"), texto: "coloca nome e telefone" },
  { de: marca("servico"), ate: marca("data"), texto: "escolhe o *serviço*" },
  { de: marca("data"), ate: CONFIRMOU, texto: "o dia e o *horário*" },
  { de: CONFIRMOU, ate: AVISO + 26, texto: "e confirma. *Sozinho.*" },
  { de: AVISO + 26, ate: FIM_CELULAR, texto: "Você só recebe\no *aviso.*" },
];

/**
 * A câmera segue o dedo: aproxima e corre para o próximo toque um pouco
 * antes dele acontecer, como quem acompanha com o olho.
 */
function useCamera() {
  const f = useCurrentFrame();
  const toques = gravacao.eventos.filter(e => e.tipo === "toque") as Extract<Gravacao["eventos"][number], { tipo: "toque" }>[];
  const chaves: number[] = [], ys: number[] = [];
  for (const t of toques) {
    const q = VIDEO + quadroDe(t.t, VELOCIDADE) - 8;
    if (chaves.length && q <= chaves[chaves.length - 1] + 1) continue;
    chaves.push(q); ys.push(t.y);
  }
  const foco = interpolate(f, chaves, ys, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const zoom = interpolate(f, [VIDEO, VIDEO + 20, AVISO - 10, AVISO + 10], [1, 1.2, 1.2, 1.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  // Ponto focado (0..1 na tela) vai na direção do centro do aparelho.
  const deslocamento = (0.5 - foco) * TELA_A * (zoom - 1) * 1.6;
  return { zoom, deslocamento: zoom > 1.01 ? deslocamento : 0 };
}

function Palco() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f - (GANCHO - 16), fps, config: { damping: 16, stiffness: 70, mass: 1.1 } });
  const sai = interpolate(f, [FIM_CELULAR - 14, FIM_CELULAR], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const { zoom, deslocamento } = useCamera();
  const giroY = -16 * (1 - entra) + 7 * Math.sin(f / 40) * entra;
  const giroX = 28 * (1 - entra) + 3 * Math.sin(f / 55);
  const BASE = 0.94;
  return (
    <AbsoluteFill style={{ perspective: 2600, alignItems: "center" }}>
      <div
        style={{
          position: "absolute", top: 1225 - (CELULAR_A * BASE) / 2,
          transform: `translateY(${(1 - entra) * 1200 + sai * 1400 + deslocamento}px) rotateX(${giroX}deg) rotateY(${giroY}deg) scale(${BASE * zoom})`,
          transformOrigin: "50% 40%",
        }}
      >
        <Sequence from={VIDEO} layout="none">
          <Celular video="gravacoes/cliente-agenda.mp4" gravacao={gravacao} velocidade={VELOCIDADE}>
            <Sequence from={AVISO - VIDEO} layout="none">
              <Notificacao titulo="Novo agendamento! 💈" corpo="Carlos — Fade, Barba — amanhã às 11:30" />
            </Sequence>
          </Celular>
        </Sequence>
        {f < VIDEO && (
          <Celular video="gravacoes/cliente-agenda.mp4" gravacao={{ ...gravacao, eventos: [] }} velocidade={VELOCIDADE} />
        )}
      </div>
    </AbsoluteFill>
  );
}

export function Amostra() {
  return (
    <AbsoluteFill>
      <Fundo />
      <Sequence durationInFrames={GANCHO}>
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 70px" }}>
          <Frase texto={"Barbeiro, ainda marca\ncliente pelo *WhatsApp?*"} duracao={GANCHO} tamanho={104} atraso={4} />
        </AbsoluteFill>
      </Sequence>
      <Sequence durationInFrames={FIM_CELULAR}>
        <Palco />
      </Sequence>
      {LEGENDAS.map((l, i) => (
        <Sequence key={i} from={l.de} durationInFrames={l.ate - l.de}>
          <AbsoluteFill style={{ top: 150, height: 420, justifyContent: "center", padding: "0 60px" }}>
            <Frase texto={l.texto} duracao={l.ate - l.de} tamanho={84} />
          </AbsoluteFill>
        </Sequence>
      ))}
      <Sequence from={FIM_CELULAR}>
        <Encerramento duracao={ENCERRAMENTO} chamada="Link na bio" />
      </Sequence>
    </AbsoluteFill>
  );
}
