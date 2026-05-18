import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendWhatsAppNotification } from "@/app/lib/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";

const appointmentSchema = z.object({
  shopId: z.string(),
  barberId: z.string(),
  clientName: z.string().min(2),
  clientPhone: z.string().min(10),
  serviceIds: z.array(z.string()).min(1),
  date: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  pendingPayment: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = appointmentSchema.parse(body);

    const cleanPhone = data.clientPhone.replace(/\D/g, "");

    const [shop, barber, services] = await Promise.all([
      prisma.shop.findUnique({ where: { id: data.shopId } }),
      prisma.barber.findUnique({ where: { id: data.barberId } }),
      prisma.service.findMany({ where: { id: { in: data.serviceIds }, shopId: data.shopId } }),
    ]);

    if (!shop || !barber) return NextResponse.json({ error: "Barbearia ou profissional nao encontrado" }, { status: 404 });
    if (services.length === 0) return NextResponse.json({ error: "Servicos invalidos" }, { status: 400 });

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

    const [startH, startM] = data.startTime.split(":").map(Number);
    const endMinutes = startH * 60 + startM + totalDuration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    const dateObj = new Date(data.date + "T00:00:00");

    // Verifica conflito de horario para o barbeiro
    const conflicts = await prisma.appointment.findMany({
      where: {
        barberId: data.barberId,
        date: { gte: new Date(data.date + "T00:00:00"), lte: new Date(data.date + "T23:59:59") },
        status: { notIn: ["cancelled", "no_show"] },
      },
    });

    const hasConflict = conflicts.some((apt) => data.startTime < apt.endTime && endTime > apt.startTime);
    if (hasConflict) return NextResponse.json({ error: "Horario ja ocupado" }, { status: 409 });

    // Cria ou encontra cliente
    let client = await prisma.client.findUnique({ where: { phone: cleanPhone } });
    if (!client) {
      client = await prisma.client.create({ data: { name: data.clientName, phone: cleanPhone } });
    }

    // Verifica no-shows (cliente com 2+ faltas)
    const needsPix = client.noShowCount >= 2 && !!shop.pixKey;
    if (needsPix && !data.pendingPayment) {
      return NextResponse.json({ error: "Pre-pagamento necessario", pixKey: shop.pixKey }, { status: 402 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        shopId: data.shopId,
        barberId: data.barberId,
        clientId: client.id,
        date: dateObj,
        startTime: data.startTime,
        endTime,
        totalDuration,
        totalPrice,
        status: needsPix && data.pendingPayment ? "pending_payment" : "confirmed",
        services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
      },
      include: { services: { include: { service: true } } },
    });

    // Envia notificacao WhatsApp ao barbeiro
    const serviceNames = services.map((s) => s.name).join(", ");
    const formattedDate = format(dateObj, "dd 'de' MMMM", { locale: ptBR });

    sendWhatsAppNotification({
      barberPhone: barber.phone,
      clientName: data.clientName,
      serviceName: serviceNames,
      date: formattedDate,
      time: data.startTime,
      shopName: shop.name,
      ...(needsPix && data.pendingPayment ? { isPendingPayment: true } : {}),
    }).catch(console.error);

    // Envia push notification ao barbeiro (Expo Push API)
    const pushBody = `${data.clientName} — ${serviceNames} às ${data.startTime}`;
    const pushToken = (barber as Record<string, unknown>).pushToken as string | null;
    const pushTargets: string[] = [];
    if (pushToken && pushToken.startsWith("ExponentPushToken")) pushTargets.push(pushToken);

    // Também notifica o owner (se for um barbeiro diferente)
    if (!barber.isOwnerProfile) {
      const ownerBarber = await prisma.barber.findFirst({
        where: { shopId: data.shopId, isOwnerProfile: true },
        select: { pushToken: true },
      });
      if (ownerBarber?.pushToken && ownerBarber.pushToken.startsWith("ExponentPushToken") && !pushTargets.includes(ownerBarber.pushToken)) {
        pushTargets.push(ownerBarber.pushToken);
      }
    }

    if (pushTargets.length > 0) {
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushTargets.map((to) => ({
          to,
          title: "Novo agendamento! 💈",
          body: pushBody,
          sound: "default",
        }))),
      }).catch(console.error);
    }

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        date: data.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        totalDuration: appointment.totalDuration,
        totalPrice: appointment.totalPrice,
        services: appointment.services.map((as) => as.service.name),
        shopName: shop.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Appointment POST error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// Buscar agendamentos por telefone do cliente na barbearia
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const shopId = searchParams.get("shopId");

    if (!phone || !shopId) {
      return NextResponse.json({ error: "Parametros phone e shopId obrigatorios" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const client = await prisma.client.findUnique({ where: { phone: cleanPhone } });
    if (!client) return NextResponse.json({ appointments: [], pendingRating: null, loyaltyCount: 0, loyaltyProgress: 0, loyaltyTarget: 10 });

    const appointments = await prisma.appointment.findMany({
      where: { clientId: client.id, shopId },
      include: {
        services: { include: { service: true } },
        barber: { select: { name: true } },
        rating: true,
      },
      orderBy: { date: "desc" },
    });

    // Verifica avaliacao pendente (ultimo agendamento concluido sem avaliacao)
    const unrated = appointments.find(
      (a) => a.status === "completed" && !a.rating
    );

    const pendingRating = unrated
      ? {
          appointmentId: unrated.id,
          barberName: unrated.barber.name,
          date: unrated.date.toISOString().split("T")[0],
          services: unrated.services.map((as) => as.service.name),
        }
      : null;

    // Fidelidade do cliente nesta barbearia
    const loyalty = await prisma.loyaltyCount.findUnique({
      where: { shopId_clientId: { shopId, clientId: client.id } },
    });
    const LOYALTY_TARGET = 10;
    const loyaltyCount = loyalty?.count ?? 0;

    return NextResponse.json({
      appointments: appointments.map((apt) => ({
        id: apt.id,
        date: apt.date.toISOString().split("T")[0],
        startTime: apt.startTime,
        endTime: apt.endTime,
        totalPrice: apt.totalPrice,
        status: apt.status,
        barberId: apt.barberId,
        barberName: apt.barber.name,
        services: apt.services.map((as) => ({ serviceId: as.serviceId, name: as.service.name, price: as.service.price })),
      })),
      pendingRating,
      loyaltyCount,
      loyaltyProgress: loyaltyCount % LOYALTY_TARGET,
      loyaltyTarget: LOYALTY_TARGET,
      // Último agendamento válido para "Agendar novamente"
      lastBooking: (() => {
        const last = appointments.find((a) => a.status !== "cancelled");
        if (!last) return null;
        return {
          barberId: last.barberId,
          barberName: last.barber.name,
          serviceIds: last.services.map((as) => as.serviceId),
          serviceNames: last.services.map((as) => as.service.name),
          totalPrice: last.totalPrice,
        };
      })(),
    });
  } catch (error) {
    console.error("Appointment GET error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
