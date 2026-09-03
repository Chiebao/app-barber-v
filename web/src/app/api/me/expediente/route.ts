import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import { emMinutos } from "@/app/lib/bloqueios";

/**
 * Horário de trabalho, um por dia da semana.
 *
 * É da barbearia, não do barbeiro — decisão do dono. Barbeiro com horário
 * próprio continua no bloqueio recorrente, que já existe e resolve.
 */

const HORA = /^\d{2}:\d{2}$/;

const diaSchema = z.object({
  dia: z.number().int().min(0).max(6),
  aberto: z.boolean(),
  abre: z.string().regex(HORA, "Horário inválido"),
  fecha: z.string().regex(HORA, "Horário inválido"),
  almocoInicio: z.string().regex(HORA).nullable().optional(),
  almocoFim: z.string().regex(HORA).nullable().optional(),
});

const corpoSchema = z.object({ dias: z.array(diaSchema).min(1).max(7) });

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const shop = await prisma.shop.findUnique({
      where: { id: payload.shopId },
      select: { openTime: true, closeTime: true, workDays: true },
    });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const linhas = await prisma.workDay.findMany({
      where: { shopId: payload.shopId },
      orderBy: { dia: "asc" },
    });

    // Barbearia que nunca configurou recebe a semana derivada do horário único
    // que ela já usava. Assim a tela abre preenchida em vez de vazia, e o dono
    // ajusta só o dia que é diferente.
    const dias = Array.from({ length: 7 }, (_, dia) => {
      const l = linhas.find((x) => x.dia === dia);
      if (l) {
        return {
          dia,
          aberto: l.aberto,
          abre: l.abre,
          fecha: l.fecha,
          almocoInicio: l.almocoInicio,
          almocoFim: l.almocoFim,
        };
      }
      return {
        dia,
        aberto: shop.workDays.includes(dia),
        abre: shop.openTime,
        fecha: shop.closeTime,
        almocoInicio: null,
        almocoFim: null,
      };
    });

    return NextResponse.json({ dias, configurado: linhas.length > 0 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req, { apenasDono: true });
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const { dias } = corpoSchema.parse(await req.json());

    for (const d of dias) {
      if (!d.aberto) continue;
      if (emMinutos(d.fecha) <= emMinutos(d.abre)) {
        return NextResponse.json(
          { error: "O fechamento precisa ser depois da abertura" },
          { status: 400 },
        );
      }
      const i = d.almocoInicio;
      const f = d.almocoFim;
      // Meio preenchido é dado pela metade — ou os dois, ou nenhum.
      if ((i && !f) || (!i && f)) {
        return NextResponse.json(
          { error: "Informe o começo e o fim do almoço, ou deixe os dois vazios" },
          { status: 400 },
        );
      }
      if (i && f) {
        if (emMinutos(f) <= emMinutos(i)) {
          return NextResponse.json({ error: "O almoço precisa terminar depois de começar" }, { status: 400 });
        }
        if (emMinutos(i) < emMinutos(d.abre) || emMinutos(f) > emMinutos(d.fecha)) {
          return NextResponse.json(
            { error: "O almoço precisa estar dentro do horário de trabalho" },
            { status: 400 },
          );
        }
      }
    }

    await prisma.$transaction(
      dias.map((d) =>
        prisma.workDay.upsert({
          where: { shopId_dia: { shopId: payload.shopId, dia: d.dia } },
          create: {
            shopId: payload.shopId,
            dia: d.dia,
            aberto: d.aberto,
            abre: d.abre,
            fecha: d.fecha,
            almocoInicio: d.almocoInicio || null,
            almocoFim: d.almocoFim || null,
          },
          update: {
            aberto: d.aberto,
            abre: d.abre,
            fecha: d.fecha,
            almocoInicio: d.almocoInicio || null,
            almocoFim: d.almocoFim || null,
          },
        }),
      ),
    );

    // `workDays` continua sendo a verdade para quem ainda não olha o
    // expediente — a página pública, o cron, o app mobile. Mantê-lo alinhado
    // evita que a barbearia apareça aberta num dia que ela fechou aqui.
    const abertos = dias.filter((d) => d.aberto).map((d) => d.dia);
    await prisma.shop.update({
      where: { id: payload.shopId },
      data: { workDays: abertos },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
