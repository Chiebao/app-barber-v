import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { z } from "zod";

/**
 * Clientes barrados por UMA barbearia.
 *
 * O banimento vale só para a loja do token. `Client` é uma tabela global
 * (o mesmo telefone atende várias barbearias), então guardamos por telefone
 * + shopId: quem apronta numa barbearia não fica impedido de cortar na outra.
 *
 * Só o dono bane — barbeiro contratado não decide quem a loja atende.
 */

const schema = z.object({
  phone: z.string().min(10, "Telefone inválido"),
  name: z.string().optional(),
  reason: z.string().max(200).optional(),
});

// GET — lista de banidos da barbearia
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const banned = await prisma.bannedClient.findMany({
      where: { shopId: payload.shopId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ banned });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST — bane um telefone
export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Só o dono pode banir" }, { status: 401 });
    }

    const data = schema.parse(await req.json());
    const phone = data.phone.replace(/\D/g, "");
    if (phone.length < 10) return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });

    // Nome guardado junto: se o cliente for apagado depois, a lista de
    // banidos continua legível em vez de virar uma lista de números soltos.
    let name = data.name?.trim() || null;
    if (!name) {
      const cliente = await prisma.client.findUnique({ where: { phone }, select: { name: true } });
      name = cliente?.name ?? null;
    }

    const banned = await prisma.bannedClient.upsert({
      where: { shopId_phone: { shopId: payload.shopId, phone } },
      create: { shopId: payload.shopId, phone, name, reason: data.reason?.trim() || null },
      update: { name, reason: data.reason?.trim() || null },
    });

    // Banir não apaga o passado: os atendimentos que já aconteceram continuam
    // no histórico e no financeiro. O que some é a possibilidade de agendar
    // de novo — e os agendamentos futuros, que não fazem mais sentido.
    const agora = new Date();
    const futuros = await prisma.appointment.updateMany({
      where: {
        shopId: payload.shopId,
        client: { phone },
        date: { gte: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()) },
        status: { notIn: ["cancelled", "completed", "no_show"] },
      },
      data: { status: "cancelled", cancelledAt: agora, cancelledBy: "barbearia" },
    });

    return NextResponse.json({ banned, agendamentosCancelados: futuros.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE — remove o banimento
export async function DELETE(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Telefone obrigatório" }, { status: 400 });

    // deleteMany, e não delete: escopado pela loja do token, e não estoura
    // se o banimento já tiver sido removido em outra aba.
    const r = await prisma.bannedClient.deleteMany({
      where: { shopId: payload.shopId, phone: String(phone).replace(/\D/g, "") },
    });

    return NextResponse.json({ ok: true, removidos: r.count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
