import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { enviarWhatsApp } from "@/app/lib/whatsapp-send";

/**
 * Mensagem que o cliente manda de volta.
 *
 * Os lembretes terminam com "é só responder por aqui", e até agora responder
 * não levava a lugar nenhum: número da Cloud API não tem caixa de entrada em
 * canto nenhum — o que não cai num webhook é DESCARTADO, não fica não lido.
 * Ou seja, o app convidava a resposta e destruía a resposta. E a mensagem que
 * mais chega é "não vou poder ir", justamente a que evitaria uma falta.
 *
 * O que fazemos: guardamos a mensagem (o barbeiro a vê no painel) e
 * respondemos na hora com o WhatsApp da barbearia. A conversa pertence ao
 * barbeiro e ao cliente — este número é do BarberPro, e servir de
 * intermediário entre eles não escala nem faz sentido.
 *
 * A resposta é de graça: o cliente acabou de escrever, então a janela de 24h
 * está aberta e texto livre passa sem modelo.
 */

/** Só o que precisamos do corpo da Meta. */
interface Payload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
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
          await tratar(msg, nomePerfil);
        }
      }
    }
  } catch (erro) {
    // Erro nosso não pode virar reenvio infinito da Meta.
    console.error("[WhatsApp] erro ao tratar mensagem recebida:", erro);
  }

  return NextResponse.json({ ok: true });
}

async function tratar(
  msg: { id?: string; from?: string; type?: string; text?: { body?: string } },
  nomePerfil: string | null,
) {
  const waMessageId = msg.id!;
  const telefone = msg.from!.replace(/\D/g, "");

  // O que não é texto vira um aviso legível, para o barbeiro saber que existe
  // um áudio esperando e responder pelo WhatsApp dele.
  const tipo = msg.type || "text";
  const texto =
    tipo === "text"
      ? (msg.text?.body || "").slice(0, 2000)
      : `[${tipo}] o cliente mandou ${tipo === "audio" ? "um áudio" : "um arquivo"}`;

  // Descobre a barbearia pelo agendamento mais próximo desse telefone. Um
  // cliente pode frequentar duas barbearias; a mais provável é a do horário
  // que está chegando.
  const cliente = await prisma.client.findUnique({
    where: { phone: telefone.startsWith("55") ? telefone.slice(2) : telefone },
    select: { id: true, name: true },
  });

  let shop: { id: string; name: string; phone: string | null; slug: string } | null = null;
  let quando: { date: Date; startTime: string } | null = null;

  if (cliente) {
    const proximo =
      (await prisma.appointment.findFirst({
        where: { clientId: cliente.id, date: { gte: new Date(Date.now() - 12 * 3600_000) }, status: { not: "cancelled" } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: { date: true, startTime: true, shop: { select: { id: true, name: true, phone: true, slug: true } } },
      })) ||
      // Sem horário à frente, vale o último atendimento: é a barbearia dele.
      (await prisma.appointment.findFirst({
        where: { clientId: cliente.id },
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
        select: { date: true, startTime: true, shop: { select: { id: true, name: true, phone: true, slug: true } } },
      }));

    if (proximo) {
      shop = proximo.shop;
      quando = { date: proximo.date, startTime: proximo.startTime };
    }
  }

  // A trava contra resposta dobrada: a Meta reenvia o webhook quando não
  // recebe 200 rápido, e sem isto o mesmo "oi" geraria duas respostas.
  try {
    await prisma.inboundMessage.create({
      data: {
        waMessageId,
        shopId: shop?.id ?? null,
        clientPhone: telefone,
        clientName: cliente?.name || nomePerfil,
        texto,
        tipo,
      },
    });
  } catch {
    // Violação do unique: já tratamos esta mensagem. Não responde de novo.
    return;
  }

  await responder(telefone, shop, quando);
}

async function responder(
  telefone: string,
  shop: { name: string; phone: string | null; slug: string } | null,
  quando: { date: Date; startTime: string } | null,
) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").replace(/\/+$/, "");

  if (!shop) {
    await enviarWhatsApp(
      telefone,
      "Oi! 👋\n\n" +
        "Esta linha é automática e não é lida por ninguém — ela só envia lembretes de horário.\n\n" +
        "Para falar sobre um agendamento, procure a barbearia direto.",
    );
    return;
  }

  const linhas = [`Oi! 👋`, ``, `Esta linha é automática e não é lida por ninguém. 😅`, ``];

  if (shop.phone) {
    const tel = shop.phone.replace(/\D/g, "");
    const comDDI = tel.startsWith("55") ? tel : `55${tel}`;
    linhas.push(`Para falar com a *${shop.name}*, é por aqui:`, `https://wa.me/${comDDI}`, ``);
  } else {
    // Sem telefone cadastrado, não inventamos um número — mandamos para onde
    // ele consegue se resolver sozinho.
    linhas.push(`Para remarcar ou cancelar, é por aqui:`, `${base}/${shop.slug}/meus-agendamentos`, ``);
  }

  if (quando) {
    const dia = quando.date.toISOString().slice(0, 10).split("-").reverse().slice(0, 2).join("/");
    linhas.push(`📆 Seu horário: ${dia} às ${quando.startTime}`);
  }

  await enviarWhatsApp(telefone, linhas.join("\n"));
}
