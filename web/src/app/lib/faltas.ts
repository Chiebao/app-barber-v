/**
 * Quantas faltas UMA PESSOA tem — nao o telefone dela.
 *
 * Antes isto era `Client.noShowCount`, um contador no telefone. Como pai e
 * filho sao o mesmo `Client`, a falta do filho cobrava Pix do pai. E zerar
 * o contador ao receber o Pix apagava a falta dos dois de uma vez.
 *
 * Agora e DERIVADO: conta os agendamentos com status `no_show` daquela
 * pessoa que ainda nao foram perdoados. Contador deriva e mente; contagem
 * sobre o fato nao tem como divergir.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { chaveDaPessoa } from "@/app/lib/pessoa";

/** A partir de quantas faltas o proximo agendamento exige Pix adiantado. */
export const FALTAS_PARA_EXIGIR_PIX = 2;

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Faltas nao perdoadas desta pessoa, em TODAS as barbearias.
 *
 * Global de proposito: quem falta na barbearia do bairro nao vira cliente
 * confiavel atravessando a rua. Era assim com o contador e continua.
 */
export async function faltasDaPessoa(db: Db, clientId: string, nome: string): Promise<number> {
  const chave = chaveDaPessoa(nome);

  // O nome vive em `clientName`, que so existe para linhas novas. Nas
  // antigas ele foi congelado a partir do `Client`, entao comparar pela
  // coluna basta — mas o filtro tem de ser feito em memoria, porque
  // normalizar acento no Postgres exigiria extensao.
  const faltas = await db.appointment.findMany({
    where: { clientId, status: "no_show", faltaPerdoada: false },
    select: { clientName: true },
  });

  return faltas.filter((f) => chaveDaPessoa(f.clientName) === chave).length;
}

/**
 * Perdoa as faltas desta pessoa. Chamado quando o Pix da penalidade cai.
 *
 * So as DELA: o pai que pagou nao limpa a ficha do filho.
 */
export async function perdoarFaltasDaPessoa(db: Db, clientId: string, nome: string): Promise<number> {
  const chave = chaveDaPessoa(nome);
  const candidatos = await db.appointment.findMany({
    where: { clientId, status: "no_show", faltaPerdoada: false },
    select: { id: true, clientName: true },
  });
  const ids = candidatos.filter((c) => chaveDaPessoa(c.clientName) === chave).map((c) => c.id);
  if (ids.length === 0) return 0;

  const { count } = await db.appointment.updateMany({
    where: { id: { in: ids } },
    data: { faltaPerdoada: true },
  });
  return count;
}
