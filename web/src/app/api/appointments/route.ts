import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num, sumMoney, multiplyMoney } from "@/app/lib/money";
import { computePendingDeadline, appointmentStartUtc, occupiesSlotWhere } from "@/app/lib/pending-deadline";
import { bloqueiosDoDia, invadeBloqueio } from "@/app/lib/bloqueios";
import { expedienteDoDia } from "@/app/lib/expediente";
import { sendWebPush, notifyTargets } from "@/app/lib/webpush";
import { tokenDaBarbearia, criarCobrancaPix, cobrancaOk } from "@/app/lib/mercadopago";
import { z } from "zod";
import { situacaoDaLoja } from "@/app/lib/assinatura";

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

    // Barbearia com assinatura bloqueada nao recebe agendamento novo.
    // A mensagem nao expoe que o dono deixou de pagar — isso e problema
    // dele com a plataforma, nao com o cliente que so queria cortar o cabelo.
    const assinatura = await situacaoDaLoja(data.shopId);
    if (!assinatura.aceitaAgendamento) {
      return NextResponse.json(
        { error: "Esta barbearia nao esta aceitando agendamentos online no momento." },
        { status: 503 },
      );
    }

    // Cliente barrado por esta barbearia nao agenda. A mensagem e neutra de
    // proposito: quem foi banido costuma ter saido de uma treta, e confirmar
    // o banimento na tela so joga a discussao de volta pro barbeiro.
    const barrado = await prisma.bannedClient.findUnique({
      where: { shopId_phone: { shopId: data.shopId, phone: cleanPhone } },
      select: { id: true },
    });
    if (barrado) {
      return NextResponse.json(
        { error: "Nao foi possivel concluir o agendamento. Entre em contato com a barbearia." },
        { status: 403 },
      );
    }

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

    // Verifica no-shows (cliente com 2+ faltas). Com o Mercado Pago conectado
    // basta ter conta ligada; sem ele, ainda depende da chave Pix manual.
    const mpToken = await tokenDaBarbearia(data.shopId);
    const needsPix = client.noShowCount >= 2 && (!!mpToken || !!shop.pixKey);

    // Fluxo manual: avisa o cliente que precisa pagar antes de criar qualquer coisa.
    // Com o Mercado Pago seguimos direto — criamos o agendamento e a cobranca juntos.
    if (needsPix && !data.pendingPayment && !mpToken) {
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

          // O bloqueio do barbeiro também precisa barrar aqui, não só sumir
          // da lista. A lista pode estar velha na tela do cliente, e o modo
          // chat monta o pedido por conta própria — sem esta checagem, o
          // almoço de todo dia seria furado de tempos em tempos.
          const bloq = await bloqueiosDoDia(tx, data.barberId, data.date, shop.slotInterval);
          if (bloq.diaTodo) throw new Error("SLOT_BLOCKED");

          // O almoço do expediente barra aqui também, não só na lista: a
          // tela do cliente pode estar velha e o modo chat monta o pedido
          // por conta própria.
          const exp = await expedienteDoDia(tx, shop, data.date);
          if (!exp.aberto) throw new Error("SLOT_BLOCKED");
          if (invadeBloqueio(data.startTime, endTime, [...bloq.intervalos, ...exp.pausas])) {
            throw new Error("SLOT_BLOCKED");
          }

          const isPending = needsPix && (data.pendingPayment || !!mpToken);

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
      if (msg === "SLOT_BLOCKED") {
        return NextResponse.json({ error: "O barbeiro não atende nesse horário" }, { status: 409 });
      }
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

    // Com o Mercado Pago conectado, gera a cobranca Pix de verdade.
    // O cliente paga pelo QR e o webhook confirma o horario sozinho.
    let cobranca: { copiaECola: string; qrCodeBase64: string | null; valor: number; expiraEm: string | null } | null = null;
    if (needsPix && mpToken && appointment.status === "pending_payment") {
      const sinal = Math.max(1, Math.round((totalPrice / 2) * 100) / 100); // 50% de entrada
      const resultado = await criarCobrancaPix({
        accessToken: mpToken,
        valor: sinal,
        descricao: `Sinal - ${shop.name}`,
        referencia: appointment.id,
        nomePagador: data.clientName,
        expiraEm: appointment.pendingExpiresAt || new Date(Date.now() + 6 * 60 * 60 * 1000),
      });

      if (cobrancaOk(resultado)) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { mpPaymentId: resultado.paymentId, mpQrCode: resultado.copiaECola },
        });
        cobranca = {
          copiaECola: resultado.copiaECola,
          qrCodeBase64: resultado.qrCodeBase64,
          valor: resultado.valor,
          expiraEm: resultado.expiraEm,
        };
      } else {
        // Falhou criar a cobranca: nao deixa o cliente preso num limbo —
        // libera o horario e ele tenta de novo
        await prisma.appointment.delete({ where: { id: appointment.id } }).catch(() => {});
        return NextResponse.json(
          {
            error: "Nao foi possivel gerar a cobranca Pix agora. Tente novamente em instantes.",
            detalhe: resultado.erro,
          },
          { status: 503 },
        );
      }
    }

    // O barbeiro é avisado só por push — Expo no app, Web Push no painel.
    // WhatsApp aqui seria a mensagem de maior volume do sistema (uma por
    // agendamento), paga por envio, dizendo o que as duas notificações já
    // disseram de graça.
    const serviceNames = services.map((s) => s.name).join(", ");

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
        status: appointment.status,
      },
      // Presente so quando o Mercado Pago gerou a cobranca — o front mostra o QR
      pixPayment: cobranca,
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
        // Sem isto o histórico do cliente discorda do que ele pagou: o
        // barbeiro lança a pomada, o cliente paga 115 e a tela dele
        // continua dizendo 45.
        comandaItems: { include: { product: { select: { name: true } } } },
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
        produtos: apt.comandaItems.map((ci) => ({
          name: ci.product.name,
          quantity: ci.quantity,
          price: num(ci.price),
        })),
        produtosTotal: sumMoney(apt.comandaItems.map((ci) => multiplyMoney(ci.price, ci.quantity))),
        // O que ele realmente pagou. `totalPrice` é só serviço, e usar
        // aquele número no recibo do cliente seria mostrar menos do que
        // saiu do bolso dele.
        totalGeral: sumMoney([
          num(apt.totalPrice),
          ...apt.comandaItems.map((ci) => multiplyMoney(ci.price, ci.quantity)),
        ]),
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
