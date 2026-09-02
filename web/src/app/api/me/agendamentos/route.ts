import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import { occupiesSlotWhere } from "@/app/lib/pending-deadline";
import { bloqueiosDoDia, invadeBloqueio, emMinutos, emTexto } from "@/app/lib/bloqueios";
import { num, sumMoney } from "@/app/lib/money";

/**
 * Agendamento criado pelo barbeiro, no balcão.
 *
 * Rota separada da pública de propósito. A pública carrega regras que existem
 * para desconhecido na internet — pré-pagamento por Pix depois de duas faltas,
 * aviso ao barbeiro, contagem de conversão — e nenhuma delas faz sentido com o
 * cliente parado na frente dele. Exigir Pix de quem já está na cadeira seria
 * absurdo, e o aviso de "novo agendamento" avisaria o barbeiro do que ele
 * acabou de digitar.
 *
 * Misturar as duas com um sinalizador na rota pública seria pior: um endpoint
 * público que muda de regra conforme um campo do corpo é exatamente onde
 * buracos de autorização nascem.
 *
 * O que NÃO muda: conflito de horário e bloqueio continuam valendo, na mesma
 * transação Serializable. O barbeiro pode furar a fila, não a física.
 */

const schema = z.object({
  clientName: z.string().trim().min(2, "Nome muito curto").max(80),
  clientPhone: z.string().trim().min(8, "Telefone inválido"),
  serviceIds: z.array(z.string()).min(1, "Escolha ao menos um serviço"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  barberId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const data = schema.parse(await req.json());

    const shop = await prisma.shop.findUnique({ where: { id: payload.shopId } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Barbeiro contratado só agenda para si; o dono escolhe.
    let barberId: string;
    if (payload.role === "owner") {
      const alvo = data.barberId
        ? await prisma.barber.findFirst({ where: { id: data.barberId, shopId: shop.id }, select: { id: true } })
        : await prisma.barber.findFirst({ where: { shopId: shop.id, isOwnerProfile: true }, select: { id: true } });
      if (!alvo) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
      barberId = alvo.id;
    } else {
      barberId = payload.userId;
    }

    const services = await prisma.service.findMany({
      where: { id: { in: data.serviceIds }, shopId: shop.id },
    });
    if (services.length !== data.serviceIds.length) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 400 });
    }

    const totalDuration = services.reduce((s, x) => s + x.duration, 0);
    const totalPrice = sumMoney(services.map((s) => s.price));

    const inicio = emMinutos(data.startTime);
    if (!Number.isFinite(inicio)) {
      return NextResponse.json({ error: "Horário inválido" }, { status: 400 });
    }
    const endTime = emTexto(inicio + totalDuration);

    // Telefone sempre só dígitos: é assim que o cliente é encontrado em todo
    // o resto do app, e um formato divergente cria um cliente duplicado.
    const phone = data.clientPhone.replace(/\D/g, "");
    const client = await prisma.client.upsert({
      where: { phone },
      create: { name: data.clientName.trim(), phone },
      update: { name: data.clientName.trim() },
    });

    const dateObj = new Date(data.date + "T00:00:00");

    try {
      const agendamento = await prisma.$transaction(
        async (tx) => {
          const conflitos = await tx.appointment.findMany({
            where: {
              barberId,
              date: { gte: new Date(data.date + "T00:00:00"), lte: new Date(data.date + "T23:59:59") },
              ...occupiesSlotWhere(),
            },
            select: { startTime: true, endTime: true },
          });
          if (conflitos.some((a) => data.startTime < a.endTime && endTime > a.startTime)) {
            throw new Error("SLOT_CONFLICT");
          }

          const bloq = await bloqueiosDoDia(tx, barberId, data.date, shop.slotInterval);
          if (bloq.diaTodo) throw new Error("SLOT_BLOCKED");
          if (invadeBloqueio(data.startTime, endTime, bloq.intervalos)) throw new Error("SLOT_BLOCKED");

          return tx.appointment.create({
            data: {
              shopId: shop.id,
              barberId,
              clientId: client.id,
              date: dateObj,
              startTime: data.startTime,
              endTime,
              totalDuration,
              totalPrice,
              status: "confirmed",
              services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
            },
            include: { services: { include: { service: true } } },
          });
        },
        { isolationLevel: "Serializable" },
      );

      return NextResponse.json({
        agendamento: {
          id: agendamento.id,
          date: data.date,
          startTime: agendamento.startTime,
          endTime: agendamento.endTime,
          totalPrice: num(agendamento.totalPrice),
          cliente: client.name,
        },
      });
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : "";
      if (msg === "SLOT_BLOCKED") {
        return NextResponse.json({ error: "Esse horário está bloqueado na sua agenda" }, { status: 409 });
      }
      if (
        msg === "SLOT_CONFLICT" ||
        msg.includes("could not serialize") ||
        (erro as { code?: string })?.code === "P2034"
      ) {
        return NextResponse.json({ error: "Já existe atendimento nesse horário" }, { status: 409 });
      }
      throw erro;
    }
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Só para o painel conferir se o token ainda vale antes de abrir o formulário. */
export async function GET(req: NextRequest) {
  const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
  if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
