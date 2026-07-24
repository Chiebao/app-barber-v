import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Chamado pelo cron da Vercel a cada 30 minutos
// Envia lembrete WhatsApp para clientes com agendamento em 1h
export async function GET(req: NextRequest) {
  try {
    // A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas chamadas de cron.
    // Se CRON_SECRET estiver definido, exigimos ele (fecha o endpoint público).
    const CRON_SECRET = process.env.CRON_SECRET;
    if (CRON_SECRET) {
      const authHeader = req.headers.get("authorization");
      const legacy = req.headers.get("x-cron-secret");
      const ok = authHeader === `Bearer ${CRON_SECRET}` || legacy === CRON_SECRET;
      if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 60 * 1000);
    const in75 = new Date(now.getTime() + 75 * 60 * 1000);

    const today = now.toISOString().split("T")[0];
    const targetHour = `${String(in60.getHours()).padStart(2, "0")}:${String(Math.round(in60.getMinutes() / 30) * 30).padStart(2, "0")}`;

    const appointments = await prisma.appointment.findMany({
      where: {
        date: { gte: new Date(today + "T00:00:00"), lte: new Date(today + "T23:59:59") },
        startTime: targetHour,
        status: "confirmed",
        reminderSentAt: null,
      },
      include: {
        client: true,
        shop: true,
        services: { include: { service: true } },
      },
    });

    let sent = 0, failedSend = 0, noChannel = 0;
    for (const apt of appointments) {
      const serviceNames = apt.services.map(s => s.service.name).join(", ");
      const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
      const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

      if (WHATSAPP_API_TOKEN && WHATSAPP_PHONE_ID) {
        const phone = apt.client.phone.replace(/\D/g, "");
        const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;

        const waRes = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phoneWithCountry,
            type: "text",
            text: {
              body: `Ola ${apt.client.name}! Seu horario na *${apt.shop.name}* e em 1 hora.\n\n*Servico:* ${serviceNames}\n*Horario:* ${apt.startTime}\n\nAte logo!`,
            },
          }),
        });

        // Só marca como enviado se a API confirmou. Se falhar, deixa reminderSentAt
        // null para não "consumir" o lembrete silenciosamente.
        if (waRes.ok) {
          await prisma.appointment.update({ where: { id: apt.id }, data: { reminderSentAt: new Date() } });
          sent++;
        } else {
          failedSend++;
          console.error(`[CRON] Falha ao enviar WhatsApp para ${apt.client.name}: ${waRes.status}`);
        }
      } else {
        // WhatsApp API não configurada — não há canal automático.
        // O lembrete é feito manualmente pelo barbeiro (botão "Lembrar" no painel).
        console.log(`[CRON] Lembrete pendente (sem WhatsApp API): ${apt.client.name} - ${apt.startTime} - ${apt.shop.name}`);
        noChannel++;
      }
    }

    return NextResponse.json({ sent, failedSend, noChannel, checked: appointments.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
