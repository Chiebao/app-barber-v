import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

// GET — lista serviços da barbearia
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const services = await prisma.service.findMany({
      where: { shopId: payload.shopId },
      orderBy: { category: "asc" },
    });
    return NextResponse.json({ services });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST — cria serviço
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { name, duration, price, category, imageUrl } = await req.json();
    if (!name || !duration || !price || !category) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }
    const service = await prisma.service.create({
      data: { shopId: payload.shopId, name, duration: Number(duration), price: Number(price), category, imageUrl: imageUrl || null },
    });
    return NextResponse.json({ service });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH — atualiza serviço (nome, preço, duração, foto, ativo)
export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id, name, duration, price, imageUrl, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const existing = await prisma.service.findFirst({ where: { id, shopId: payload.shopId } });
    if (!existing) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(price !== undefined && { price: Number(price) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json({ service });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
