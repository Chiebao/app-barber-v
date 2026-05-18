import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken, hashPassword } from "@/app/lib/auth";

// Tenta vincular um barbeiro existente (mesmo telefone do dono) ao perfil de dono
async function findOrLinkOwnerBarber(shopId: string, ownerId: string) {
  // 1. Já tem perfil de dono marcado?
  const existing = await prisma.barber.findFirst({
    where: { shopId, isOwnerProfile: true },
    select: { id: true, name: true, phone: true },
  });
  if (existing) return existing;

  // 2. Busca o telefone do dono para tentar vincular um barbeiro com mesmo número
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: { phone: true, name: true },
  });
  if (!owner) return null;

  const phoneDigits = owner.phone.replace(/\D/g, "");

  // 3. Existe barbeiro na barbearia com esse telefone?
  const samePhone = await prisma.barber.findFirst({
    where: { shopId, phone: phoneDigits },
    select: { id: true, name: true, phone: true },
  });
  if (samePhone) {
    // Vincula automaticamente
    await prisma.barber.update({
      where: { id: samePhone.id },
      data: { isOwnerProfile: true },
    });
    return samePhone;
  }

  return null;
}

// GET /api/me/owner-barber — retorna o perfil de barbeiro do dono (se existir)
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const barber = await findOrLinkOwnerBarber(payload.shopId, payload.userId);
    return NextResponse.json({ barber: barber || null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/me/owner-barber — cria perfil de barbeiro para o dono
// Body: { name, phone, password }
export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Tenta vincular existente antes de criar
    const linked = await findOrLinkOwnerBarber(payload.shopId, payload.userId);
    if (linked) return NextResponse.json({ barber: { id: linked.id, name: linked.name } });

    const { name, phone, password } = await req.json();
    if (!name || !phone || !password) return NextResponse.json({ error: "Dados obrigatorios" }, { status: 400 });

    const phoneDigits = phone.replace(/\D/g, "");

    const barber = await prisma.barber.create({
      data: {
        shopId: payload.shopId,
        name,
        phone: phoneDigits,
        passwordHash: await hashPassword(password),
        role: "owner",
        isOwnerProfile: true,
      },
    });

    return NextResponse.json({ barber: { id: barber.id, name: barber.name } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
