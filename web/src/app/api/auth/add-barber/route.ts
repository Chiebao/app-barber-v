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
  email: z.string().email("E-mail invalido").optional().or(z.literal("")),
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
        email: data.email || null,
      },
    });

    return NextResponse.json({ barber: { id: barber.id, name: barber.name, phone: barber.phone, role: barber.role, commission: barber.commission, email: barber.email, imageUrl: barber.imageUrl } });
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
      where: { shopId: payload.shopId },
      select: {
        id: true, name: true, phone: true, active: true, role: true,
        commission: true, email: true, imageUrl: true, isOwnerProfile: true,
      },
      orderBy: [{ isOwnerProfile: "desc" }, { name: "asc" }],
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

    const { barberId, name, active, role, commission, newPassword, email, imageUrl } = await req.json();

    // Multi-tenant: garante que o barbeiro pertence à barbearia do dono
    const target = await prisma.barber.findUnique({ where: { id: barberId }, select: { shopId: true, isOwnerProfile: true } });
    if (!target || target.shopId !== payload.shopId) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      const limpo = String(name).trim();
      if (limpo.length < 2) return NextResponse.json({ error: "O nome precisa ter ao menos 2 caracteres" }, { status: 400 });
      updateData.name = limpo;
    }
    if (email !== undefined) {
      const limpo = String(email ?? "").trim();
      if (limpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
        return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
      }
      updateData.email = limpo || null;
    }
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (active !== undefined) {
      // Desativar o perfil do dono o tiraria da propria agenda e da tela de
      // agendamento do cliente, sem nenhuma forma obvia de voltar atras.
      if (active === false && target.isOwnerProfile) {
        return NextResponse.json({ error: "O seu próprio perfil não pode ser desativado" }, { status: 400 });
      }
      updateData.active = active;
    }
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
