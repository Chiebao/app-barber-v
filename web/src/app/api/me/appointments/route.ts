import { NextRequest, NextResponse } from "next/server";
import { chaveDaPessoa } from "@/app/lib/pessoa";
import { nomeDoCliente } from "@/app/lib/nome-do-cliente";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num, money, multiplyMoney } from "@/app/lib/money";
import { isPendingExpired } from "@/app/lib/pending-deadline";
import { materializarRecorrentes } from "@/app/lib/recurrence";
import { quaisPediramParar } from "@/app/lib/parar";

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const where: Record<string, unknown> = {
      shopId: payload.shopId,
      status: { not: "cancelled" },
    };

    // Barbeiro ve apenas os seus; dono ve todos
    if (payload.role === "barber") where.barberId = payload.userId;

    if (date) {
      // Materializa os cortes fixos do dia antes de listar. É o que faz o
      // recorrente aparecer na agenda como um agendamento comum — e é por isso
      // que pagamento, falta, comanda e fidelidade funcionam nele sem que
      // nenhuma dessas telas precise saber o que é recorrência.
      await materializarRecorrentes(payload.shopId, date, date);
      where.date = { gte: new Date(date + "T00:00:00.000Z"), lte: new Date(date + "T23:59:59.999Z") };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true, notes: true } },
        barber: { select: { name: true } },
        services: { include: { service: true } },
        rating: { select: { score: true } },
        comandaItems: { include: { product: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // Faltas de cada PESSOA do dia, numa consulta so.
    //
    // Era `Client.noShowCount`, um contador no TELEFONE: o card do pai
    // mostrava as faltas do filho. Buscar por agendamento seria uma query
    // por linha, entao pega o historico dos clientes do dia de uma vez e
    // agrupa por pessoa aqui.
    const clientesDoDia = [...new Set(appointments.map((a) => a.clientId))];
    const historico = clientesDoDia.length
      ? await prisma.appointment.findMany({
          where: { clientId: { in: clientesDoDia }, status: "no_show", faltaPerdoada: false },
          select: { clientId: true, clientName: true },
        })
      : [];
    const faltasPorPessoa = new Map<string, number>();
    for (const h of historico) {
      const k = `${h.clientId}|${chaveDaPessoa(h.clientName)}`;
      faltasPorPessoa.set(k, (faltasPorPessoa.get(k) ?? 0) + 1);
    }

    // O barbeiro precisa saber que o lembrete não vai sair: senão ele conta com
    // o aviso, e o cliente que pediu para não receber esquece o horário.
    const pediramParar = await quaisPediramParar([...new Set(appointments.map((a) => a.client.phone))]);

    const now = new Date();

    return NextResponse.json({
      appointments: appointments.map(a => ({
        id: a.id,
        // Pré-agendamento por Pix: prazo e se já venceu (barbeiro resolve na mão)
        pendingExpiresAt: a.pendingExpiresAt,
        pendingExpired: isPendingExpired(a.status, a.pendingExpiresAt, now),
        date: a.date.toISOString().split("T")[0],
        startTime: a.startTime,
        endTime: a.endTime,
        totalPrice: num(a.totalPrice),
        status: a.status,
        paymentMethod: a.paymentMethod,
        paidAt: a.paidAt,
        barberName: a.barber.name,
        // O nome vem do AGENDAMENTO, nao do Client: telefone repetido (pai e
        // filho) e a mesma linha de cliente, e quem marcou depois nao pode
        // renomear quem marcou antes.
        client: {
          ...a.client,
          name: nomeDoCliente(a),
          noShowCount: faltasPorPessoa.get(`${a.clientId}|${chaveDaPessoa(nomeDoCliente(a))}`) ?? 0,
          pediuParar: pediramParar.has(a.client.phone),
        },
        services: a.services.map(as => ({ serviceId: as.serviceId, name: as.service.name, category: as.service.category, price: num(as.service.price) })),
        rating: a.rating?.score || null,
        comanda: a.comandaItems.map(ci => ({ productId: ci.productId, name: ci.product.name, quantity: ci.quantity, price: num(ci.price) })),
        comandaTotal: money(a.comandaItems.reduce((s, ci) => s + multiplyMoney(ci.price, ci.quantity), 0)),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
