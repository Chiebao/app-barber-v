import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { trocarCodePorToken } from "@/app/lib/mercadopago";

/**
 * Volta da autorização do Mercado Pago.
 *
 * O dono clicou em "Conectar", autorizou lá e o MP devolve aqui com um `code`.
 * Trocamos esse code pelos tokens da conta DELE e guardamos na barbearia.
 */

function voltarParaPainel(msg: string, ok: boolean): NextResponse {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").trim();
  const url = new URL(`${base}/admin/painel`);
  url.searchParams.set("mp", ok ? "conectado" : "erro");
  url.searchParams.set("msg", msg);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) return voltarParaPainel("Autorização incompleta", false);

    // O state é o nosso token assinado — garante que a autorização é de uma
    // barbearia real e que ninguém forjou a volta
    const payload = verifyToken(state);
    if (!payload?.shopId) return voltarParaPainel("Sessão expirada, tente de novo", false);

    const tokens = await trocarCodePorToken(code);
    if (!tokens?.access_token) return voltarParaPainel("O Mercado Pago recusou a autorização", false);

    await prisma.shop.update({
      where: { id: payload.shopId },
      data: {
        mpAccessToken: tokens.access_token,
        mpRefreshToken: tokens.refresh_token,
        mpUserId: String(tokens.user_id),
        mpConnectedAt: new Date(),
      },
    });

    return voltarParaPainel("Mercado Pago conectado", true);
  } catch (error) {
    console.error("mp callback error:", error);
    return voltarParaPainel("Erro ao conectar", false);
  }
}
