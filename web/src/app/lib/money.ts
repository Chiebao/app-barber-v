/**
 * Helpers de valores monetários.
 *
 * O banco guarda dinheiro como `Decimal(10,2)` — exato, sem o erro de
 * arredondamento do ponto flutuante. O Prisma devolve esses campos como
 * objetos `Decimal`, que NÃO podem ser somados com `+` nem serializados
 * direto para JSON (viriam como string e quebrariam `.toFixed()` no front).
 *
 * Regra do projeto:
 *   • ao LER do banco para fazer conta ........ use `num()`
 *   • ao RESPONDER em JSON .................... use `num()` (sempre número puro)
 *   • ao CALCULAR um valor .................... feche com `money()`
 *   • ao SOMAR uma lista ...................... use `sumMoney()`
 *
 * Assim o frontend, o PDF e o app mobile continuam recebendo números comuns.
 */

/** Aceita o que vier do Prisma (Decimal), da rede (string) ou já number. */
export type MoneyLike = { toString(): string } | number | string | null | undefined;

/** Converte qualquer valor monetário para `number`. Nulo vira 0. */
export function num(value: MoneyLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda para centavos (2 casas). Use em todo valor calculado. */
export function money(value: MoneyLike): number {
  const n = num(value);
  return Math.round(n * 100) / 100;
}

/** Soma uma lista de valores monetários e arredonda o resultado. */
export function sumMoney(values: MoneyLike[]): number {
  return money(values.reduce<number>((total, v) => total + num(v), 0));
}

/** Multiplica valor × quantidade (ex.: item de comanda) já arredondado. */
export function multiplyMoney(value: MoneyLike, quantity: number): number {
  return money(num(value) * (Number(quantity) || 0));
}

/** Aplica um percentual sobre um valor (ex.: comissão de barbeiro). */
export function percentOf(value: MoneyLike, percent: MoneyLike): number {
  return money((num(value) * num(percent)) / 100);
}
