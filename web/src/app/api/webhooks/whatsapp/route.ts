import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { tratarMensagem, type MensagemDaMeta } from "@/app/lib/robo";

/**
 * Mensagem que alguém manda para a linha do BarberPro.
 *
 * Os lembretes terminam com "é só responder por aqui", e número da Cloud API
 * não tem caixa de entrada em canto nenhum — o que não cai num webhook é
 * DESCARTADO, não fica não lido. A mensagem que mais chega é "não vou poder
 * ir", justamente a que evitaria uma falta.
 *
 * A mesma linha recebe cliente de barbearia, interessado e quem já tem conta.
 * Quem é cliente tem a mensagem guardada (o barbeiro a vê no painel) e recebe o
 * WhatsApp da barbearia. A conversa pertence ao barbeiro e ao cliente — este
 * número é do BarberPro, e servir de intermediário entre eles não escala nem
 * faz sentido. Os demais caem no robô comercial: `lib/robo.ts`.
 *
 * Quem escreveu abriu a janela de 24h, então texto livre passa sem modelo. Mas
 * não é sempre de graça: desde 01/10/2026 cada número tem 1.000 mensagens de
 * serviço entregues de graça por mês, e acima disso cada uma é paga.
 */

/** Só o que precisamos do corpo da Meta. */
interface Payload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: MensagemDaMeta[];
      };
    }[];
  }[];
}

/** GET é o aperto de mão que a Meta faz ao cadastrar a URL. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim();

  if (sp.get("hub.mode") === "subscribe" && token && sp.get("hub.verify_token") === token) {
    // A Meta espera o desafio cru, sem JSON em volta.
    return new NextResponse(sp.get("hub.challenge") || "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/**
 * A assinatura importa mais aqui do que num webhook comum.
 *
 * Este endpoint faz o app ENVIAR WhatsApp. Sem conferir a assinatura,
 * qualquer um posta um corpo com `from` de um número qualquer e nos usa para
 * mandar mensagem a terceiros, às nossas custas.
 */
function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  const segredo = (process.env.WHATSAPP_APP_SECRET || "").trim();
  if (!segredo) return false;
  if (!cabecalho?.startsWith("sha256=")) return false;

  const esperado = crypto.createHmac("sha256", segredo).update(corpo, "utf8").digest("hex");
  const recebido = cabecalho.slice("sha256=".length);
  if (esperado.length !== recebido.length) return false;
  // Comparação de tempo constante: comparar com === vaza o prefixo correto.
  return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

export async function POST(req: NextRequest) {
  // Corpo cru: a assinatura é sobre os bytes exatos, e JSON.parse + stringify
  // devolveria outro texto (ordem de chaves, espaços) e nunca bateria.
  const cru = await req.text();

  const temSegredo = !!(process.env.WHATSAPP_APP_SECRET || "").trim();
  if (temSegredo && !assinaturaConfere(cru, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }
  if (!temSegredo) {
    console.warn("[WhatsApp] WHATSAPP_APP_SECRET ausente — webhook aceito sem conferir assinatura");
  }

  let payload: Payload;
  try {
    payload = JSON.parse(cru);
  } catch {
    // 200 mesmo assim: 4xx faz a Meta reenviar para sempre um corpo que
    // nunca vamos conseguir ler.
    return NextResponse.json({ ok: true });
  }

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const valor = change.value;
        // Recibos de entrega chegam por aqui também, sem `messages`.
        if (!valor?.messages?.length) continue;

        const nomePerfil = valor.contacts?.[0]?.profile?.name || null;

        for (const msg of valor.messages) {
          if (!msg.id || !msg.from) continue;
          await tratarMensagem(msg, nomePerfil);
        }
      }
    }
  } catch (erro) {
    // Erro nosso não pode virar reenvio infinito da Meta.
    console.error("[WhatsApp] erro ao tratar mensagem recebida:", erro);
  }

  return NextResponse.json({ ok: true });
}
