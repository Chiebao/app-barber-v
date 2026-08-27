import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num } from "@/app/lib/money";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";

// GET — lista serviços da barbearia
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const services = await prisma.service.findMany({
      where: { shopId: payload.shopId },
      orderBy: { category: "asc" },
    });
    // price é Decimal no banco — devolve como número puro para o cliente
    return NextResponse.json({ services: services.map(s => ({ ...s, price: num(s.price) })) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST — cria serviço
export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { name, duration, price, category, imageUrl } = await req.json();
    if (!name || !duration || !price || !category) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }
    const service = await prisma.service.create({
      data: { shopId: payload.shopId, name, duration: Number(duration), price: Number(price), category, imageUrl: imageUrl || null },
    });
    return NextResponse.json({ service: { ...service, price: num(service.price) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH — atualiza serviço (nome, preço, duração, foto, ativo)
export async function PATCH(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { id, name, duration, price, category, imageUrl, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const existing = await prisma.service.findFirst({ where: { id, shopId: payload.shopId } });
    if (!existing) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(price !== undefined && { price: Number(price) }),
        ...(category !== undefined && { category }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json({ service: { ...service, price: num(service.price) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE — remove serviço de vez
//
// Um serviço que já apareceu num atendimento NÃO pode ser apagado: a relação
// appointment_services tem onDelete: Cascade, então apagar o serviço levaria
// junto as linhas dos agendamentos antigos — o histórico ficaria com um
// atendimento de R$ 70 e nenhum serviço dentro, e o financeiro não fecharia.
//
// Nesse caso devolvemos 409 explicando, e o painel oferece desativar: o
// serviço some da tela de agendamento do cliente e o histórico continua certo.
export async function DELETE(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    // Escopo pela loja do token — ninguém apaga serviço de outra barbearia
    const existing = await prisma.service.findFirst({ where: { id, shopId: payload.shopId } });
    if (!existing) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

    const usos = await prisma.appointmentService.count({ where: { serviceId: id } });
    if (usos > 0) {
      return NextResponse.json(
        {
          error: "Este serviço já foi usado em atendimentos e não pode ser apagado sem quebrar o histórico.",
          usos,
          podeDesativar: true,
        },
        { status: 409 },
      );
    }

    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
