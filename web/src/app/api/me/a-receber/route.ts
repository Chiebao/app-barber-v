import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num, money, multiplyMoney } from "@/app/lib/money";

/**
 * Tudo que a barbearia ainda tem para receber — sem recorte de período.
 *
 * O relatório mostra o que falta receber DENTRO do período escolhido, que é
 * o certo para fechar um mês. Mas dívida não respeita fronteira de mês: quem
 * ficou devendo em maio some da tela quando o dono olha agosto, e é
 * justamente esse que ele mais precisa cobrar.
 *
 * Ordem: promessa vencida primeiro, depois o mais antigo. É a ordem em que
 * a cobrança realmente acontece.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const where: Record<string, unknown> = {
      shopId: payload.shopId,
      paidAt: null,
      // Cancelado não é dívida, e falta também não — quem não veio não deve
      // pelo corte que não aconteceu.
      status: { notIn: ["cancelled", "no_show", "pending_payment"] },
      // Só o que já passou: horário marcado para semana que vem não é
      // dívida, é agenda.
      date: { lte: new Date() },
    };

    // Barbeiro contratado cobra o dele; o caixa da casa é do dono
    if (payload.role === "barber") where.barberId = payload.userId;

    const abertos = await prisma.appointment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        barber: { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
        comandaItems: true,
      },
      orderBy: { date: "asc" },
      take: 300,
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const itens = abertos.map((a) => {
      const comanda = money(
        a.comandaItems.reduce((s, ci) => s + multiplyMoney(ci.price, ci.quantity), 0),
      );
      const prometido = a.deferredPaymentDate ?? null;
      return {
        id: a.id,
        date: a.date.toISOString().split("T")[0],
        startTime: a.startTime,
        total: money(num(a.totalPrice) + comanda),
        barberName: a.barber.name,
        client: a.client,
        servicos: a.services.map((s) => s.service.name),
        prometidoPara: prometido ? prometido.toISOString().split("T")[0] : null,
        promessaVencida: !!prometido && prometido < hoje,
        diasEmAberto: Math.floor((hoje.getTime() - a.date.getTime()) / 86_400_000),
      };
    });

    // Promessa furada primeiro — é quem já disse que ia pagar e não pagou
    itens.sort((x, y) => {
      if (x.promessaVencida !== y.promessaVencida) return x.promessaVencida ? -1 : 1;
      return x.date.localeCompare(y.date);
    });

    // Agrupado por cliente: o dono cobra a pessoa, não o atendimento. Três
    // cortes fiados do mesmo cara é uma conversa, não três.
    const porCliente = new Map<string, { id: string; name: string; phone: string; total: number; qtd: number; maisAntigo: string; temPromessaVencida: boolean }>();
    for (const i of itens) {
      const atual = porCliente.get(i.client.id) || {
        id: i.client.id, name: i.client.name, phone: i.client.phone,
        total: 0, qtd: 0, maisAntigo: i.date, temPromessaVencida: false,
      };
      atual.total = money(atual.total + i.total);
      atual.qtd++;
      if (i.date < atual.maisAntigo) atual.maisAntigo = i.date;
      if (i.promessaVencida) atual.temPromessaVencida = true;
      porCliente.set(i.client.id, atual);
    }

    const clientes = [...porCliente.values()].sort((x, y) => {
      if (x.temPromessaVencida !== y.temPromessaVencida) return x.temPromessaVencida ? -1 : 1;
      return x.maisAntigo.localeCompare(y.maisAntigo);
    });

    return NextResponse.json({
      total: money(itens.reduce((s, i) => s + i.total, 0)),
      quantidade: itens.length,
      promessasVencidas: itens.filter((i) => i.promessaVencida).length,
      clientes,
      itens,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
