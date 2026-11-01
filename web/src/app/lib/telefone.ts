/**
 * O mesmo telefone chega escrito de vários jeitos.
 *
 * A Meta manda `from` com 55 e, em número antigo, SEM o 9º dígito. O cadastro
 * do dono, do barbeiro e do cliente guarda o que a pessoa digitou. Comparar
 * texto com texto faz o dono virar desconhecido e receber as Boas-vindas, e
 * faz um pedido de PARAR não valer para o lembrete do mesmo número.
 */

export function soDigitos(telefone: string): string {
  return String(telefone || "").replace(/\D/g, "");
}

/** Tira o 55 só quando o que sobra tem cara de DDD + número. */
function semDDI(digitos: string): string {
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    return digitos.slice(2);
  }
  return digitos;
}

/** Celular no formato antigo: DDD + 8 dígitos começando de 6 a 9. Fixo começa de 2 a 5. */
function celularSemNove(local: string): boolean {
  return local.length === 10 && /[6-9]/.test(local[2]);
}

function celularComNove(local: string): boolean {
  return local.length === 11 && local[2] === "9";
}

/** A forma única usada como chave: 55 + DDD + 9 + número. */
export function telefoneCanonico(telefone: string): string {
  const local = semDDI(soDigitos(telefone));
  if (celularSemNove(local)) return `55${local.slice(0, 2)}9${local.slice(2)}`;
  return `55${local}`;
}

/** Todas as grafias do número, para procurar no cadastro com `in`. */
export function variantesDoTelefone(telefone: string): string[] {
  const local = semDDI(soDigitos(telefone));
  const locais = [local];
  if (celularComNove(local)) locais.push(local.slice(0, 2) + local.slice(3));
  if (celularSemNove(local)) locais.push(`${local.slice(0, 2)}9${local.slice(2)}`);
  return locais.flatMap((l) => [l, `55${l}`]);
}
