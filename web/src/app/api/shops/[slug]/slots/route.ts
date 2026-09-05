import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { dentroDaJanela, motivoForaDaJanela } from "@/app/lib/janela-agenda";
import { horariosLivres } from "@/app/lib/horarios-livres";

/**
 * Horários que o cliente vê.
 *
 * A conta mora em `lib/horarios-livres.ts`, compartilhada com o painel: os
 * horários oferecidos ao barbeiro quando ele marca no balcão precisam ser
 * exatamente os mesmos que o cliente veria.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const duration = searchParams.get("duration");
    const barberId = searchParams.get("barberId");

    if (!date || !duration) return NextResponse.json({ error: "date e duration obrigatorios" }, { status: 400 });

    const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Fora da janela que o dono abriu não existe horário nenhum. Vale
    // barrar aqui e não só na lista de datas: quem chama a API direto
    // nunca viu lista.
    if (!dentroDaJanela(shop.diasAbertos, date)) {
      return NextResponse.json({ slots: [], message: motivoForaDaJanela(shop.diasAbertos) });
    }

    const { slots, motivo } = await horariosLivres(prisma, {
      shop,
      date,
      duration: parseInt(duration),
      barberId,
    });

    return NextResponse.json(motivo ? { slots, message: motivo } : { slots });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
