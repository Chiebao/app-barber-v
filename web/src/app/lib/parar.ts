import { prisma } from "@/app/lib/prisma";
import { telefoneCanonico, variantesDoTelefone } from "@/app/lib/telefone";

/**
 * Quem pediu PARAR. A Meta obriga a respeitar, e o pedido vale para o número em
 * todas as barbearias. A chave é o telefone canônico: o pedido chega de um jeito
 * e o cadastro do cliente pode estar de outro.
 */

export const MOTIVO_PEDIU_PARAR = "pediu_parar";

export async function pediuParar(telefone: string): Promise<boolean> {
  const r = await prisma.pedidoParar.findUnique({ where: { telefone: telefoneCanonico(telefone) } });
  return !!r;
}

export async function registrarParar(telefone: string): Promise<void> {
  const chave = telefoneCanonico(telefone);
  await prisma.pedidoParar.upsert({ where: { telefone: chave }, create: { telefone: chave }, update: {} });
}

/**
 * Desfaz o pedido, e solta o lembrete que o cron pulou por causa dele: quem
 * escreveu VOLTAR hoje e corta amanhã leu "você voltou a receber".
 */
export async function desfazerParar(telefone: string): Promise<void> {
  await prisma.pedidoParar.deleteMany({ where: { telefone: telefoneCanonico(telefone) } });
  await prisma.appointment.updateMany({
    where: {
      client: { phone: { in: variantesDoTelefone(telefone) } },
      lembretePuladoMotivo: MOTIVO_PEDIU_PARAR,
      reminderSentAt: null,
    },
    data: { lembretePuladoMotivo: null },
  });
}

/** Quais destes telefones pediram PARAR, numa consulta só. Devolve os originais. */
export async function quaisPediramParar(telefones: string[]): Promise<Set<string>> {
  if (telefones.length === 0) return new Set();
  const linhas = await prisma.pedidoParar.findMany({
    where: { telefone: { in: telefones.map(telefoneCanonico) } },
    select: { telefone: true },
  });
  const pediram = new Set(linhas.map((l) => l.telefone));
  return new Set(telefones.filter((t) => pediram.has(telefoneCanonico(t))));
}
