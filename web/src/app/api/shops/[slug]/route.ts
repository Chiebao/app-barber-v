import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { situacaoDaLoja } from "@/app/lib/assinatura";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { slug: params.slug },
      select: {
        id: true, name: true, slug: true,
        openTime: true, closeTime: true, workDays: true, avgServiceTime: true, slotInterval: true,
        pixKey: true, logoUrl: true, colorTheme: true, bookingMode: true,
        // Endereco e contato: publicos de proposito — e como o cliente
        // descobre onde fica a barbearia antes de fechar o agendamento.
        phone: true, address: true, neighborhood: true, city: true, state: true, zipCode: true,
        barbers: {
          where: { active: true },
          select: { id: true, name: true, imageUrl: true },
        },
        services: {
          where: { active: true },
          select: { id: true, name: true, duration: true, price: true, category: true, imageUrl: true },
        },
      },
    });

    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Avaliação média da barbearia — visível para clientes
    const ratingAgg = await prisma.rating.aggregate({
      where: { shopId: shop.id },
      _avg: { score: true },
      _count: { score: true },
    });

    const assinatura = await situacaoDaLoja(shop.id);

    return NextResponse.json({
      shop: {
        ...shop,
        // Só isto vaza para fora: se dá para agendar ou não. O estado da
        // assinatura em si é assunto entre a barbearia e a plataforma.
        aceitaAgendamento: assinatura.aceitaAgendamento,
        // price é Decimal no banco — devolve como número puro para o cliente
        services: shop.services.map((s) => ({ ...s, price: num(s.price) })),
        avgRating: ratingAgg._avg.score ? Math.round(ratingAgg._avg.score * 10) / 10 : null,
        ratingCount: ratingAgg._count.score,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
