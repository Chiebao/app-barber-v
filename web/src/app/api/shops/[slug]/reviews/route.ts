import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const ratings = await prisma.rating.findMany({
      where: { shopId: shop.id, score: { gte: 1 } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        score: true,
        comment: true,
        createdAt: true,
        client: { select: { name: true } },
        appointment: {
          select: {
            barber: { select: { name: true } },
            services: { select: { service: { select: { name: true } } } },
          },
        },
      },
    });

    const reviews = ratings.map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt,
      clientName: r.client.name.split(" ")[0], // só primeiro nome por privacidade
      barberName: r.appointment.barber.name,
      services: r.appointment.services.map((s) => s.service.name),
    }));

    const avg = ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / ratings.length) * 10) / 10
      : null;

    return NextResponse.json({ reviews, avg, total: ratings.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
