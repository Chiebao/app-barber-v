import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendWhatsAppNotification } from "@/app/lib/whatsapp";
import { num, sumMoney } from "@/app/lib/money";
import { computePendingDeadline, appointmentStartUtc, occupiesSlotWhere } from "@/app/lib/pending-deadline";
import { sendWebPush, notifyTargets } from "@/app/lib/webpush";
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
    const totalPrice = sumMoney(services.map((s) => s.price));

    const [startH, startM] = data.startTime.split(":").map(Number);
    const endMinutes = startH * 60 + startM + totalDuration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    const dateObj = new Date(data.date + "T00:00:00");

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

    const clientId = client.id;

    // Checagem de conflito + criacao numa transacao atomica (Serializable)
    // impede que dois clientes reservem o mesmo horario simultaneamente
    let appointment;
    try {
      appointment = await prisma.$transaction(
        async (tx) => {
          // Pré-agendamentos vencidos não seguram mais o horário
          const conflicts = await tx.appointment.findMany({
            where: {
              barberId: data.barberId,
              date: { gte: new Date(data.date + "T00:00:00"), lte: new Date(data.date + "T23:59:59") },
              ...occupiesSlotWhere(),
            },
            select: { startTime: true, endTime: true },
          });

          const hasConflict = conflicts.some((apt) => data.startTime < apt.endTime && endTime > apt.startTime);
          if (hasConflict) throw new Error("SLOT_CONFLICT");

          const isPending = needsPix && data.pendingPayment;

          return tx.appointment.create({
            data: {
              shopId: data.shopId,
              barberId: data.barberId,
              clientId,
              date: dateObj,
              startTime: data.startTime,
              endTime,
              totalDuration,
              totalPrice,
              status: isPending ? "pending_payment" : "confirmed",
              // Prazo do Pix: 6h de barbearia aberta, nunca depois da hora do corte
              pendingExpiresAt: isPending
                ? computePendingDeadline(
                    new Date(),
                    { openTime: shop.openTime, closeTime: shop.closeTime, workDays: shop.workDays },
                    appointmentStartUtc(dateObj, data.startTime),
                  )
                : null,
              services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
            },
            include: { services: { include: { service: true } } },
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (txError) {
      // Conflito de horario (checagem manual OU serialization failure do Postgres)
      const msg = txError instanceof Error ? txError.message : "";
      if (msg === "SLOT_CONFLICT" || msg.includes("could not serialize") || (txError as { code?: string })?.code === "P2034") {
        // Cliente estava pagando o Pix e o horário foi preenchido nesse meio-tempo
        if (data.pendingPayment) {
          return NextResponse.json({
            error: "Esse horário foi preenchido enquanto você fazia o pagamento. Se você já enviou o Pix, fale com a barbearia — eles vão te reagendar ou devolver o valor.",
            slotTaken: true,
          }, { status: 409 });
        }
        return NextResponse.json({ error: "Horario ja ocupado" }, { status: 409 });
      }
      throw txError;
    }

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
    const isPendingPix = needsPix && data.pendingPayment;
    const pushTitle = isPendingPix ? "Pix declarado — confirme 💰" : "Novo agendamento! 💈";
    const pushBody = isPendingPix
      ? `${data.clientName} informou que pagou o Pix de ${serviceNames} às ${data.startTime}. Confirme no painel.`
      : `${data.clientName} — ${serviceNames} às ${data.startTime}`;
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

    // Notificação no navegador (PWA) — chega mesmo com o app fechado
    notifyTargets(data.shopId, data.barberId)
      .then((ids) => sendWebPush(ids, {
        title: pushTitle,
        body: pushBody,
        url: "/admin/painel",
        tag: isPendingPix ? "pix-declarado" : "novo-agendamento",
      }))
      .catch(console.error);

    if (pushTargets.length > 0) {
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushTargets.map((to) => ({
          to,
          title: pushTitle,
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
        totalPrice: num(appointment.totalPrice),
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
    const nameParam = searchParams.get("name");

    if (!phone || !shopId) {
      return NextResponse.json({ error: "Parametros phone e shopId obrigatorios" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const client = await prisma.client.findUnique({ where: { phone: cleanPhone } });
    if (!client) return NextResponse.json({ appointments: [], verified: false, pendingRating: null, loyaltyCount: 0, loyaltyProgress: 0, loyaltyTarget: 10 });

    // Privacidade (LGPD): a lista detalhada de agendamentos só é liberada se o nome informado
    // bater com o cadastrado (defesa contra alguém que digita o telefone de terceiros).
    const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
    const entered = nameParam ? norm(nameParam) : "";
    const stored = norm(client.name);
    const verified = entered.length >= 2 && (stored === entered || stored.split(" ")[0] === entered || stored.startsWith(entered));

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
      verified,
      // A lista só é enviada quando o nome confere (privacidade/LGPD).
      // O fluxo de agendamento não usa esta lista — ele lê loyalty/lastBooking/pendingRating.
      appointments: verified ? appointments.map((apt) => ({
        id: apt.id,
        date: apt.date.toISOString().split("T")[0],
        startTime: apt.startTime,
        endTime: apt.endTime,
        totalPrice: num(apt.totalPrice),
        status: apt.status,
        barberId: apt.barberId,
        barberName: apt.barber.name,
        services: apt.services.map((as) => ({ serviceId: as.serviceId, name: as.service.name, price: num(as.service.price) })),
      })) : [],
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
          totalPrice: num(last.totalPrice),
        };
      })(),
    });
  } catch (error) {
    console.error("Appointment GET error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
