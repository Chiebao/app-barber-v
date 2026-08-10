import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");
const JWT_SECRET: string = process.env.JWT_SECRET;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sessão deslizante.
 *
 * O token vale 30 dias, mas é renovado toda vez que o barbeiro abre o app.
 * Na prática: quem usa o app não digita a senha nunca mais; quem some por
 * 30 dias precisa entrar de novo.
 *
 * `lgi` guarda a data do login ORIGINAL e sobrevive às renovações — assim a
 * sessão não se estica para sempre: a cada 180 dias é preciso logar de novo
 * (higiene de segurança, já que o logout não invalida o token no servidor).
 */
export const SESSION_DAYS = 30;
export const MAX_SESSION_DAYS = 180;

export type TokenPayload = {
  userId: string;
  role: "owner" | "barber";
  shopId: string;
  /** Login original em ms (preservado nas renovações). */
  lgi?: number;
};

/** Payload como sai do jwt.verify — inclui os campos automáticos. */
export type VerifiedToken = TokenPayload & { iat?: number; exp?: number };

export function signToken(payload: TokenPayload): string {
  // Só os campos do domínio: iat/exp são gerados pelo jwt e não podem vir prontos
  const clean: TokenPayload = {
    userId: payload.userId,
    role: payload.role,
    shopId: payload.shopId,
    lgi: payload.lgi ?? Date.now(),
  };
  return jwt.sign(clean, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifyToken(token: string): VerifiedToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as VerifiedToken;
  } catch {
    return null;
  }
}

/** A sessão ainda pode ser renovada, ou já passou do limite absoluto? */
export function canRefresh(payload: VerifiedToken, now: number = Date.now()): boolean {
  const loginAt = payload.lgi;
  if (!loginAt) return true; // token antigo, sem a marca: renova uma vez e passa a ter
  return now - loginAt < MAX_SESSION_DAYS * 24 * 60 * 60 * 1000;
}
