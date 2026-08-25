import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { appointmentStartUtc } from "@/app/lib/pending-deadline";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Lembrete automático ao cliente.
 *
 * Deve ser chamado de tempos em tempos (a cada 15 min é o ideal). O cron da
 * Vercel no plano grátis roda 1x/dia, então em produção usamos também um cron
 * externo gratuito apontando para cá — o `reminderSentAt` garante que ninguém
 * receba o mesmo aviso duas vezes.
 *
 * Regra: avisa quem tem corte nas próximas HORAS_ANTES horas e ainda não foi
 * avisado. Diferente da versão antiga, que procurava o horário EXATO e por
 * isso perdia quase todo mundo.
 */

/** Quantas horas antes do corte o cliente é avisado. */
const HORAS_ANTES = Number(process.env.REMINDER_HOURS_BEFORE || 2);

/** Env vars às vezes vêm com espaços/quebras coladas — limpar evita erro silencioso. */
function envClean(name: string): string {
  return (process.env[name] || "").trim().replace(/\n$/, "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const CRON_SECRET = process.env.CRON_SECRET;
    if (CRON_SECRET) {
      const authHeader = req.headers.get("authorization");
      const legacy = req.headers.get("x-cron-secret");
      const ok = authHeader === `Bearer ${CRON_SECRET}` || legacy === CRON_SECRET;
      if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const now = new Date();
    const limite = new Date(now.getTime() + HORAS_ANTES * 60 * 60 * 1000);

    // Busca um intervalo largo de datas e filtra pelo instante real depois,
    // porque `date` + `startTime` estão no fuso da barbearia, não em UTC.
    const inicioBusca = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fimBusca = new Date(now.getTime() + (HORAS_ANTES + 36) * 60 * 60 * 1000);

    const candidatos = await prisma.appointment.findMany({
      where: {
        date: { gte: inicioBusca, lte: fimBusca },
        status: "confirmed",
        reminderSentAt: null,
      },
      include: {
        client: true,
        shop: true,
        services: { include: { service: true } },
      },
    });

    // Só quem começa daqui a no máximo HORAS_ANTES (e ainda não começou)
    const aVencer = candidatos.filter((apt) => {
      const inicio = appointmentStartUtc(apt.date, apt.startTime);
      return inicio > now && inicio <= limite;
    });

    const WHATSAPP_API_TOKEN = envClean("WHATSAPP_API_TOKEN");
    const WHATSAPP_PHONE_ID = envClean("WHATSAPP_PHONE_ID");
    const temCanal = !!(WHATSAPP_API_TOKEN && WHATSAPP_PHONE_ID);

    // ?check=1 — diagnostico do canal sem enviar nada a ninguem.
    // Serve para conferir se o token da Meta esta valido apos configurar.
    if (new URL(req.url).searchParams.get("check") === "1") {
      if (!temCanal) {
        return NextResponse.json({
          canal: "nao configurado",
          temToken: !!WHATSAPP_API_TOKEN,
          temPhoneId: !!WHATSAPP_PHONE_ID,
        });
      }
      const h = { Authorization: `Bearer ${WHATSAPP_API_TOKEN}` };

      // 1) O token em si e valido?
      const meRes = await fetch("https://graph.facebook.com/v21.0/me", { headers: h });
      const me = await meRes.json().catch(() => ({}));

      // 2) O token enxerga ESTE numero?
      const numRes = await fetch(
        `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}?fields=verified_name,display_phone_number,quality_rating`,
        { headers: h },
      );
      const num = await numRes.json().catch(() => ({}));

      // 3) Quais contas de WhatsApp o token alcanca (ajuda a achar o ID certo)
      const wabaRes = await fetch(
        "https://graph.facebook.com/v21.0/me/businesses?fields=id,name",
        { headers: h },
      );
      const waba = await wabaRes.json().catch(() => ({}));

      return NextResponse.json({
        tokenValido: meRes.ok,
        tokenPertenceA: meRes.ok ? me : me?.error?.message,
        numeroAcessivel: numRes.ok,
        numeroDetalhe: numRes.ok ? num : num?.error?.message,
        negociosVisiveis: wabaRes.ok ? waba : waba?.error?.message,
        tokenTamanho: WHATSAPP_API_TOKEN.length,
        phoneIdConfigurado: WHATSAPP_PHONE_ID,
        diagnostico: meRes.ok && !numRes.ok
          ? "Token OK, mas o PHONE_ID esta errado ou o System User nao tem acesso a esse numero"
          : !meRes.ok
          ? "Token invalido"
          : "Tudo certo",
      });
    }

    let sent = 0, failedSend = 0, noChannel = 0;

    for (const apt of aVencer) {
      const serviceNames = apt.services.map((s) => s.service.name).join(", ");
      const dataFmt = format(apt.date, "dd 'de' MMMM", { locale: ptBR });

      if (!temCanal) {
        // Sem canal configurado: o lembrete continua sendo manual (botão no painel)
        console.log(`[CRON] Lembrete pendente (sem canal): ${apt.client.name} - ${apt.startTime} - ${apt.shop.name}`);
        noChannel++;
        continue;
      }

      const phone = apt.client.phone.replace(/\D/g, "");
      const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;

      try {
        const waRes = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phoneWithCountry,
            type: "text",
            text: {
              body:
                `Olá ${apt.client.name.split(" ")[0]}! 🫡\n` +
                `Passando pra lembrar do seu horário na *${apt.shop.name}*:\n\n` +
                `📆 ${dataFmt} às ${apt.startTime}\n` +
                `💇‍♂️ ${serviceNames}\n\n` +
                `Até lá! Deus abençoe 🙏`,
            },
          }),
        });

        if (waRes.ok) {
          // Só marca como enviado quando a API confirma — se falhar, tenta na próxima rodada
          await prisma.appointment.update({
            where: { id: apt.id },
            data: { reminderSentAt: new Date() },
          });
          sent++;
        } else {
          failedSend++;
          const detalhe = await waRes.text().catch(() => "");
          console.error(`[CRON] Falha WhatsApp p/ ${apt.client.name}: ${waRes.status} ${detalhe.slice(0, 200)}`);
        }
      } catch (err) {
        failedSend++;
        console.error(`[CRON] Erro ao enviar p/ ${apt.client.name}:`, err);
      }
    }

    return NextResponse.json({
      horasAntes: HORAS_ANTES,
      canalConfigurado: temCanal,
      candidatos: candidatos.length,
      naJanela: aVencer.length,
      sent,
      failedSend,
      noChannel,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
