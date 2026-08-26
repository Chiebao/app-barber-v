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
        phone: true,
        address: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
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
//
// O nome PODE ser trocado, mas o slug NÃO acompanha de propósito: o link já
// foi mandado para os clientes, impresso em cartão, colado na vitrine. Trocar
// o slug junto quebraria tudo isso de forma silenciosa. Nome é rótulo, slug é
// endereço — só mudam juntos se o dono pedir explicitamente um dia.
export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const {
      name, openTime, closeTime, workDays, avgServiceTime, pixKey, logoUrl, colorTheme, bookingMode,
      phone, address, neighborhood, city, state, zipCode,
    } = await req.json();

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      const limpo = String(name).trim();
      if (limpo.length < 2) return NextResponse.json({ error: "O nome precisa ter ao menos 2 caracteres" }, { status: 400 });
      data.name = limpo;
    }
    if (openTime !== undefined) data.openTime = openTime;
    if (closeTime !== undefined) data.closeTime = closeTime;
    if (workDays !== undefined) data.workDays = workDays;
    if (avgServiceTime !== undefined) data.avgServiceTime = parseInt(avgServiceTime);
    if (pixKey !== undefined) data.pixKey = pixKey || null;
    if (logoUrl !== undefined) data.logoUrl = logoUrl || null;
    if (colorTheme !== undefined) data.colorTheme = colorTheme;
    if (bookingMode !== undefined && ["steps", "agent"].includes(bookingMode)) data.bookingMode = bookingMode;

    // Endereço e contato — texto livre, guardado limpo ou nulo
    const texto = (v: unknown) => (String(v ?? "").trim() || null);
    if (phone !== undefined) data.phone = phone ? String(phone).replace(/\D/g, "") || null : null;
    if (address !== undefined) data.address = texto(address);
    if (neighborhood !== undefined) data.neighborhood = texto(neighborhood);
    if (city !== undefined) data.city = texto(city);
    if (state !== undefined) data.state = state ? String(state).trim().toUpperCase().slice(0, 2) : null;
    if (zipCode !== undefined) data.zipCode = zipCode ? String(zipCode).replace(/\D/g, "").slice(0, 8) || null : null;

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
        phone: true,
        address: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
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
