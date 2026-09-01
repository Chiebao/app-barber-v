import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import { emMinutos } from "@/app/lib/bloqueios";

/**
 * Bloqueios que se repetem toda semana — o almoço, a folga da quarta.
 *
 * Cada barbeiro cuida do seu. O dono pode mexer no de qualquer um da loja;
 * um barbeiro contratado só no próprio, porque a folga dele não é assunto de
 * quem senta na cadeira ao lado.
 */

const regraSchema = z.object({
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  diasSemana: z.array(z.number().int().min(0).max(6)).min(1, "Escolha ao menos um dia"),
  barberId: z.string().optional(),
});

/** Quem pode mexer na agenda de quem. */
async function barbeiroAlvo(
  payload: { userId: string; role: string; shopId: string },
  pedido?: string | null,
): Promise<string | null> {
  if (payload.role !== "owner") {
    // Barbeiro contratado só mexe no próprio, mesmo que mande outro id.
    const eu = await prisma.barber.findFirst({
      where: { id: payload.userId, shopId: payload.shopId },
      select: { id: true },
    });
    return eu?.id ?? null;
  }
  if (!pedido) {
    // Dono sem escolher: assume o perfil de barbeiro dele mesmo.
    const meu = await prisma.barber.findFirst({
      where: { shopId: payload.shopId, isOwnerProfile: true },
      select: { id: true },
    });
    return meu?.id ?? null;
  }
  const b = await prisma.barber.findFirst({
    where: { id: pedido, shopId: payload.shopId },
    select: { id: true },
  });
  return b?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const barberId = await barbeiroAlvo(payload, req.nextUrl.searchParams.get("barberId"));
    if (!barberId) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 403 });

    const regras = await prisma.recurringBlock.findMany({
      where: { barberId, ativo: true },
      orderBy: { horaInicio: "asc" },
      select: { id: true, horaInicio: true, horaFim: true, diasSemana: true },
    });

    return NextResponse.json({ regras });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const corpo = regraSchema.parse(await req.json());

    if (emMinutos(corpo.horaFim) <= emMinutos(corpo.horaInicio)) {
      return NextResponse.json({ error: "O fim precisa ser depois do início" }, { status: 400 });
    }

    const barberId = await barbeiroAlvo(payload, corpo.barberId);
    if (!barberId) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 403 });

    const regra = await prisma.recurringBlock.create({
      data: {
        shopId: payload.shopId,
        barberId,
        horaInicio: corpo.horaInicio,
        horaFim: corpo.horaFim,
        // Sem repetidos: [1,1,2] viraria o mesmo bloqueio contado duas vezes.
        diasSemana: [...new Set(corpo.diasSemana)].sort((a, b) => a - b),
      },
      select: { id: true, horaInicio: true, horaFim: true, diasSemana: true },
    });

    return NextResponse.json({ regra });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Informe a regra" }, { status: 400 });

    // Escopado pela loja E pelo barbeiro que o token pode tocar: sem isto, o
    // id de outra barbearia seria apagável por quem soubesse adivinhar.
    const alvo = await barbeiroAlvo(payload, null);
    const regra = await prisma.recurringBlock.findFirst({
      where: {
        id,
        shopId: payload.shopId,
        ...(payload.role === "owner" ? {} : { barberId: alvo ?? "__nenhum__" }),
      },
      select: { id: true },
    });
    if (!regra) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });

    // Desliga em vez de apagar: a folga de janeiro costuma voltar em julho, e
    // o barbeiro não precisa lembrar de que horas era.
    await prisma.recurringBlock.update({ where: { id }, data: { ativo: false } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
