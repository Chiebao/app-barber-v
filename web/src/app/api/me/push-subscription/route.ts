import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * Inscrição do navegador para receber notificações (Web Push).
 * Um registro por aparelho — o mesmo barbeiro pode receber no celular e no PC.
 */

/** Descobre o registro de barbeiro do usuário logado (dono usa o perfil de barbeiro dele). */
async function resolveBarberId(payload: { userId: string; role: string; shopId: string }): Promise<string | null> {
  const asBarber = await prisma.barber.findFirst({
    where: { id: payload.userId, shopId: payload.shopId },
    select: { id: true },
  });
  if (asBarber) return asBarber.id;

  // Dono: o token traz o id do Owner, então buscamos o perfil de barbeiro dele
  const ownerProfile = await prisma.barber.findFirst({
    where: { shopId: payload.shopId, isOwnerProfile: true },
    select: { id: true },
  });
  return ownerProfile?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { endpoint, keys } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
    }

    const barberId = await resolveBarberId(payload);
    if (!barberId) return NextResponse.json({ error: "Perfil de barbeiro não encontrado" }, { status: 404 });

    // Mesmo aparelho reinscrevendo: atualiza em vez de duplicar
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        barberId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers.get("user-agent")?.slice(0, 255) || null,
      },
      update: {
        barberId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("push-subscription POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Endpoint obrigatório" }, { status: 400 });

    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("push-subscription DELETE:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Envia uma notificação de teste para o próprio usuário conferir se funcionou. */
export async function PUT(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const barberId = await resolveBarberId(payload);
    if (!barberId) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

    const { sendWebPush } = await import("@/app/lib/webpush");
    const sent = await sendWebPush([barberId], {
      title: "Notificações ativadas ✅",
      body: "Pronto! Você será avisado aqui quando um cliente agendar ou cancelar.",
      tag: "teste",
    });

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error("push-subscription PUT:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
