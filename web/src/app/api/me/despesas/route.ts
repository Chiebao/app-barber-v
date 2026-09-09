import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num, sumMoney } from "@/app/lib/money";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import {
  CATEGORIAS,
  categoriaValida,
  limitesDoMes,
  mesDeTexto,
} from "@/app/lib/despesas";

/**
 * Despesas da barbearia.
 *
 * Só o dono vê e mexe. Barbeiro não tem por que saber quanto é o aluguel —
 * e a comissão dele é calculada sobre o serviço, não sobre o que sobra.
 */

const despesaSchema = z.object({
  descricao: z.string().trim().min(1, "Descreva a despesa").max(80),
  valor: z.number().positive("O valor precisa ser maior que zero").max(999999),
  categoria: z.string().refine(categoriaValida, "Categoria desconhecida"),
  // "2026-08-15". Ausente = hoje.
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recorrente: z.boolean().optional(),
});

/** "2026-08-15" → meio-dia UTC, que é 9h em São Paulo: longe das bordas. */
function dataDoDia(texto?: string): Date {
  const base = texto || new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  return new Date(`${base}T12:00:00.000Z`);
}

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { ano, mes } = mesDeTexto(req.nextUrl.searchParams.get("mês"));
    const { inicio, fim } = limitesDoMes(ano, mes);

    const despesas = await prisma.expense.findMany({
      where: { shopId: payload.shopId, data: { gte: inicio, lt: fim } },
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    });

    const porCategoria: Record<string, number> = {};
    for (const d of despesas) {
      porCategoria[d.categoria] = sumMoney([porCategoria[d.categoria], d.valor]);
    }

    return NextResponse.json({
      mes: `${ano}-${String(mes).padStart(2, "0")}`,
      total: sumMoney(despesas.map((d) => d.valor)),
      porCategoria,
      categorias: CATEGORIAS,
      despesas: despesas.map((d) => ({
        id: d.id,
        descricao: d.descricao,
        valor: num(d.valor),
        categoria: d.categoria,
        data: d.data.toISOString().slice(0, 10),
        recorrente: d.recorrente,
        // Quem tem origem nasceu do cron. A tela avisa "lançada sozinha" para
        // o dono não achar que digitou e esqueceu.
        automatica: !!d.origemId,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const dados = despesaSchema.parse(await req.json());

    const despesa = await prisma.expense.create({
      data: {
        shopId: payload.shopId,
        descricao: dados.descricao,
        valor: dados.valor,
        categoria: dados.categoria,
        data: dataDoDia(dados.data),
        recorrente: dados.recorrente ?? false,
      },
    });

    return NextResponse.json({ despesa: { ...despesa, valor: num(despesa.valor) } });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const corpo = await req.json();
    const id = typeof corpo?.id === "string" ? corpo.id : "";
    if (!id) return NextResponse.json({ error: "Informe a despesa" }, { status: 400 });

    const dados = despesaSchema.partial().parse(corpo);

    // Escopado pela loja do token: sem isto, o id de outra barbearia seria
    // editável por quem soubesse adivinhar.
    const atual = await prisma.expense.findFirst({
      where: { id, shopId: payload.shopId },
      select: { id: true },
    });
    if (!atual) return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 });

    const despesa = await prisma.expense.update({
      where: { id },
      data: {
        ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
        ...(dados.valor !== undefined ? { valor: dados.valor } : {}),
        ...(dados.categoria !== undefined ? { categoria: dados.categoria } : {}),
        ...(dados.data !== undefined ? { data: dataDoDia(dados.data) } : {}),
        ...(dados.recorrente !== undefined ? { recorrente: dados.recorrente } : {}),
      },
    });

    return NextResponse.json({ despesa: { ...despesa, valor: num(despesa.valor) } });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Informe a despesa" }, { status: 400 });

    const atual = await prisma.expense.findFirst({
      where: { id, shopId: payload.shopId },
      select: { id: true, recorrente: true },
    });
    if (!atual) return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 });

    // Apagar o molde não pode apagar o histórico: as cópias já lançadas são
    // meses que fecharam. A FK é SetNull, então elas ficam — mas perdem o
    // vínculo, e sem `recorrente` no molde o cron para de gerar novas.
    await prisma.expense.delete({ where: { id } });

    return NextResponse.json({ ok: true, eraMolde: atual.recorrente });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
