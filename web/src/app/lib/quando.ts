import { agoraNaBarbearia } from "@/app/lib/time-slots";

/**
 * O dia e a hora de um atendimento, do jeito que o barbeiro fala:
 * "hoje às 14:00", "amanhã às 09:00", "sex, 17/10 às 10:00".
 *
 * Existe porque as notificações diziam só "às 14:00". O barbeiro lia como
 * se fosse outro dia, e o cliente marcado para HOJE aparecia de surpresa.
 * "Hoje" e "amanhã" vêm escritos, não só a data: é o que salta aos olhos
 * na tela bloqueada.
 *
 * O "hoje" é o da BARBEARIA (`agoraNaBarbearia`), não o do servidor — às
 * 22h de Brasília o servidor em UTC já está no dia seguinte.
 */
export function quandoFala(dataISO: string, hora: string, agora: Date = new Date()): string {
  const hoje = agoraNaBarbearia(agora).dia;
  const amanha = somaDias(hoje, 1);
  const dia = dataISO.slice(0, 10);
  if (dia === hoje) return `hoje às ${hora}`;
  if (dia === amanha) return `amanhã às ${hora}`;
  const d = new Date(dia + "T12:00:00.000Z");
  const semana = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const ddmm = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return `${semana}, ${ddmm} às ${hora}`;
}

/** Atendimento marcado para hoje, no dia da barbearia. */
export function ehHoje(dataISO: string, agora: Date = new Date()): boolean {
  return dataISO.slice(0, 10) === agoraNaBarbearia(agora).dia;
}

function somaDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
