import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const products = await prisma.product.findMany({
      where: { shopId: payload.shopId, active: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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

    return NextResponse.json({ product });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id, ...data } = await req.json();
    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json({ product });
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
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

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
