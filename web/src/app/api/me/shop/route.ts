import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

// GET /api/me/shop — retorna dados completos da barbearia
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const shop = await prisma.shop.findUnique({
      where: { id: payload.shopId },
      select: {
        id: true,
        name: true,
        slug: true,
        openTime: true,
        closeTime: true,
        workDays: true,
        avgServiceTime: true,
        pixKey: true,
        logoUrl: true,
        colorTheme: true,
        bookingMode: true,
      },
    });

    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    return NextResponse.json({ shop });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH /api/me/shop — atualiza configurações da barbearia (só dono)
// Body: { openTime?, closeTime?, workDays?, avgServiceTime?, pixKey? }
export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { openTime, closeTime, workDays, avgServiceTime, pixKey, logoUrl, colorTheme, bookingMode } = await req.json();

    const data: Record<string, unknown> = {};
    if (openTime !== undefined) data.openTime = openTime;
    if (closeTime !== undefined) data.closeTime = closeTime;
    if (workDays !== undefined) data.workDays = workDays;
    if (avgServiceTime !== undefined) data.avgServiceTime = parseInt(avgServiceTime);
    if (pixKey !== undefined) data.pixKey = pixKey || null;
    if (logoUrl !== undefined) data.logoUrl = logoUrl || null;
    if (colorTheme !== undefined) data.colorTheme = colorTheme;
    if (bookingMode !== undefined && ["steps", "agent"].includes(bookingMode)) data.bookingMode = bookingMode;

    const shop = await prisma.shop.update({
      where: { id: payload.shopId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        openTime: true,
        closeTime: true,
        workDays: true,
        avgServiceTime: true,
        pixKey: true,
        logoUrl: true,
        colorTheme: true,
        bookingMode: true,
      },
    });

    return NextResponse.json({ shop });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
