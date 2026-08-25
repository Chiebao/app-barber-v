import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * Situação do pagamento de um agendamento.
 *
 * A tela do cliente consulta isso enquanto ele paga: assim que o webhook do
 * Mercado Pago confirma, a tela troca sozinha para "confirmado" — sem ele
 * precisar clicar em nada.
 *
 * Exige o telefone para não expor o status de agendamento alheio.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const phone = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
    if (phone.length < 10) return NextResponse.json({ error: "Telefone obrigatório" }, { status: 400 });

    const agendamento = await prisma.appointment.findFirst({
      where: { id: params.id, client: { phone } },
      select: { status: true, pendingExpiresAt: true },
    });

    if (!agendamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    return NextResponse.json({
      status: agendamento.status,
      pago: agendamento.status === "confirmed" || agendamento.status === "completed",
      expiraEm: agendamento.pendingExpiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
