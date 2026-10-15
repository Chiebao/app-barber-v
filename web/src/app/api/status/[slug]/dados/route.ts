import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { horariosLivres } from "@/app/lib/horarios-livres";
import { agoraNaBarbearia } from "@/app/lib/time-slots";

/**
 * O que vai na imagem do Status de hoje: nome, logo, tema e os horários
 * LIVRES (a mesma conta da página de agendamento). A imagem em si é feita
 * em `../route.tsx`, no Edge, que não fala com o banco.
 *
 * Dia cheio devolve os de AMANHÃ — "hoje lotou" também é anúncio.
 */
export const dynamic = "force-dynamic";

function somaDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { slug: params.slug },
      select: {
        id: true, name: true, slug: true, logoUrl: true, colorTheme: true,
        openTime: true, closeTime: true, workDays: true, slotInterval: true, avgServiceTime: true,
        barbers: { where: { active: true }, select: { id: true } },
      },
    });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const hoje = agoraNaBarbearia().dia;
    const duracao = shop.avgServiceTime || 30;

    // Livre com QUALQUER barbeiro da casa: é a pergunta de quem vê o status.
    const livresNoDia = async (dia: string) => {
      const todos = new Set<string>();
      for (const b of shop.barbers) {
        const { slots } = await horariosLivres(prisma, { shop, date: dia, duration: duracao, barberId: b.id });
        slots.forEach((s) => todos.add(s));
      }
      return [...todos].sort();
    };

    let dia = hoje;
    let livres = await livresNoDia(hoje);
    let amanha = false;
    if (livres.length === 0) {
      dia = somaDias(hoje, 1);
      livres = await livresNoDia(dia);
      amanha = true;
    }

    return NextResponse.json(
      { nome: shop.name, slug: shop.slug, logoUrl: shop.logoUrl, tema: shop.colorTheme, hoje, dia, amanha, livres },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[status/dados] erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
