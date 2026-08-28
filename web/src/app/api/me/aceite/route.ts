import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { VERSAO_TERMOS, VIGENCIA_TERMOS } from "@/app/lib/termos";

/**
 * Aceite dos termos por quem já tinha conta.
 *
 * Existe por dois motivos, e o segundo é o que importa a longo prazo:
 *
 *   1. Quem se cadastrou antes do checkbox existir nunca aceitou nada.
 *   2. Quando os termos mudam, quem aceitou a versão anterior aceitou a
 *      ANTERIOR. Alteração relevante pede aceite novo — e é este endpoint
 *      que registra, com a data e a versão vigente no dia.
 *
 * O aceite nunca é preenchido de forma retroativa em lote: um registro de
 * consentimento que foi inventado não prova nada, e contamina o valor de
 * todos os outros.
 *
 * Só o dono aceita. O barbeiro contratado usa a plataforma sob a conta da
 * barbearia — quem contratou o serviço foi o dono.
 */

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    if (payload.role !== "owner") {
      return NextResponse.json({ precisaAceitar: false, versaoVigente: VERSAO_TERMOS });
    }

    const dono = await prisma.owner.findUnique({
      where: { id: payload.userId },
      select: { termsAcceptedAt: true, termsVersion: true },
    });

    const aceitouAtual = dono?.termsVersion === VERSAO_TERMOS && !!dono?.termsAcceptedAt;

    return NextResponse.json({
      precisaAceitar: !aceitouAtual,
      versaoVigente: VERSAO_TERMOS,
      vigenciaDesde: VIGENCIA_TERMOS,
      versaoAceita: dono?.termsVersion ?? null,
      aceitoEm: dono?.termsAcceptedAt ?? null,
      // Primeira vez versus atualização — o texto da tela muda
      primeiraVez: !dono?.termsAcceptedAt,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (payload.role !== "owner") {
      return NextResponse.json({ error: "Só o dono da barbearia aceita os termos" }, { status: 401 });
    }

    const { versao } = await req.json().catch(() => ({}));
    // A tela manda a versão que exibiu. Se não bater com a vigente, o texto
    // que a pessoa leu não é o que está no ar — melhor recusar e recarregar
    // do que gravar um aceite de um documento que ela não viu.
    if (versao !== VERSAO_TERMOS) {
      return NextResponse.json(
        { error: "Os termos foram atualizados. Recarregue a página para ler a versão vigente." },
        { status: 409 },
      );
    }

    await prisma.owner.update({
      where: { id: payload.userId },
      data: { termsAcceptedAt: new Date(), termsVersion: VERSAO_TERMOS },
    });

    return NextResponse.json({ ok: true, versao: VERSAO_TERMOS });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
