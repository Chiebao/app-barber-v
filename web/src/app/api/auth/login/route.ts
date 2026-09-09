import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyPassword, signToken } from "@/app/lib/auth";
import { num } from "@/app/lib/money";
import { situacao, registrarFalha, limpar, mensagemDeBloqueio, LOGIN } from "@/app/lib/limite";

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) return NextResponse.json({ error: "Dados obrigatórios" }, { status: 400 });

    // Trava por IDENTIDADE. O limitador por IP do middleware vive em
    // memoria e cada instancia serverless tem o seu — quem ataca uma conta
    // especifica troca de IP de graca, mas nao troca o telefone do alvo.
    const chave = `login:${String(phone).replace(/\D/g, "")}`;
    const trava = await situacao(chave);
    if (trava.bloqueado) {
      return NextResponse.json({ error: mensagemDeBloqueio(trava.segundos) }, { status: 429 });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Tenta como dono
    const owner = await prisma.owner.findUnique({
      where: { phone },
      include: {
        shops: {
          include: { services: true, barbers: { where: { active: true } } },
        },
      },
    });

    if (owner && await verifyPassword(password, owner.passwordHash)) {
      const shop = owner.shops[0];
      if (!shop) return NextResponse.json({ error: "Nenhuma barbearia cadastrada" }, { status: 404 });
      await limpar(chave);
      const token = signToken({ userId: owner.id, role: "owner", shopId: shop.id });
      return NextResponse.json({
        token,
        role: "owner",
        user: { id: owner.id, name: owner.name, phone: owner.phone },
        shop: {
          id: shop.id, name: shop.name, slug: shop.slug,
          openTime: shop.openTime, closeTime: shop.closeTime,
          workDays: shop.workDays, avgServiceTime: shop.avgServiceTime,
          pixKey: shop.pixKey, link: `${base}/${shop.slug}`,
          services: shop.services.map(s => ({ ...s, price: num(s.price) })),
          barbers: shop.barbers.map(b => ({ id: b.id, name: b.name, phone: b.phone })),
        },
      });
    }

    // Tenta como barbeiro
    const barber = await prisma.barber.findFirst({
      where: { phone, active: true },
      include: { shop: { include: { services: true } } },
    });

    if (barber && await verifyPassword(password, barber.passwordHash)) {
      await limpar(chave);
      const token = signToken({ userId: barber.id, role: barber.role as "owner" | "barber", shopId: barber.shopId });
      return NextResponse.json({
        token,
        role: "barber",
        user: { id: barber.id, name: barber.name, phone: barber.phone },
        shop: {
          id: barber.shop.id, name: barber.shop.name, slug: barber.shop.slug,
          openTime: barber.shop.openTime, closeTime: barber.shop.closeTime,
          workDays: barber.shop.workDays, avgServiceTime: barber.shop.avgServiceTime,
          link: `${base}/${barber.shop.slug}`,
          services: barber.shop.services.map(s => ({ ...s, price: num(s.price) })),
        },
      });
    }

    // Falhou: conta a tentativa. A mensagem não muda se a conta existe ou
    // não — dizer "esse telefone não existe" entregaria de graça a lista de
    // quem é cliente do BarberPro.
    const depois = await registrarFalha(chave, LOGIN);
    if (depois.bloqueado) {
      return NextResponse.json({ error: mensagemDeBloqueio(depois.segundos) }, { status: 429 });
    }

    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
