import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { enviarModelo } from "@/app/lib/whatsapp-send";
import { sendWebPush, notifyTargets } from "@/app/lib/webpush";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let cancelledBy = "client";
    let clientPhone: string | null = null;
    try {
      const body = await req.json();
      if (body?.cancelledBy) cancelledBy = body.cancelledBy;
      if (body?.phone) clientPhone = body.phone.replace(/\D/g, "");
    } catch { /* sem body */ }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        barber: true,
        shop: true,
        services: { include: { service: true } },
      },
    });

    if (!appointment) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    if (appointment.status === "cancelled") return NextResponse.json({ error: "Já cancelado" }, { status: 400 });

    // Verificação de ownership: barbeiro da loja OU cliente dono do agendamento
    const token = req.headers.get("authorization")?.slice(7);
    const payload = token ? verifyToken(token) : null;
    const isShopMember = payload && payload.shopId === appointment.shopId;
    const isClient = clientPhone && appointment.client.phone === clientPhone;

    if (!isShopMember && !isClient) {
      return NextResponse.json({ error: "Sem permissão para cancelar" }, { status: 403 });
    }

    await prisma.appointment.update({
      where: { id: params.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelledBy: cancelledBy || "client" },
    });

    // Notifica o barbeiro se cancelamento foi pelo cliente
    if (cancelledBy === "client" || !cancelledBy) {
      // Aviso ao barbeiro é só por push, como no agendamento.
      const serviceNames = appointment.services.map(as => as.service.name).join(", ");

      // Push notification ao barbeiro + owner
      const cancelBody = `${appointment.client.name} cancelou ${serviceNames} às ${appointment.startTime}`;

      // Notificação no navegador (PWA)
      notifyTargets(appointment.shopId, appointment.barberId)
        .then((ids) => sendWebPush(ids, {
          title: "Agendamento cancelado ❌",
          body: cancelBody,
          url: "/admin/painel",
          tag: "cancelamento",
        }))
        .catch(console.error);
      const pushTargets: string[] = [];
      if (appointment.barber.pushToken?.startsWith("ExponentPushToken")) pushTargets.push(appointment.barber.pushToken);

      if (!appointment.barber.isOwnerProfile) {
        const ownerBarber = await prisma.barber.findFirst({
          where: { shopId: appointment.shopId, isOwnerProfile: true },
          select: { pushToken: true },
        });
        if (ownerBarber?.pushToken?.startsWith("ExponentPushToken") && !pushTargets.includes(ownerBarber.pushToken)) {
          pushTargets.push(ownerBarber.pushToken);
        }
      }

      if (pushTargets.length > 0) {
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pushTargets.map((to) => ({
            to,
            title: "Agendamento cancelado ❌",
            body: cancelBody,
            sound: "default",
          }))),
        }).catch(console.error);
      }
    }

    // Conta lista de espera para a data cancelada
    const cancelledDate = appointment.date.toISOString().split("T")[0];
    const waitlistEntries = await prisma.waitlist.findMany({
      where: {
        shopId: appointment.shopId,
        OR: [
          { preferredDate: cancelledDate },
          { preferredDate: null },
        ],
      },
      take: 3,
    });

    // Notifica via WhatsApp API se disponível e se cancelamento foi pelo cliente
    if (waitlistEntries.length > 0 && (cancelledBy === "client" || !cancelledBy)) {
      const formattedDate = format(appointment.date, "dd 'de' MMMM", { locale: ptBR });
      // Modelo aprovado: quem está na lista de espera quase nunca escreveu
      // para o número nas últimas 24h, então texto livre não sairia.
      for (const entry of waitlistEntries) {
        enviarModelo(entry.clientPhone, "vaga_disponivel", [
          entry.clientName.split(" ")[0],
          appointment.shop.name,
          formattedDate,
          appointment.startTime,
        ]).catch(console.error);
      }
    }

    // Notifica o owner via push se um cliente cancelou e tem gente na lista de espera
    if ((cancelledBy === "client" || !cancelledBy) && waitlistEntries.length > 0) {
      const ownerBarber = await prisma.barber.findFirst({
        where: { shopId: appointment.shopId, isOwnerProfile: true },
        select: { pushToken: true },
      });
      if (ownerBarber?.pushToken?.startsWith("ExponentPushToken")) {
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{
            to: ownerBarber.pushToken,
            title: "Vaga aberta + lista de espera 📋",
            body: `${appointment.client.name} cancelou às ${appointment.startTime}. ${waitlistEntries.length} cliente(s) na lista de espera!`,
            sound: "default",
          }]),
        }).catch(console.error);
      }
    }

    return NextResponse.json({ ok: true, waitlistCount: waitlistEntries.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
