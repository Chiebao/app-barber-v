import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { situacaoDe } from "@/app/lib/assinatura";
import { sendWebPush } from "@/app/lib/webpush";

/**
 * 7h de Brasília: avisa cada barbeiro que o Status de hoje está pronto.
 *
 * O aviso não posta nada — postar no Status de alguém o WhatsApp não deixa.
 * Ele leva até o cartão "Status de hoje" no painel, onde a imagem do dia
 * (com os horários livres) já está pronta e o "Postar" abre o compartilhar.
 *
 * Grátis: push do navegador e do app, nenhuma mensagem paga. Só para
 * barbearia que aceita agendamento — status de agenda bloqueada mandaria o
 * cliente para um link que não marca.
 *
 * Disparado uma vez por dia pelo GitHub Actions (.github/workflows/status.yml).
 */
export async function GET(req: NextRequest) {
  const segredo = (process.env.CRON_SECRET || "").trim();
  if (segredo) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${segredo}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  try {
    const lojas = await prisma.shop.findMany({
      select: {
        id: true,
        subscription: { select: { status: true, plano: true, valorCiclo: true, trialEndsAt: true, periodoFim: true, canceladaEm: true } },
        barbers: { where: { active: true }, select: { id: true, pushToken: true } },
      },
    });

    const titulo = "Seu status de hoje está pronto";
    const corpo = "Imagem nova com os horários livres. Toque e poste em dois toques.";
    let lojasAvisadas = 0;
    let aparelhos = 0;
    const tokensExpo: string[] = [];

    for (const loja of lojas) {
      if (!situacaoDe(loja.subscription ?? null).aceitaAgendamento) continue;
      const ids = loja.barbers.map((b) => b.id);
      if (ids.length === 0) continue;
      aparelhos += await sendWebPush(ids, { title: titulo, body: corpo, url: "/admin/painel?status=1", tag: "status-do-dia" });
      for (const b of loja.barbers) {
        if (b.pushToken && b.pushToken.startsWith("ExponentPushToken")) tokensExpo.push(b.pushToken);
      }
      lojasAvisadas++;
    }

    // App do celular (Expo), em lotes de 100 — o limite da API deles.
    for (let i = 0; i < tokensExpo.length; i += 100) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokensExpo.slice(i, i + 100).map((to) => ({ to, title: titulo, body: corpo, sound: "default" }))),
      }).catch((e) => console.error("[status-do-dia] expo:", e));
    }

    return NextResponse.json({ lojasAvisadas, aparelhosWeb: aparelhos, aparelhosApp: tokensExpo.length });
  } catch (error) {
    console.error("[status-do-dia] erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
