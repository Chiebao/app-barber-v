/**
 * O nome que vale para UM agendamento.
 *
 * `Client` e global e a chave e o telefone, entao pai e filho que usam o
 * mesmo numero sao a MESMA linha. O nome digitado na hora de marcar fica
 * congelado em `Appointment.clientName`; o do `Client` e so o fallback das
 * linhas antigas, gravadas antes desse campo existir.
 */
export function nomeDoCliente(
  a: { clientName?: string | null; client?: { name: string } | null },
): string {
  return a.clientName?.trim() || a.client?.name || "Cliente";
}
