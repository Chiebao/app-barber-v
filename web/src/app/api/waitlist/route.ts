import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendWebPush, notifyTargets } from "@/app/lib/webpush";

// POST — cliente entra na lista de espera (público, sem auth)
export async function POST(req: NextRequest) {
  try {
    const { shopId, clientName, clientPhone, barberId, serviceIds, preferredDate } = await req.json();

    if (!shopId || !clientName || !clientPhone) {
      return NextResponse.json({ error: "Dados obrigatórios faltando" }, { status: 400 });
    }

    const phone = clientPhone.replace(/\D/g, "");

    // Mesma barreira do agendamento: sem isso o cliente barrado entrava pela
    // lista de espera e ainda era avisado quando abrisse vaga.
    const barrado = await prisma.bannedClient.findUnique({
      where: { shopId_phone: { shopId, phone } },
      select: { id: true },
    });
    if (barrado) {
      return NextResponse.json(
        { error: "Não foi possível concluir. Entre em contato com a barbearia." },
        { status: 403 },
      );
    }

    // Evita duplicata na mesma data
    const existing = await prisma.waitlist.findFirst({
      where: { shopId, clientPhone: phone, preferredDate: preferredDate ?? null },
    });

    if (existing) {
      return NextResponse.json({ ok: true, alreadyIn: true });
    }

    const entry = await prisma.waitlist.create({
      data: {
        shopId,
        clientName: clientName.trim(),
        clientPhone: phone,
        barberId: barberId || null,
        serviceIds: serviceIds ?? [],
        preferredDate: preferredDate ?? null,
      },
    });

    // Ninguem era avisado: o cliente levantava a mao e a fila so aparecia
    // para quem abrisse a tela de espera de proposito. Um pedido que
    // ninguem ve e um pedido perdido — e o barbeiro costuma ter como
    // encaixar, se souber a tempo.
    const quando = preferredDate
      ? new Date(preferredDate + "T12:00:00.000Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      : "qualquer dia";
    const titulo = "Entrou na lista de espera 📋";
    const corpo = `${clientName.trim()} quer horário para ${quando}`;

    // Sem `barberId` a notificacao vai para a barbearia toda: quem nao
    // escolheu barbeiro serve para qualquer um deles.
    notifyTargets(shopId, barberId || undefined)
      .then((ids) => sendWebPush(ids, {
        title: titulo,
        body: corpo,
        url: "/admin/painel",
        tag: "lista-de-espera",
      }))
      .catch(console.error);

    const alvos = await prisma.barber.findMany({
      where: {
        shopId,
        active: true,
        ...(barberId ? { OR: [{ id: barberId }, { isOwnerProfile: true }] } : {}),
      },
      select: { pushToken: true },
    });
    const tokens = [...new Set(
      alvos.map((b) => b.pushToken).filter((t): t is string => !!t && t.startsWith("ExponentPushToken")),
    )];
    if (tokens.length > 0) {
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokens.map((to) => ({ to, title: titulo, body: corpo, sound: "default" }))),
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true, id: entry.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
