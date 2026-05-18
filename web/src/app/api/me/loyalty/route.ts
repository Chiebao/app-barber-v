import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const loyalties = await prisma.loyaltyCount.findMany({
      where: { shopId: payload.shopId },
      include: { client: { select: { name: true, phone: true } } },
      orderBy: { count: "desc" },
    });

    return NextResponse.json({
      loyalties: loyalties.map(l => ({
        clientName: l.client.name,
        clientPhone: l.client.phone,
        count: l.count,
        progress: l.count % 10,
        rewardsEarned: Math.floor(l.count / 10),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
