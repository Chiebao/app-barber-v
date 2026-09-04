import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { limparEsperaVencida } from "@/app/lib/espera";
import { appointmentStartUtc } from "@/app/lib/pending-deadline";
import { format } from "date-fns";
import { enviarModelo } from "@/app/lib/whatsapp-send";
import { MODELOS, preverTexto, type NomeModelo } from "@/app/lib/whatsapp-templates";
import { ptBR } from "date-fns/locale";
import { enviarAgendaDoDia } from "@/app/lib/agenda-do-dia";

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

      // 3) Quando este token expira?
      // Token temporario do painel morre em 24h, e a falha e silenciosa:
      // os lembretes simplesmente param de sair. Melhor descobrir aqui.
      const dbgRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${WHATSAPP_API_TOKEN}` +
          `&access_token=${WHATSAPP_API_TOKEN}`,
      );
      const dbg = await dbgRes.json().catch(() => ({}));
      const expiraEm = dbg?.data?.expires_at as number | undefined;
      const validade =
        expiraEm === undefined
          ? "nao foi possivel consultar"
          : expiraEm === 0
          ? "nunca expira"
          : `expira em ${new Date(expiraEm * 1000).toISOString()}`;

      // 4) O token enxerga a conta do WhatsApp Business? (?waba=ID)
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

      // ?templates=WABA_ID — lista o que a Meta realmente guardou.
      // Sem isto, um envio recusado vira adivinhação: não dá para saber se
      // o problema é aprovação, idioma, nome ou formato do modelo.
      const wabaTemplates = new URL(req.url).searchParams.get("templates");
      let templates: unknown = null;
      if (wabaTemplates) {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${wabaTemplates}/message_templates` +
            `?fields=name,language,status,category,components&limit=50`,
          { headers: h },
        );
        const corpo = await r.json().catch(() => ({}));
        templates = r.ok
          ? (corpo as { data?: unknown[] }).data
          : (corpo as { error?: { message?: string } })?.error?.message;
      }

      // ?assinaturas=WABA_ID — quais campos de webhook a Meta esta
      // realmente entregando. Sem isto, webhook mudo vira adivinhacao entre
      // "nao assinou o campo" e "nao chegou".
      const wabaAssin = new URL(req.url).searchParams.get("assinaturas");
      let assinaturas: unknown = null;
      if (wabaAssin) {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${wabaAssin}/subscribed_apps`,
          { headers: h },
        );
        const corpo = await r.json().catch(() => ({}));
        assinaturas = r.ok ? corpo : (corpo as { error?: { message?: string } })?.error?.message;
      }

      // ?assinar=WABA_ID — inscreve ESTE app na conta do WhatsApp.
      //
      // Sem a inscricao a Meta nao entrega webhook nenhum, e marcar campos
      // no painel nao adianta: `subscribed_apps` volta vazio e a mensagem do
      // cliente simplesmente nao chega. Protegido pelo CRON_SECRET.
      const wabaAssinar = new URL(req.url).searchParams.get("assinar");
      let inscricao: unknown = null;
      if (wabaAssinar) {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${wabaAssinar}/subscribed_apps`,
          { method: "POST", headers: h },
        );
        const corpo = await r.json().catch(() => ({}));
        inscricao = { ok: r.ok, resposta: corpo };
      }

      // ?send=55DDDNUMERO — envia uma mensagem de teste para validar o canal.
      // Protegido pelo CRON_SECRET, igual ao resto da rota.
      //
      // Com ?modelo=nome, dispara aquele modelo com os valores de exemplo.
      // É o único jeito honesto de testar: modelo só entrega de verdade
      // fora da janela de 24h, e forjar agendamento/fatura para ver cada um
      // chegar seria trabalho demais para uma conferência de rotina.
      const destino = new URL(req.url).searchParams.get("send");
      const modeloPedido = new URL(req.url).searchParams.get("modelo");
      let envioTeste: unknown = null;

      if (destino && modeloPedido) {
        if (!(modeloPedido in MODELOS)) {
          envioTeste = {
            ok: false,
            erro: `modelo desconhecido: ${modeloPedido}`,
            disponiveis: Object.keys(MODELOS),
          };
        } else {
          const nome = modeloPedido as NomeModelo;
          const vars = MODELOS[nome].exemplo;
          const ok = await enviarModelo(destino, nome, vars);
          envioTeste = {
            ok,
            modelo: nome,
            textoEsperado: preverTexto(nome, vars),
            dica: ok ? undefined : "modelo nao aprovado em pt_BR, nome diferente, ou variaveis a mais/menos",
          };
        }
      } else if (destino) {
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
        assinaturas,
        inscricao,
        templates,
        tokenValido: meRes.ok,
        tokenPertenceA: meRes.ok ? me : me?.error?.message,
        numeroAcessivel: numRes.ok,
        numeroDetalhe: numRes.ok ? num : num?.error?.message,
        contaWhatsAppAcessivel: wabaRes.ok,
        numerosDaConta: waba,
        tokenValidade: validade,
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

    // A agenda do dia no WhatsApp do barbeiro: a cópia que sobrevive à
    // queda, porque mora fora do nosso sistema. Depois dos lembretes
    // porque o cliente esperando o corte vem antes do conforto do dono.
    let agendaDoDia;
    try {
      agendaDoDia = await enviarAgendaDoDia(now);
    } catch (err) {
      console.error("[CRON] Falha ao mandar a agenda do dia:", err);
    }

    // Fila de espera que já não pode dar certo: o dia passou e não abriu
    // vaga. Roda todo dia porque a lista some da vista do barbeiro e ele
    // não vai limpar à mão — foi assim que uma cliente ficou uma semana
    // esperando um dia que já tinha passado.
    let espera = { removidos: 0, avisados: 0, falhas: 0 };
    try {
      espera = await limparEsperaVencida(now);
    } catch (err) {
      console.error("[CRON] Falha ao limpar lista de espera:", err);
    }

    // Tentativa de login que já venceu não serve pra nada, e a chave é o
    // telefone: sem varrer, a tabela guarda uma linha por número que já
    // errou a senha uma vez, pra sempre. Roda depois dos lembretes porque
    // é limpeza — se falhar, ninguém deixa de ser avisado.
    let limpas = 0;
    try {
      const agora = new Date();
      const r = await prisma.rateLimit.deleteMany({
        where: {
          janelaAte: { lt: agora },
          OR: [{ bloqueadoAte: null }, { bloqueadoAte: { lt: agora } }],
        },
      });
      limpas = r.count;
    } catch (err) {
      console.error("[CRON] Falha ao limpar rate_limits:", err);
    }

    return NextResponse.json({
      horasAntes: HORAS_ANTES,
      canalConfigurado: temCanal,
      candidatos: candidatos.length,
      naJanela: aVencer.length,
      sent,
      failedSend,
      noChannel,
      espera,
      limpas,
      agendaDoDia,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
