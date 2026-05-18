import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { sendWhatsAppNotification } from "@/app/lib/whatsapp";
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
      const serviceNames = appointment.services.map(as => as.service.name).join(", ");
      const formattedDate = format(appointment.date, "dd 'de' MMMM", { locale: ptBR });

      sendWhatsAppNotification({
        barberPhone: appointment.barber.phone,
        clientName: appointment.client.name,
        serviceName: serviceNames,
        date: formattedDate,
        time: appointment.startTime,
        shopName: appointment.shop.name,
        isCancellation: true,
      }).catch(console.error);

      // Push notification ao barbeiro + owner
      const cancelBody = `${appointment.client.name} cancelou ${serviceNames} às ${appointment.startTime}`;
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

    // Notifica lista de espera para a data cancelada
    const cancelledDate = appointment.date.toISOString().split("T")[0];
    const waitlistEntries = await prisma.waitlist.findMany({
      where: {
        shopId: appointment.shopId,
        OR: [
          { preferredDate: cancelledDate },
          { preferredDate: null },
        ],
      },
      take: 3, // limita para não spam
    });

    if (waitlistEntries.length > 0) {
      const formattedDate = format(appointment.date, "dd 'de' MMMM", { locale: ptBR });
      for (const entry of waitlistEntries) {
        const phone = entry.clientPhone.replace(/\D/g, "");
        const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;
        const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
        const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
        if (WHATSAPP_API_TOKEN && WHATSAPP_PHONE_ID) {
          fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phoneWithCountry,
              type: "text",
              text: {
                body: `*Vaga disponível na ${appointment.shop.name}!* 🎉\n\n` +
                  `${entry.clientName}, abrimos um horário no dia *${formattedDate}* às *${appointment.startTime}*.\n\n` +
                  `Acesse agora para agendar: ${process.env.NEXT_PUBLIC_BASE_URL}/${appointment.shop.slug}`,
              },
            }),
          }).catch(console.error);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
