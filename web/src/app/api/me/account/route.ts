import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken, verifyPassword } from "@/app/lib/auth";

// DELETE /api/me/account — exclui conta do usuario (obrigatorio Apple/Google)
// Body: { password } — confirma a senha antes de excluir
export async function DELETE(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "Senha obrigatória para confirmar exclusão" }, { status: 400 });

    if (payload.role === "owner") {
      const owner = await prisma.owner.findUnique({ where: { id: payload.userId } });
      if (!owner) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

      const valid = await verifyPassword(password, owner.passwordHash);
      if (!valid) return NextResponse.json({ error: "Senha incorreta" }, { status: 400 });

      // Cascade: deleta owner → shops → barbers, services, appointments, etc.
      await prisma.owner.delete({ where: { id: payload.userId } });

      return NextResponse.json({ ok: true, message: "Conta e todos os dados associados foram excluídos permanentemente." });
    }

    // Barbeiro (nao-owner)
    const barber = await prisma.barber.findUnique({ where: { id: payload.userId } });
    if (!barber) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const valid = await verifyPassword(password, barber.passwordHash);
    if (!valid) return NextResponse.json({ error: "Senha incorreta" }, { status: 400 });

    // Desativa o barbeiro e limpa dados pessoais (soft delete para manter historico de agendamentos)
    await prisma.barber.update({
      where: { id: payload.userId },
      data: {
        active: false,
        name: "Usuário excluído",
        phone: `deleted_${Date.now()}`,
        passwordHash: "",
        pushToken: null,
      },
    });

    return NextResponse.json({ ok: true, message: "Conta excluída. Seus dados pessoais foram removidos." });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
