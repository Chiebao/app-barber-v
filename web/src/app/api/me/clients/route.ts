import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const appointments = await prisma.appointment.findMany({
      where: { shopId: payload.shopId, status: { not: "cancelled" } },
      select: {
        date: true,
        clientId: true,
        client: { select: { id: true, name: true, phone: true, notes: true, noShowCount: true } },
      },
      orderBy: { date: "asc" },
    });

    // Agrupa por cliente
    const map: Record<string, {
      id: string; name: string; phone: string; notes: string | null;
      noShowCount: number; firstDate: string; totalAppointments: number;
    }> = {};

    for (const apt of appointments) {
      const c = apt.client;
      const dateStr = apt.date.toISOString().split("T")[0];
      if (!map[c.id]) {
        map[c.id] = {
          id: c.id, name: c.name, phone: c.phone, notes: c.notes,
          noShowCount: c.noShowCount, firstDate: dateStr, totalAppointments: 0,
        };
      }
      map[c.id].totalAppointments++;
      if (dateStr < map[c.id].firstDate) map[c.id].firstDate = dateStr;
    }

    const clients = Object.values(map).sort((a, b) => b.totalAppointments - a.totalAppointments);

    return NextResponse.json({ clients });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
