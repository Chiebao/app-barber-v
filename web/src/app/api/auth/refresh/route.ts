import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, canRefresh, SESSION_DAYS } from "@/app/lib/auth";

/**
 * Renova o token da sessão (sessão deslizante).
 *
 * O painel chama isso quando abre. Enquanto o barbeiro usar o app, o prazo
 * é sempre empurrado para frente e ele não precisa digitar a senha de novo.
 * Passados 180 dias do login original, a renovação para e ele loga novamente.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.slice(7) || "";
    const payload = verifyToken(token);

    // Token inválido ou já expirado: o cliente cai no fluxo normal de login
    if (!payload) return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });

    if (!canRefresh(payload)) {
      return NextResponse.json(
        { error: "Sessão muito antiga. Faça login novamente." },
        { status: 401 },
      );
    }

    const fresh = signToken({
      userId: payload.userId,
      role: payload.role,
      shopId: payload.shopId,
      lgi: payload.lgi, // mantém a data do login original
    });

    return NextResponse.json({ token: fresh, expiresInDays: SESSION_DAYS });
  } catch (error) {
    console.error("refresh error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
