import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken, signToken } from "@/app/lib/auth";
import { mercadoPagoConfigurado, urlDeAutorizacao, tokenDaBarbearia } from "@/app/lib/mercadopago";

/**
 * Conexão da barbearia com o Mercado Pago.
 *
 * GET    — situação atual (conectado ou não)
 * POST   — devolve o link de autorização para o dono clicar
 * DELETE — desconecta (volta para o Pix manual)
 */

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const shop = await prisma.shop.findUnique({
      where: { id: payload.shopId },
      select: { mpUserId: true, mpConnectedAt: true, pixKey: true },
    });

    return NextResponse.json({
      disponivel: mercadoPagoConfigurado(),
      conectado: !!shop?.mpUserId,
      conectadoEm: shop?.mpConnectedAt ?? null,
      temPixManual: !!shop?.pixKey,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Só o dono pode conectar" }, { status: 401 });
    }
    if (!mercadoPagoConfigurado()) {
      return NextResponse.json({ error: "Mercado Pago não configurado na plataforma" }, { status: 503 });
    }

    // O `state` viaja até o Mercado Pago e volta — é ele que diz de qual
    // barbearia é a autorização. Vai assinado para ninguém forjar.
    const state = signToken({
      userId: payload.userId,
      role: payload.role,
      shopId: payload.shopId,
    });

    return NextResponse.json({ url: urlDeAutorizacao(state) });
  } catch (error) {
    console.error("mp connect error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    await prisma.shop.update({
      where: { id: payload.shopId },
      data: {
        mpAccessToken: null,
        mpRefreshToken: null,
        mpUserId: null,
        mpConnectedAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/**
 * Teste de cobranca — cria um Pix de R$ 1 e devolve a resposta CRUA do
 * Mercado Pago. Serve para descobrir o motivo exato quando a cobranca falha,
 * em vez de olhar so a mensagem generica que o cliente ve.
 */
export async function PUT(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const token = await tokenDaBarbearia(payload.shopId);
    if (!token) return NextResponse.json({ error: "Mercado Pago nao conectado" }, { status: 400 });

    const expira = new Date(Date.now() + 60 * 60 * 1000);
    const corpo = {
      transaction_amount: 1,
      description: "Teste BarberPro",
      payment_method_id: "pix",
      external_reference: `teste-${Date.now()}`,
      date_of_expiration: expira.toISOString(),
      payer: { email: `teste-${Date.now()}@barberpro.app`, first_name: "Teste", last_name: "BarberPro" },
    };

    const r = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": corpo.external_reference,
      },
      body: JSON.stringify(corpo),
    });

    const resposta = await r.json().catch(() => ({}));
    return NextResponse.json({
      status: r.status,
      ok: r.ok,
      enviado: { ...corpo, payer: "(omitido)" },
      respostaMP: resposta,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
