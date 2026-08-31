import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { appointmentStartUtc } from "@/app/lib/pending-deadline";
import { format } from "date-fns";
import { enviarModelo } from "@/app/lib/whatsapp-send";
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

      // 3) O token enxerga a conta do WhatsApp Business? (?waba=ID)
      // Se o System User nao tiver a WABA vinculada como ativo, falha aqui.
      const wabaId = new URL(req.url).searchParams.get("waba");
      let waba: unknown = "informe ?waba=ID para testar";
      let wabaRes = { ok: false };
      if (wabaId) {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
          { headers: h },
        );
        wabaRes = { ok: r.ok };
        const corpo = await r.json().catch(() => ({}));
        waba = r.ok ? corpo : (corpo as { error?: { message?: string } })?.error?.message;
      }

      // ?send=55DDDNUMERO — envia uma mensagem de teste para validar o canal.
      // Protegido pelo CRON_SECRET, igual ao resto da rota.
      const destino = new URL(req.url).searchParams.get("send");
      let envioTeste: unknown = null;
      if (destino) {
        const tel = destino.replace(/\D/g, "");
        const r = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: tel.startsWith("55") ? tel : `55${tel}`,
            type: "text",
            text: { body: "BarberPro: teste de canal ✅ Se voce recebeu isso, os lembretes automaticos estao prontos para funcionar." },
          }),
        });
        const corpo = await r.json().catch(() => ({}));
        envioTeste = { ok: r.ok, status: r.status, resposta: corpo };
      }

      return NextResponse.json({
        envioTeste,
        tokenValido: meRes.ok,
        tokenPertenceA: meRes.ok ? me : me?.error?.message,
        numeroAcessivel: numRes.ok,
        numeroDetalhe: numRes.ok ? num : num?.error?.message,
        contaWhatsAppAcessivel: wabaRes.ok,
        numerosDaConta: waba,
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
        // Modelo aprovado: o lembrete e sempre iniciado por nos, entao
        // fora da janela de 24h a Meta so entrega desta forma.
        // Modelo aprovado: o lembrete é sempre iniciado por nós, então fora
        // da janela de 24h a Meta só entrega desta forma.
        const enviado = await enviarModelo(phoneWithCountry, "lembrete_agendamento", [
          apt.client.name.split(" ")[0],
          apt.shop.name,
          apt.startTime,
          serviceNames,
        ]);

        if (enviado) {
          // Só marca como enviado quando a API confirma — se falhar, tenta na próxima rodada
          await prisma.appointment.update({
            where: { id: apt.id },
            data: { reminderSentAt: new Date() },
          });
          sent++;
        } else {
          failedSend++;
          // O detalhe do erro já sai no log de enviarModelo, com o nome do
          // modelo — aqui basta dizer de quem era a mensagem.
          console.error(`[CRON] Falha WhatsApp p/ ${apt.client.name}`);
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
