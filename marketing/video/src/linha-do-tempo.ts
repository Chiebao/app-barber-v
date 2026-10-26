import type { Gravacao } from "./componentes/Celular";
import { FPS } from "./tema";

/**
 * A narração manda no tempo. Cada trecho dura o que a sua fala dura (mais um
 * respiro), e o pedaço da gravação daquele trecho é acelerado ou freado para
 * caber — assim voz, legenda e toque na tela batem juntos.
 *
 * Trechos de VÍDEO cobrem a gravação de uma `marca` até a seguinte. Trechos
 * sem vídeo (gancho, aviso, fim) só têm fala.
 */

export type Trecho = {
  id: string;
  de: number;          // quadro em que começa
  dur: number;         // quadros
  fala: number;        // segundos da narração
  video?: { inicio: number; fim: number; ritmo: number; tocando: number }; // inicio/fim em segundos da gravação; tocando em quadros
};

const RESPIRO = 0.22;      // segundos entre uma fala e a próxima
const RITMO_MAX = 1.4;     // mais rápido que isso a tela vira borrão
const RITMO_MIN = 0.55;    // mais lento parece travado: melhor parar no quadro

export function montarLinha(opcoes: {
  gravacao: Gravacao;
  duracoes: Record<string, number>;
  antes: { id: string; folga?: number }[];
  video: string[];          // ids das marcas, na ordem da gravação
  depois: { id: string; folga?: number }[];
}) {
  const { gravacao, duracoes } = opcoes;
  const q = (s: number) => Math.round(s * FPS);
  const marca = (id: string) => {
    const e = gravacao.eventos.find(ev => ev.tipo === "marca" && ev.rotulo === id);
    if (!e) throw new Error(`marca "${id}" não está na gravação`);
    return e.t;
  };
  const fala = (id: string) => {
    const d = duracoes[id];
    if (d === undefined) throw new Error(`fala "${id}" não foi narrada — rode npm run narrar`);
    return d;
  };

  const trechos: Trecho[] = [];
  let cursor = 0;
  const empurra = (t: Omit<Trecho, "de">) => { trechos.push({ ...t, de: cursor }); cursor += t.dur; };

  for (const a of opcoes.antes) {
    empurra({ id: a.id, dur: q(fala(a.id) + (a.folga ?? RESPIRO)), fala: fala(a.id) });
  }
  opcoes.video.forEach((id, i) => {
    const inicio = marca(id);
    const fim = i + 1 < opcoes.video.length ? marca(opcoes.video[i + 1]) : gravacao.duracao;
    const fonte = fim - inicio;
    const alvo = Math.max(fala(id) + RESPIRO, fonte / RITMO_MAX);
    const ritmo = Math.max(RITMO_MIN, fonte / alvo);
    empurra({ id, dur: q(alvo), fala: fala(id), video: { inicio, fim, ritmo, tocando: Math.min(q(alvo), q(fonte / ritmo)) } });
  });
  for (const d of opcoes.depois) {
    empurra({ id: d.id, dur: q(fala(d.id) + (d.folga ?? RESPIRO)), fala: fala(d.id) });
  }

  const comVideo = trechos.filter(t => t.video);
  /** Quadro do vídeo final em que um instante da gravação aparece. */
  const quadroDaGravacao = (t: number) => {
    const tr = comVideo.find(x => t >= x.video!.inicio && t < x.video!.fim) ?? comVideo[comVideo.length - 1];
    const v = tr.video!;
    return tr.de + Math.min(Math.round(((t - v.inicio) / v.ritmo) * FPS), tr.dur - 1);
  };
  const trecho = (id: string) => {
    const t = trechos.find(x => x.id === id);
    if (!t) throw new Error(`trecho "${id}" não existe`);
    return t;
  };

  return { trechos, total: cursor, quadroDaGravacao, trecho, primeiroVideo: comVideo[0], ultimoVideo: comVideo[comVideo.length - 1] };
}
