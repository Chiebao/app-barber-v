/**
 * Até onde o CLIENTE enxerga a agenda no link público.
 *
 * Barbeiro que deixa o mês inteiro aberto junta marcação para daqui a cinco
 * semanas, que o cliente esquece e vira falta. Quem prefere a agenda curta
 * escolhe 7 ou 15 dias; quem gosta do mês continua com 30.
 *
 * Vale só para o link público. No painel o barbeiro marca para quando
 * quiser: ele está com o cliente na frente, combinando de viva-voz.
 */

import { agoraNaBarbearia } from "@/app/lib/time-slots";

/** As três opções do seletor. Lista fechada: campo livre viraria "45?". */
export const OPCOES_DIAS = [7, 15, 30] as const;
export type DiasAbertos = (typeof OPCOES_DIAS)[number];

export function ehOpcaoValida(n: unknown): n is DiasAbertos {
  return typeof n === "number" && (OPCOES_DIAS as readonly number[]).includes(n);
}

/**
 * O último dia que o cliente pode escolher, em "YYYY-MM-DD".
 *
 * Conta a partir de HOJE inclusive: com 7, na segunda o limite é a segunda
 * seguinte — que é como o barbeiro descreve ("travar por uma semana").
 */
export function ultimoDiaAberto(diasAbertos: number, agora = new Date()): string {
  const { dia } = agoraNaBarbearia(agora);
  // Meio-dia UTC para somar dias sem esbarrar em horário de verão: sobram 12h
  // de folga para cada lado, então a data nunca escorrega para o vizinho.
  const d = new Date(dia + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + diasAbertos);
  return d.toISOString().slice(0, 10);
}

/**
 * O dia pedido cabe na janela?
 *
 * Barra os dois lados. O passado já é cortado na lista de horários, mas esta
 * função também protege quem POSTA direto na API — e lá a lista não existe.
 */
export function dentroDaJanela(diasAbertos: number, diaPedido: string, agora = new Date()): boolean {
  const { dia: hoje } = agoraNaBarbearia(agora);
  // "YYYY-MM-DD" ordena igual ao tempo, então comparar como texto responde o
  // mesmo que comparar como data.
  return diaPedido >= hoje && diaPedido <= ultimoDiaAberto(diasAbertos, agora);
}

/** A frase que o cliente lê quando tenta um dia fora da janela. */
export function motivoForaDaJanela(diasAbertos: number, agora = new Date()): string {
  const limite = ultimoDiaAberto(diasAbertos, agora);
  const [a, m, d] = [limite.slice(0, 4), limite.slice(5, 7), limite.slice(8, 10)];
  return `Esta barbearia abre a agenda até ${d}/${m}/${a}. Escolha uma data até lá.`;
}
