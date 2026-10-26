import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Fundo } from "./componentes/Fundo";
import { Celular, CELULAR_A, TELA_A, TELA_L, BARRA, type Gravacao, type Toque } from "./componentes/Celular";
import { Frase } from "./componentes/Texto";
import { Notificacao } from "./componentes/Notificacao";
import { Encerramento } from "./componentes/Encerramento";
import { montarLinha } from "./linha-do-tempo";
import { FPS } from "./tema";
import gravacaoJson from "./gravacoes/cliente-agenda.json";
import falas from "./narracao/cliente-agenda.json";
import narracao from "./narracao/cliente-agenda.duracoes.json";

// "O cliente agenda sozinho": gancho → o passo a passo no celular, narrado →
// o barbeiro recebe o aviso → logo e chamada. ~27s.

const gravacao = gravacaoJson as Gravacao;
const VIDEO = "gravacoes/cliente-agenda.mp4";

const linha = montarLinha({
  gravacao,
  duracoes: narracao.duracoes,
  antes: [{ id: "gancho", folga: 0.35 }],
  video: ["nome", "telefone", "servicos", "escolhe", "data", "horario", "confirmar"],
  depois: [{ id: "aviso", folga: 0.5 }, { id: "fim", folga: 0.9 }],
});
export const DURACAO_CLIENTE_AGENDA = linha.total;

const GANCHO = linha.trecho("gancho");
const AVISO = linha.trecho("aviso");
const FIM = linha.trecho("fim");
const legenda = (id: string) => falas.find(f => f.id === id)!.texto;

const toques: Toque[] = gravacao.eventos
  .filter(e => e.tipo === "toque")
  .map(e => ({ quadro: linha.quadroDaGravacao(e.t), x: (e as { x: number }).x, y: (e as { y: number }).y }));

/** A tela do celular: cada trecho toca o seu pedaço da gravação no ritmo da fala. */
function TelaDoApp() {
  const ultimo = linha.ultimoVideo;
  return (
    <>
      {/* Antes do primeiro trecho (o celular já está subindo): primeiro quadro */}
      <Sequence durationInFrames={linha.primeiroVideo.de} layout="none">
        <Freeze frame={0}>
          <OffthreadVideo src={staticFile(VIDEO)} muted style={{ width: TELA_L, height: TELA_A - BARRA, display: "block" }} />
        </Freeze>
      </Sequence>
      {linha.trechos.filter(t => t.video).map(t => (
        <Sequence key={t.id} from={t.de} durationInFrames={t.dur} layout="none">
          <Freeze frame={t.video!.tocando - 1} active={(f) => f >= t.video!.tocando - 1}>
            <OffthreadVideo
              src={staticFile(VIDEO)}
              startFrom={Math.round(t.video!.inicio * FPS)}
              playbackRate={t.video!.ritmo}
              muted
              style={{ width: TELA_L, height: TELA_A - BARRA, display: "block", position: "absolute", top: 0 }}
            />
          </Freeze>
        </Sequence>
      ))}
      {/* Depois da gravação: a tela fica na confirmação */}
      <Sequence from={ultimo.de + ultimo.dur} layout="none">
        <Freeze frame={0}>
          <OffthreadVideo src={staticFile(VIDEO)} startFrom={Math.round(gravacao.duracao * FPS) - 3} muted style={{ width: TELA_L, height: TELA_A - BARRA, display: "block" }} />
        </Freeze>
      </Sequence>
    </>
  );
}

/**
 * A câmera segue o dedo: aproxima e corre para o próximo toque um pouco
 * antes dele acontecer, como quem acompanha com o olho.
 */
function useCamera() {
  const f = useCurrentFrame();
  const chaves: number[] = [], ys: number[] = [];
  for (const t of toques) {
    const q = t.quadro - 8;
    if (chaves.length && q <= chaves[chaves.length - 1] + 1) continue;
    chaves.push(q); ys.push(t.y);
  }
  const foco = interpolate(f, chaves, ys, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const inicio = linha.primeiroVideo.de;
  const zoom = interpolate(f, [inicio, inicio + 20, AVISO.de - 10, AVISO.de + 10], [1, 1.15, 1.15, 1.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  // Ponto focado (0..1 na tela) vai na direção do centro do aparelho. Subir
  // tem teto: toque no pé da tela (Barba, Continuar) levava o aparelho para
  // cima da legenda de duas linhas.
  const deslocamento = Math.min(260, Math.max(-60, (0.5 - foco) * TELA_A * (zoom - 1) * 1.6));
  return { zoom, deslocamento: zoom > 1.01 ? deslocamento : 0 };
}

function Palco() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f - (GANCHO.dur - 18), fps, config: { damping: 16, stiffness: 70, mass: 1.1 } });
  const sai = interpolate(f, [FIM.de - 14, FIM.de], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
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
        <Celular tela={<TelaDoApp />} toques={toques}>
          <Sequence from={AVISO.de} layout="none">
            <Notificacao titulo="Novo agendamento! 💈" corpo="Carlos — Fade, Barba — amanhã às 11:30" />
          </Sequence>
        </Celular>
      </div>
    </AbsoluteFill>
  );
}

export function ClienteAgenda() {
  return (
    <AbsoluteFill>
      <Fundo />
      <Sequence durationInFrames={GANCHO.dur + 6}>
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 70px" }}>
          <Frase texto={legenda("gancho")} duracao={GANCHO.dur + 6} tamanho={104} atraso={4} />
        </AbsoluteFill>
      </Sequence>
      <Sequence durationInFrames={FIM.de}>
        <Palco />
      </Sequence>
      {linha.trechos.filter(t => t.id !== "gancho" && t.id !== "fim").map(t => (
        <Sequence key={t.id} from={t.de} durationInFrames={t.dur}>
          <AbsoluteFill style={{ top: 150, height: 420, justifyContent: "center", padding: "0 60px" }}>
            <Frase texto={legenda(t.id)} duracao={t.dur} tamanho={t.id === "aviso" ? 84 : 78} />
          </AbsoluteFill>
        </Sequence>
      ))}
      <Sequence from={FIM.de}>
        <Encerramento duracao={FIM.dur} chamada="Link na bio" />
      </Sequence>
      {/* A voz entra 3 quadros depois do trecho: dá tempo da primeira palavra da legenda aparecer */}
      {linha.trechos.map(t => (
        <Sequence key={`voz-${t.id}`} from={t.de + 3} layout="none">
          <Audio src={staticFile(`narracao/cliente-agenda/${t.id}.wav`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
