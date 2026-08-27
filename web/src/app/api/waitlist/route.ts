import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

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

    return NextResponse.json({ ok: true, id: entry.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
