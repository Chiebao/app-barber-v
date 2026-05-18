import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Chamado pelo cron da Vercel a cada 30 minutos
// Envia lembrete WhatsApp para clientes com agendamento em 1h
export async function GET(req: NextRequest) {
  try {
    const cronSecret = req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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

    let sent = 0;
    for (const apt of appointments) {
      const serviceNames = apt.services.map(s => s.service.name).join(", ");
      const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
      const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

      if (WHATSAPP_API_TOKEN && WHATSAPP_PHONE_ID) {
        const phone = apt.client.phone.replace(/\D/g, "");
        const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;

        await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
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
      } else {
        console.log(`[CRON] Lembrete (dev): ${apt.client.name} - ${apt.startTime} - ${apt.shop.name}`);
      }

      await prisma.appointment.update({
        where: { id: apt.id },
        data: { reminderSentAt: new Date() },
      });

      sent++;
    }

    return NextResponse.json({ sent, checked: appointments.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
