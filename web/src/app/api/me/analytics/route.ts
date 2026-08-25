import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * Funil do link público: quantas pessoas abriram × quantas agendaram.
 *
 * Responde a pergunta que hoje o dono não consegue responder — se o link
 * converte pouco, o problema é o fluxo; se converte bem, o problema é
 * divulgação. São ações completamente diferentes.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const dias = Math.min(Number(new URL(req.url).searchParams.get("dias") || 30), 90);
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const desdeAnterior = new Date(Date.now() - dias * 2 * 24 * 60 * 60 * 1000);

    const [eventos, eventosAnteriores] = await Promise.all([
      prisma.shopEvent.findMany({
        where: { shopId: payload.shopId, createdAt: { gte: desde } },
        select: { type: true, sessionId: true, createdAt: true },
      }),
      prisma.shopEvent.findMany({
        where: { shopId: payload.shopId, createdAt: { gte: desdeAnterior, lt: desde } },
        select: { type: true, sessionId: true },
      }),
    ]);

    const contar = (lista: { type: string; sessionId: string }[]) => {
      const visitas = new Set(lista.filter((e) => e.type === "view").map((e) => e.sessionId));
      const agendou = new Set(lista.filter((e) => e.type === "book").map((e) => e.sessionId));
      const conversao = visitas.size > 0 ? Math.round((agendou.size / visitas.size) * 1000) / 10 : 0;
      return { visitas: visitas.size, agendamentos: agendou.size, conversao };
    };

    const atual = contar(eventos);
    const anterior = contar(eventosAnteriores);

    // Série diária para o gráfico
    const porDia: Record<string, { visitas: Set<string>; books: Set<string> }> = {};
    for (const e of eventos) {
      const dia = e.createdAt.toISOString().split("T")[0];
      if (!porDia[dia]) porDia[dia] = { visitas: new Set(), books: new Set() };
      if (e.type === "view") porDia[dia].visitas.add(e.sessionId);
      else porDia[dia].books.add(e.sessionId);
    }
    const serie = Object.entries(porDia)
      .map(([dia, v]) => ({ dia, visitas: v.visitas.size, agendamentos: v.books.size }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    return NextResponse.json({
      dias,
      atual,
      anterior,
      // Quanto a conversão variou em pontos percentuais
      variacaoConversao: Math.round((atual.conversao - anterior.conversao) * 10) / 10,
      serie,
      // Sem dados ainda? A tela avisa em vez de mostrar zero como se fosse ruim
      semDados: eventos.length === 0,
    });
  } catch (error) {
    console.error("analytics error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
