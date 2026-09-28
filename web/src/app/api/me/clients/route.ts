import { NextRequest, NextResponse } from "next/server";
import { chaveDaPessoa } from "@/app/lib/pessoa";
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
        clientName: true,
        status: true,
        faltaPerdoada: true,
        client: { select: { id: true, name: true, phone: true, notes: true } },
      },
      orderBy: { date: "asc" },
    });

    // Agrupa por PESSOA, nao por telefone: pai e filho dividem o numero e
    // apareciam como uma linha so, somando as faltas e os atendimentos dos
    // dois. As notas continuam do telefone — sao sobre a casa.
    const map: Record<string, {
      id: string; pessoa: string; name: string; phone: string; notes: string | null;
      noShowCount: number; firstDate: string; totalAppointments: number;
    }> = {};

    for (const apt of appointments) {
      const c = apt.client;
      const nome = apt.clientName?.trim() || c.name;
      const pessoa = chaveDaPessoa(nome);
      const chave = `${c.id}|${pessoa}`;
      const dateStr = apt.date.toISOString().split("T")[0];
      if (!map[chave]) {
        map[chave] = {
          id: c.id, pessoa, name: nome, phone: c.phone, notes: c.notes,
          noShowCount: 0, firstDate: dateStr, totalAppointments: 0,
        };
      }
      map[chave].totalAppointments++;
      // Contado do fato, nao de um contador: o antigo `Client.noShowCount`
      // era do telefone e nao dava para separar depois.
      if (apt.status === "no_show" && !apt.faltaPerdoada) map[chave].noShowCount++;
      if (dateStr < map[chave].firstDate) map[chave].firstDate = dateStr;
    }

    const clients = Object.values(map).sort((a, b) => b.totalAppointments - a.totalAppointments);

    return NextResponse.json({ clients });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
