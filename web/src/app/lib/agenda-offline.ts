/**
 * A agenda do dia guardada no aparelho.
 *
 * O motivo não é a Vercel cair — isso é raro. É que a internet da barbearia
 * cai toda semana, e o painel tratava falha de rede como dia vazio
 * (`catch { setAppointments([]) }`). O barbeiro não via um erro: via um
 * sábado livre, e descobria o contrário quando a fila chegava na porta.
 *
 * Fica aqui, na camada do app, e NÃO no service worker de propósito. O SW
 * devolveria a resposta velha por baixo do pano e a tela continuaria sem saber
 * que está velha — trocaria uma mentira por outra. Aqui a tela sabe que é
 * cópia e consegue dizer de quando é.
 *
 * Guarda nome e telefone de cliente, então sai no logout (todos eles).
 */

const PREFIXO = "agenda_offline:";

export interface AgendaSalva<T> {
  /** Quando esta cópia foi baixada. */
  salvoEm: number;
  agendamentos: T[];
}

function chave(data: string): string {
  return PREFIXO + data;
}

/** Todas as chaves nossas, em ordem de data. */
function chaves(): string[] {
  const fora: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIXO)) fora.push(k);
  }
  return fora.sort();
}

/**
 * Joga fora o que já passou.
 *
 * Sem isto o histórico do ano inteiro fica no aparelho: dado de cliente que
 * ninguém vai olhar de novo, ocupando a cota que a agenda de amanhã precisa.
 */
function podar(hojeISO: string) {
  const ontem = new Date(hojeISO + "T00:00:00.000Z");
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  const corte = PREFIXO + ontem.toISOString().slice(0, 10);
  for (const k of chaves()) if (k < corte) localStorage.removeItem(k);
}

/** Guarda a agenda de um dia. Nunca lança: cache é conforto, não requisito. */
export function salvarAgenda<T>(data: string, agendamentos: T[], hojeISO: string): void {
  try {
    podar(hojeISO);
    const pacote: AgendaSalva<T> = { salvoEm: Date.now(), agendamentos };
    localStorage.setItem(chave(data), JSON.stringify(pacote));
  } catch {
    // Cota estourada ou modo privativo. Limpar e tentar uma vez — se o
    // aparelho não quer guardar, o painel funciona igual, só sem a rede de
    // segurança.
    try {
      limparAgendas();
      localStorage.setItem(chave(data), JSON.stringify({ salvoEm: Date.now(), agendamentos }));
    } catch { /* desiste em silêncio */ }
  }
}

/** A última cópia daquele dia, se existir. */
export function lerAgenda<T>(data: string): AgendaSalva<T> | null {
  try {
    const cru = localStorage.getItem(chave(data));
    if (!cru) return null;
    const p = JSON.parse(cru) as AgendaSalva<T>;
    // Pacote de versão antiga ou corrompido não pode virar tela quebrada.
    if (!p || typeof p.salvoEm !== "number" || !Array.isArray(p.agendamentos)) return null;
    return p;
  } catch {
    return null;
  }
}

/** Sai no logout: o aparelho pode ser compartilhado. */
export function limparAgendas(): void {
  try {
    for (const k of chaves()) localStorage.removeItem(k);
  } catch { /* nada a fazer */ }
}

/** "salva às 08:32" — o barbeiro precisa saber de quando é o que está vendo. */
export function horaDaCopia(salvoEm: number): string {
  return new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
