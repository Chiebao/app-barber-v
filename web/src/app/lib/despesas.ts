/**
 * Regras das despesas.
 *
 * Ficam aqui, e não na rota, porque o cron de recorrência precisa das mesmas
 * definições que a tela — e categoria escrita em dois lugares vira categoria
 * divergente no terceiro mês.
 */

/**
 * Lista fechada de propósito.
 *
 * Com campo livre, em dois meses a barbearia tem "produto", "produtos" e
 * "prod." como três categorias diferentes, e nenhum relatório fecha. Seis
 * cobrem o que uma barbearia gasta; o que não couber cai em "outros".
 */
export const CATEGORIAS = [
  { id: "aluguel", rotulo: "Aluguel" },
  { id: "contas", rotulo: "Contas" },
  { id: "produtos", rotulo: "Produtos" },
  { id: "equipe", rotulo: "Equipe" },
  { id: "manutencao", rotulo: "Manutenção" },
  { id: "outros", rotulo: "Outros" },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]["id"];

const IDS = new Set<string>(CATEGORIAS.map((c) => c.id));

export function categoriaValida(valor: unknown): valor is CategoriaId {
  return typeof valor === "string" && IDS.has(valor);
}

export function rotuloDaCategoria(id: string): string {
  return CATEGORIAS.find((c) => c.id === id)?.rotulo ?? "Outros";
}

/**
 * Janela do mês, em UTC puro.
 *
 * Sem deslocamento de fuso, e isso é deliberado: `Appointment.date` não
 * guarda um instante, guarda um DIA — a meia-noite UTC da data local. Uma
 * janela que começasse às 03:00 UTC do dia 1º deixaria de fora todo
 * atendimento do primeiro dia do mês.
 *
 * As despesas seguem a mesma convenção, gravadas ao meio-dia UTC: longe das
 * duas bordas, então nenhuma migra de mês por causa de horário.
 *
 * O fuso importa em outro lugar — em QUAL é o mês corrente. Isso está em
 * `mesDeTexto`.
 */
export function limitesDoMes(ano: number, mes: number): { inicio: Date; fim: Date } {
  // mes: 1–12
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  const fim = new Date(Date.UTC(ano, mes, 1, 0, 0, 0));
  return { inicio, fim };
}

/** "2026-08" → { ano, mes }. Mês inválido cai no mês corrente. */
export function mesDeTexto(texto: string | null): { ano: number; mes: number } {
  const agora = new Date();
  const padrao = {
    ano: agora.getUTCFullYear(),
    // getUTCMonth é 0–11, e às 00h de SP ainda é o dia anterior em UTC —
    // por isso o mês corrente sai do relógio ajustado, não do cru.
    mes: new Date(agora.getTime() - 3 * 3600_000).getUTCMonth() + 1,
  };
  if (!texto) return padrao;
  const m = texto.match(/^(\d{4})-(\d{2})$/);
  if (!m) return padrao;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return padrao;
  return { ano, mes };
}

/** { ano, mes } → "2026-08". */
export function mesParaTexto(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** O mês anterior a um dado mês. */
export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}
