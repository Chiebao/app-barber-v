import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * Resumo do estado da barbearia — alimenta os cartões da engrenagem.
 *
 * Existe para que a tela de configurações mostre o VALOR de cada coisa
 * ("08:00 - 18:00", "11 serviços", "sem endereço") em vez de só o nome.
 * Fora o visual, isso é uma rede de segurança: um cartão que continua
 * mostrando o horário antigo denuncia na hora que a alteração não salvou.
 *
 * Uma chamada só — cinco requisições separadas na abertura da engrenagem
 * seria pior para quem está no 4G da barbearia.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const shopId = payload.shopId;

    const [shop, servicosAtivos, produtosAtivos, barbeiros, banidos, pushSubs] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: shopId },
        select: {
          openTime: true, closeTime: true, workDays: true,
          address: true, city: true, phone: true, logoUrl: true,
          pixKey: true, mpUserId: true, colorTheme: true,
        },
      }),
      prisma.service.count({ where: { shopId, active: true } }),
      prisma.product.count({ where: { shopId, active: true } }),
      prisma.barber.findMany({
        where: { shopId, active: true },
        select: { imageUrl: true },
      }),
      prisma.bannedClient.count({ where: { shopId } }),
      prisma.pushSubscription.count({ where: { barber: { shopId } } }),
    ]);

    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const semFoto = barbeiros.filter((b) => !b.imageUrl).length;

    return NextResponse.json({
      horario: {
        openTime: shop.openTime,
        closeTime: shop.closeTime,
        workDays: shop.workDays,
      },
      servicos: servicosAtivos,
      produtos: produtosAtivos,
      barbeiros: barbeiros.length,
      barbeirosSemFoto: semFoto,
      banidos,
      // O que ainda falta. É isso que pinta o cartão de âmbar — e some
      // sozinho quando o dono resolve, sem virar barra de progresso parada
      // em 100% para sempre.
      temEndereco: !!(shop.address || shop.city),
      temTelefone: !!shop.phone,
      temLogo: !!shop.logoUrl,
      pagamento: {
        mercadoPago: !!shop.mpUserId,
        pixManual: !!shop.pixKey,
      },
      tema: shop.colorTheme,
      notificacoes: pushSubs,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
