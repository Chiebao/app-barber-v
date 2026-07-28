import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  try {
    const { notes } = await req.json();

    // Verifica que o cliente tem agendamento na shop do usuário autenticado
    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        appointments: { some: { shopId: payload.shopId } },
      },
    });

    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: { notes: notes ?? null },
      select: { id: true, notes: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE — exclusão de dados do cliente (LGPD, "direito ao esquecimento").
// Escopado à barbearia: apaga os dados desta loja; o registro global do cliente
// só é removido se ele não tiver mais nenhum agendamento em NENHUMA barbearia
// (evita apagar dados de outras barbearias que atendem o mesmo telefone).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  const payload = auth ? verifyToken(auth) : null;
  if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    // Cliente precisa ter vínculo com a barbearia do dono
    const client = await prisma.client.findFirst({
      where: { id: params.id, appointments: { some: { shopId: payload.shopId } } },
      select: { id: true, name: true, phone: true },
    });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      // Apaga tudo desta barbearia (agendamentos cascateiam serviços, comanda e avaliações)
      await tx.appointment.deleteMany({ where: { clientId: client.id, shopId: payload.shopId } });
      await tx.loyaltyCount.deleteMany({ where: { clientId: client.id, shopId: payload.shopId } });
      await tx.waitlist.deleteMany({ where: { shopId: payload.shopId, clientPhone: client.phone } });

      // Se não sobrou nada do cliente em lugar nenhum, remove o registro global
      const remaining = await tx.appointment.count({ where: { clientId: client.id } });
      let fullyDeleted = false;
      if (remaining === 0) {
        await tx.client.delete({ where: { id: client.id } });
        fullyDeleted = true;
      }
      return { fullyDeleted };
    });

    return NextResponse.json({ ok: true, name: client.name, fullyDeleted: result.fullyDeleted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
