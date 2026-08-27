import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num } from "@/app/lib/money";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // ?todos=1 traz tambem os desativados — a tela de gestao precisa deles
    // para poder reativar; a comanda continua vendo so os ativos.
    const todos = req.nextUrl.searchParams.get("todos") === "1";
    const products = await prisma.product.findMany({
      where: { shopId: payload.shopId, ...(todos ? {} : { active: true }) },
      orderBy: { name: "asc" },
    });

    // price é Decimal no banco — devolve como número puro para o cliente
    return NextResponse.json({ products: products.map(p => ({ ...p, price: num(p.price) })) });
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

    const { name, price, description, imageUrl, imageUrl2 } = await req.json();
    if (!name || !price) return NextResponse.json({ error: "Nome e preco obrigatorios" }, { status: 400 });

    const product = await prisma.product.create({
      data: {
        shopId: payload.shopId,
        name,
        price: parseFloat(price),
        description: description || null,
        imageUrl: imageUrl || null,
        imageUrl2: imageUrl2 || null,
      },
    });

    return NextResponse.json({ product: { ...product, price: num(product.price) } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { id, name, price, description, imageUrl, imageUrl2, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const existing = await prisma.product.findFirst({ where: { id, shopId: payload.shopId } });
    if (!existing) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(description !== undefined && { description: description || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(imageUrl2 !== undefined && { imageUrl2: imageUrl2 || null }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json({ product: { ...product, price: num(product.price) } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Adicionar item da comanda a um agendamento
export async function PUT(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { appointmentId, productId, quantity } = await req.json();

    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { shopId: true } });
    if (!appointment || appointment.shopId !== payload.shopId) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.shopId !== payload.shopId) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const existing = await prisma.comandaItem.findFirst({ where: { appointmentId, productId } });
    if (existing) {
      await prisma.comandaItem.update({ where: { id: existing.id }, data: { quantity } });
    } else {
      await prisma.comandaItem.create({ data: { appointmentId, productId, quantity: quantity || 1, price: product.price } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE — remove produto de vez
//
// Mesma armadilha dos serviços: comanda_items tem onDelete: Cascade no
// productId, então apagar um produto já vendido levaria junto as linhas de
// comanda dos atendimentos antigos e o financeiro pararia de fechar.
// Produto já vendido só pode ser desativado.
export async function DELETE(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const existing = await prisma.product.findFirst({ where: { id, shopId: payload.shopId } });
    if (!existing) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const vendas = await prisma.comandaItem.count({ where: { productId: id } });
    if (vendas > 0) {
      return NextResponse.json(
        {
          error: "Este produto já foi vendido em atendimentos e não pode ser apagado sem quebrar o histórico.",
          usos: vendas,
          podeDesativar: true,
        },
        { status: 409 },
      );
    }

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
