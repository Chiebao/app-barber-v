import bcrypt from "bcryptjs";

/**
 * Código de recuperação de senha.
 *
 * Permite o barbeiro/dono redefinir a própria senha SEM depender do suporte:
 * ele guarda um código (tipo "BARB-7K2M-9XQP") e usa na tela de login.
 *
 * Guardamos só o hash — se o banco vazar, os códigos não servem para nada.
 * O código é de uso único: ao usar, é invalidado e um novo precisa ser gerado.
 */

/** Sem 0/O/1/I/L para não confundir na hora de ditar ou anotar. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Gera um código no formato BARB-XXXX-XXXX. */
export function generateRecoveryCode(): string {
  const block = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `BARB-${block(4)}-${block(4)}`;
}

/** Normaliza o que o usuário digitou (aceita minúsculo, com ou sem traços/espaços). */
export function normalizeRecoveryCode(input: string): string {
  const clean = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean.startsWith("BARB")) return clean;
  const rest = clean.slice(4);
  return `BARB-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
}

export function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), 10);
}

export function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(normalizeRecoveryCode(code), hash);
}
