import { prisma } from "@/app/lib/prisma";

/**
 * Limite de tentativas que sobrevive ao serverless.
 *
 * O limitador do `middleware.ts` é um `Map` em memória, e em serverless cada
 * instância tem o seu. O limite de 10 logins por minuto vira 10 × o número de
 * instâncias — e o número de instâncias cresce com a carga que o próprio
 * ataque provoca. Na prática, quanto mais alguém tenta, mais tentativas ele
 * ganha.
 *
 * Este contador vive no banco, então é um só para todas as instâncias.
 *
 * E conta por IDENTIDADE, não por IP: quem quer entrar numa conta específica
 * troca de IP de graça, mas não troca o telefone do alvo. O limitador por IP
 * continua valendo como primeira barreira contra enxurrada burra — os dois
 * defendem de coisas diferentes.
 *
 * O castigo é progressivo porque bloqueio fixo é fácil de esperar e bloqueio
 * eterno vira negação de serviço contra o dono legítimo: quem erra a senha
 * três vezes é quase sempre o dono.
 */

export interface Politica {
  /** Falhas permitidas dentro da janela antes do primeiro castigo. */
  max: number;
  /** Tamanho da janela de contagem, em ms. */
  janelaMs: number;
  /** Castigo da primeira vez; dobra a cada bloqueio seguinte. */
  castigoMs: number;
  /** Teto do castigo, para não trancar o dono para sempre. */
  castigoMaxMs: number;
}

export const LOGIN: Politica = {
  max: 5,
  janelaMs: 10 * 60_000,
  castigoMs: 60_000,
  castigoMaxMs: 30 * 60_000,
};

/** Código de recuperação é adivinhável por força bruta — aperta mais. */
export const CODIGO: Politica = {
  max: 3,
  janelaMs: 15 * 60_000,
  castigoMs: 5 * 60_000,
  castigoMaxMs: 60 * 60_000,
};

export interface Situacao {
  bloqueado: boolean;
  /** Quantos segundos faltam. Zero quando não está bloqueado. */
  segundos: number;
}

/**
 * Está bloqueado agora?
 *
 * Nunca lança: um erro aqui não pode impedir alguém de entrar na própria
 * conta. Falha aberto de propósito — a alternativa é o banco engasgar e a
 * barbearia inteira ficar de fora.
 */
export async function situacao(chave: string): Promise<Situacao> {
  try {
    const r = await prisma.rateLimit.findUnique({ where: { chave } });
    if (!r?.bloqueadoAte) return { bloqueado: false, segundos: 0 };
    const falta = r.bloqueadoAte.getTime() - Date.now();
    if (falta <= 0) return { bloqueado: false, segundos: 0 };
    return { bloqueado: true, segundos: Math.ceil(falta / 1000) };
  } catch {
    return { bloqueado: false, segundos: 0 };
  }
}

/** Registra uma falha e devolve a situação resultante. */
export async function registrarFalha(chave: string, p: Politica): Promise<Situacao> {
  try {
    const agora = new Date();
    const atual = await prisma.rateLimit.findUnique({ where: { chave } });

    // Janela vencida: a contagem recomeça, mas o histórico de castigos não —
    // é ele que faz a segunda rodada de tentativas custar mais que a primeira.
    const dentroDaJanela = atual && atual.janelaAte > agora;
    const tentativas = (dentroDaJanela ? atual.tentativas : 0) + 1;
    const castigos = atual?.castigos ?? 0;

    if (tentativas <= p.max) {
      await prisma.rateLimit.upsert({
        where: { chave },
        create: { chave, tentativas, janelaAte: new Date(agora.getTime() + p.janelaMs), castigos },
        update: {
          tentativas,
          janelaAte: dentroDaJanela ? atual!.janelaAte : new Date(agora.getTime() + p.janelaMs),
        },
      });
      return { bloqueado: false, segundos: 0 };
    }

    const duracao = Math.min(p.castigoMs * Math.pow(2, castigos), p.castigoMaxMs);
    const bloqueadoAte = new Date(agora.getTime() + duracao);

    await prisma.rateLimit.upsert({
      where: { chave },
      create: { chave, tentativas: 0, janelaAte: new Date(agora.getTime() + p.janelaMs), castigos: 1, bloqueadoAte },
      update: {
        // Zera a contagem: o castigo já foi aplicado, a próxima rodada começa
        // do zero mas com castigo maior.
        tentativas: 0,
        janelaAte: new Date(agora.getTime() + p.janelaMs),
        castigos: castigos + 1,
        bloqueadoAte,
      },
    });

    return { bloqueado: true, segundos: Math.ceil(duracao / 1000) };
  } catch {
    return { bloqueado: false, segundos: 0 };
  }
}

/** Acertou: some com o histórico daquela identidade. */
export async function limpar(chave: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { chave } });
  } catch {
    /* contador é proteção, não pode virar erro no caminho feliz */
  }
}

/** Mensagem pronta, no tom do resto do app. */
export function mensagemDeBloqueio(segundos: number): string {
  if (segundos <= 90) return `Muitas tentativas. Espere ${segundos} segundos e tente de novo.`;
  const min = Math.ceil(segundos / 60);
  return `Muitas tentativas. Espere ${min} minutos e tente de novo.`;
}
