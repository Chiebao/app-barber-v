/**
 * Quem e a PESSOA, dentro de um telefone.
 *
 * `Client` e global e a chave e o telefone, mas telefone numa barbearia e
 * compartilhado: pai e filho, marido e esposa, o cara que marca pro irmao.
 * Tratar o telefone como pessoa fazia a falta do filho cobrar Pix do pai e
 * os cortes de um contarem na fidelidade do outro.
 *
 * A pessoa e (telefone, nome). Como o nome digitado fica congelado em
 * `Appointment.clientName`, toda linha ja sabe de quem era.
 */

/**
 * Forma comparavel de um nome: minusculo, sem acento, sem espaco sobrando.
 *
 * "João Silva", "joao silva" e "  JOAO   SILVA " sao a mesma pessoa. Nao
 * resolve "João" x "João Silva" — para o sistema sao duas, e nao ha como
 * saber sem perguntar. E a mesma limitacao que o portao de privacidade do
 * "Meus agendamentos" ja tem.
 */
export function chaveDaPessoa(nome: string | null | undefined): string {
  return String(nome ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** O mesmo nome, com a caixa preservada, para mostrar na tela. */
export function nomeParaExibir(nome: string | null | undefined): string {
  return String(nome ?? "").trim() || "Cliente";
}
