import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * Radar de cliente sumido (B19).
 *
 * Cada cliente tem um ritmo próprio: um volta a cada 15 dias, outro a cada 45.
 * Em vez de usar um prazo fixo para todo mundo, calculamos o ritmo de cada um
 * e avisamos quem passou bastante do ponto.
 *
 * Recuperar quem já foi cliente é muito mais barato que conquistar alguém novo,
 * e hoje o barbeiro só percebe a ausência por acaso — quando já perdeu o cara.
 */

/** Quantas vezes o próprio intervalo do cliente precisa estourar para virar alerta. */
const FATOR_ATRASO = 1.5;
/** Piso em dias, para não alertar sobre quem vem toda semana e atrasou 3 dias. */
const MINIMO_DIAS = 20;
/** Precisa de pelo menos 2 visitas para existir um "ritmo". */
const MINIMO_VISITAS = 2;

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const agendamentos = await prisma.appointment.findMany({
      where: {
        shopId: payload.shopId,
        status: { notIn: ["cancelled", "no_show"] },
      },
      select: {
        date: true,
        clientId: true,
        client: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { date: "asc" },
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Agrupa as visitas de cada cliente
    const porCliente = new Map<
      string,
      { nome: string; telefone: string; datas: Date[]; temFuturo: boolean }
    >();

    for (const a of agendamentos) {
      const atual = porCliente.get(a.clientId) || {
        nome: a.client.name,
        telefone: a.client.phone,
        datas: [] as Date[],
        temFuturo: false,
      };
      // Agendamento futuro significa que o cliente NÃO sumiu — ele já vai voltar
      if (a.date >= hoje) atual.temFuturo = true;
      else atual.datas.push(a.date);
      porCliente.set(a.clientId, atual);
    }

    const sumidos = [];

    for (const [clientId, c] of porCliente) {
      if (c.temFuturo) continue;                    // já tem horário marcado
      if (c.datas.length < MINIMO_VISITAS) continue; // sem ritmo para comparar

      const primeira = c.datas[0];
      const ultima = c.datas[c.datas.length - 1];

      // Ritmo médio: quanto tempo ele costuma levar entre uma visita e outra
      const intervaloMedio = Math.round(
        (ultima.getTime() - primeira.getTime()) / 86400000 / (c.datas.length - 1),
      );
      if (intervaloMedio <= 0) continue;

      const diasSemVir = Math.floor((hoje.getTime() - ultima.getTime()) / 86400000);

      const atrasado =
        diasSemVir >= MINIMO_DIAS && diasSemVir >= intervaloMedio * FATOR_ATRASO;
      if (!atrasado) continue;

      sumidos.push({
        clientId,
        nome: c.nome,
        telefone: c.telefone,
        visitas: c.datas.length,
        intervaloMedio,
        diasSemVir,
        // Quantos dias além do ritmo dele — é por aqui que ordenamos
        atrasoEmDias: diasSemVir - intervaloMedio,
        ultimaVisita: ultima.toISOString().split("T")[0],
      });
    }

    // Os mais atrasados primeiro, mas dando peso a quem vinha muito
    sumidos.sort((a, b) => b.atrasoEmDias - a.atrasoEmDias || b.visitas - a.visitas);

    return NextResponse.json({
      total: sumidos.length,
      clientes: sumidos.slice(0, 30),
      criterio: {
        fatorAtraso: FATOR_ATRASO,
        minimoDias: MINIMO_DIAS,
        minimoVisitas: MINIMO_VISITAS,
      },
    });
  } catch (error) {
    console.error("clientes-sumidos error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
