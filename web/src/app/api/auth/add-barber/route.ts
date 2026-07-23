import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken, hashPassword } from "@/app/lib/auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  password: z.string().min(6),
  role: z.enum(["barber", "owner"]).optional().default("barber"),
  commission: z.number().min(0).max(100).optional().default(0),
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const payload = auth ? verifyToken(auth.slice(7)) : null;
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const data = schema.parse(await req.json());
    const exists = await prisma.barber.findFirst({ where: { shopId: payload.shopId, phone: data.phone } });
    if (exists) return NextResponse.json({ error: "Telefone ja cadastrado nesta barbearia" }, { status: 400 });

    const barber = await prisma.barber.create({
      data: {
        shopId: payload.shopId,
        name: data.name,
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        commission: data.commission,
      },
    });

    return NextResponse.json({ barber: { id: barber.id, name: barber.name, phone: barber.phone, role: barber.role, commission: barber.commission } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const payload = auth ? verifyToken(auth.slice(7)) : null;
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const barbers = await prisma.barber.findMany({
      where: { shopId: payload.shopId, isOwnerProfile: false },
      select: { id: true, name: true, phone: true, active: true, role: true, commission: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ barbers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const payload = auth ? verifyToken(auth.slice(7)) : null;
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { barberId, active, role, commission, newPassword } = await req.json();

    // Multi-tenant: garante que o barbeiro pertence à barbearia do dono
    const target = await prisma.barber.findUnique({ where: { id: barberId }, select: { shopId: true, isOwnerProfile: true } });
    if (!target || target.shopId !== payload.shopId) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (active !== undefined) updateData.active = active;
    if (role !== undefined) updateData.role = role;
    if (commission !== undefined) updateData.commission = Math.min(100, Math.max(0, Number(commission)));
    if (newPassword !== undefined) {
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 });
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }
    await prisma.barber.update({ where: { id: barberId }, data: updateData });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
