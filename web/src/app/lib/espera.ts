/**
 * Lista de espera que se limpa sozinha.
 *
 * A fila não tinha vencimento: uma cliente entrou dia 28 pedindo vaga PARA o
 * dia 28, o dia passou, nenhuma vaga abriu, e uma semana depois ela ainda
 * estava lá. O barbeiro é que teria de perceber e remover à mão — e ninguém
 * faz isso, então a lista vira lixo e para de ser olhada.
 *
 * Pior que a lista suja: o cliente pediu para ser avisado e nunca soube de
 * nada. Do lado dele, a barbearia ignorou o pedido.
 */

import { prisma } from "@/app/lib/prisma";
import { enviarModelo } from "@/app/lib/whatsapp-send";
import { agoraNaBarbearia } from "@/app/lib/time-slots";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Quem não escolheu dia não tem data para vencer, então o que vence é a
 * idade do pedido. Trinta dias é folgado de propósito: é fila de espera, não
 * agendamento — errar para o lado de esperar demais só custa uma linha, e
 * errar para o lado de apagar cedo tira da fila quem ainda queria.
 */
export const DIAS_SEM_DATA = 30;

export type ResultadoEspera = {
  removidos: number;
  avisados: number;
  falhas: number;
};

/**
 * Tira da fila o que já não pode dar certo e avisa quem estava esperando.
 *
 * O aviso é tentado ANTES de remover, mas a remoção acontece de qualquer
 * jeito. Segurar a linha até a mensagem sair recriaria o problema: modelo
 * ainda não aprovado, ou número inválido, e a fila volta a crescer para
 * sempre esperando um envio que nunca vai acontecer.
 */
export async function limparEsperaVencida(agora = new Date()): Promise<ResultadoEspera> {
  const r: ResultadoEspera = { removidos: 0, avisados: 0, falhas: 0 };

  // O dia é o da barbearia, não o do servidor: às 21h de Brasília o servidor
  // em UTC já virou o dia, e a espera de hoje seria apagada durante o
  // expediente.
  const { dia: hoje } = agoraNaBarbearia(agora);
  const limiteSemData = new Date(agora.getTime() - DIAS_SEM_DATA * 24 * 60 * 60 * 1000);

  const vencidos = await prisma.waitlist.findMany({
    where: {
      OR: [
        // "YYYY-MM-DD" ordena igual ao tempo, então comparar como texto aqui
        // dá a mesma resposta que comparar como data — e é o formato que já
        // está gravado na coluna.
        { preferredDate: { not: null, lt: hoje } },
        { preferredDate: null, createdAt: { lt: limiteSemData } },
      ],
    },
    select: {
      id: true,
      clientName: true,
      clientPhone: true,
      preferredDate: true,
      shop: { select: { name: true } },
    },
  });

  if (vencidos.length === 0) return r;

  for (const e of vencidos) {
    // A data volta por extenso porque é isso que o cliente reconhece — ele
    // pediu "sábado", não "2026-09-05". Quem não escolheu dia recebe a frase
    // no lugar da data, e o mesmo modelo serve para os dois casos.
    const quando = e.preferredDate
      ? format(new Date(e.preferredDate + "T12:00:00.000Z"), "d 'de' MMMM", { locale: ptBR })
      : "o período que você pediu";

    try {
      const ok = await enviarModelo(e.clientPhone, "espera_sem_vaga", [
        e.clientName.split(" ")[0],
        e.shop.name,
        quando,
      ]);
      if (ok) r.avisados++; else r.falhas++;
    } catch (err) {
      r.falhas++;
      console.error("[ESPERA] falha ao avisar", e.id, err);
    }
  }

  const { count } = await prisma.waitlist.deleteMany({
    where: { id: { in: vencidos.map(e => e.id) } },
  });
  r.removidos = count;

  return r;
}
