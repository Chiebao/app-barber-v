import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import { agoraNaBarbearia } from "@/app/lib/time-slots";
import { dataDoDia, materializarRecorrentes } from "@/app/lib/recurrence";
import { barbeiroDoToken } from "@/app/lib/barbeiro-do-token";
import { expedientePorDia, linhasDoExpediente } from "@/app/lib/expediente";
import { invadeBloqueio, emMinutos, emTexto } from "@/app/lib/bloqueios";

/**
 * Cortes fixos — o cliente que vem toda semana no mesmo horário.
 *
 * O barbeiro cria a regra uma vez; as ocorrências nascem sozinhas conforme a
 * agenda avança (ver `lib/recurrence.ts`). Aqui só se administra a REGRA.
 */

const criarSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(8),
  barberId: z.string().optional(),
  serviceIds: z.array(z.string()).min(1),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * De quem é a agenda: o barbeiro mexe na própria, o dono escolhe de quem.
 * Mesmo critério das outras rotas de `/api/me`.
 */

// GET /api/me/recurring — regras da barbearia (ativas primeiro)
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const regras = await prisma.recurringAppointment.findMany({
      where: {
        shopId: payload.shopId,
        // Barbeiro só enxerga os próprios fixos; dono vê todos.
        ...(payload.role === "owner" ? {} : { barberId: payload.userId }),
      },
      include: {
        client: { select: { name: true, phone: true } },
        barber: { select: { id: true, name: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
      orderBy: [{ active: "desc" }, { weekday: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({
      recurring: regras.map((r) => ({
        id: r.id,
        clientName: r.client.name,
        clientPhone: r.client.phone,
        barberId: r.barber.id,
        barberName: r.barber.name,
        weekday: r.weekday,
        startTime: r.startTime,
        totalDuration: r.totalDuration,
        totalPrice: Number(r.totalPrice),
        startDate: r.startDate.toISOString().split("T")[0],
        endDate: r.endDate.toISOString().split("T")[0],
        active: r.active,
        services: r.services.map((s) => ({ id: s.service.id, name: s.service.name })),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/me/recurring — cria o corte fixo
export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const { payload } = guarda;

    const data = criarSchema.parse(await req.json());

    if (data.endDate < data.startDate) {
      return NextResponse.json(
        { error: "A data final não pode ser antes da inicial" },
        { status: 400 },
      );
    }

    const barberId = await barbeiroDoToken(payload, data.barberId);
    if (!barberId) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 403 });

    const shop = await prisma.shop.findUnique({
      where: { id: payload.shopId },
      select: { id: true, workDays: true, openTime: true, closeTime: true },
    });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // O expediente daquele dia da semana, não o horário único da loja: quem
    // abre 09:00 na quarta e 10:00 no resto tinha o corte das 09:00 recusado
    // com a mensagem do horário geral.
    const expediente = expedientePorDia(
      shop,
      await linhasDoExpediente(prisma, shop.id),
      data.weekday,
    );

    if (!expediente.aberto) {
      return NextResponse.json(
        { error: "A barbearia não abre nesse dia da semana" },
        { status: 400 },
      );
    }

    const servicos = await prisma.service.findMany({
      where: { id: { in: data.serviceIds }, shopId: payload.shopId, active: true },
      select: { id: true, duration: true, price: true },
    });
    if (servicos.length !== data.serviceIds.length) {
      return NextResponse.json({ error: "Serviço inválido" }, { status: 400 });
    }

    const totalDuration = servicos.reduce((s, x) => s + x.duration, 0);
    const totalPrice = servicos.reduce((s, x) => s + Number(x.price), 0);

    // O corte precisa caber antes de fechar — a mesma conta da agenda normal.
    const fimDoCorte = emMinutos(data.startTime) + totalDuration;
    if (emMinutos(data.startTime) < emMinutos(expediente.abre)
      || fimDoCorte > emMinutos(expediente.fecha)) {
      return NextResponse.json(
        { error: `O corte não cabe no expediente (${expediente.abre}–${expediente.fecha})` },
        { status: 400 },
      );
    }

    // Almoço é intervalo ocupado, igual a bloqueio: o corte que ATRAVESSA a
    // parada também invade, não só o que começa dentro dela.
    if (invadeBloqueio(data.startTime, emTexto(fimDoCorte), expediente.pausas)) {
      const p = expediente.pausas[0];
      return NextResponse.json(
        { error: `O corte cai no intervalo do dia (${p.startTime}–${p.endTime})` },
        { status: 400 },
      );
    }

    const telefone = data.clientPhone.replace(/\D/g, "");
    let client = await prisma.client.findUnique({ where: { phone: telefone } });
    if (!client) {
      client = await prisma.client.create({ data: { name: data.clientName, phone: telefone } });
    }

    const regra = await prisma.recurringAppointment.create({
      data: {
        shopId: payload.shopId,
        barberId,
        clientId: client.id,
        weekday: data.weekday,
        startTime: data.startTime,
        totalDuration,
        totalPrice,
        startDate: dataDoDia(data.startDate),
        endDate: dataDoDia(data.endDate),
        services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
      },
    });

    // Materializa já o que cabe no horizonte da agenda, para o corte aparecer
    // sem o barbeiro precisar navegar até a data.
    const { dia: hoje } = agoraNaBarbearia();
    const criadas = await materializarRecorrentes(payload.shopId, hoje, data.endDate);

    return NextResponse.json({ id: regra.id, ocorrenciasCriadas: criadas });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/me/recurring?id=X[&futuros=1] — encerra o corte fixo
export async function DELETE(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const { payload } = guarda;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const regra = await prisma.recurringAppointment.findFirst({
      where: {
        id,
        shopId: payload.shopId,
        ...(payload.role === "owner" ? {} : { barberId: payload.userId }),
      },
    });
    if (!regra) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    // DESATIVA em vez de apagar: os cortes que já aconteceram continuam no
    // histórico, no financeiro e na fidelidade. Apagar a regra levaria o
    // vínculo junto e o barbeiro perderia de onde veio aquele atendimento.
    await prisma.recurringAppointment.update({ where: { id }, data: { active: false } });

    // As ocorrências FUTURAS que ainda ninguém tocou somem — o compromisso
    // acabou, e deixá-las na agenda seguraria horário que já está livre.
    const { dia: hoje } = agoraNaBarbearia();
    const removidas = await prisma.appointment.deleteMany({
      where: {
        recurringId: id,
        date: { gte: dataDoDia(hoje) },
        status: "confirmed",
        paidAt: null,
      },
    });

    return NextResponse.json({ ok: true, ocorrenciasRemovidas: removidas.count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
