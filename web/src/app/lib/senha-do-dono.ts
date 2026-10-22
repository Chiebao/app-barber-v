import { prisma } from "@/app/lib/prisma";

/**
 * O dono existe em DOIS lugares: a conta de dono (`Owner`) e o perfil de
 * barbeiro dele (`Barber` com `isOwnerProfile`), que é o que tem agenda.
 * Os dois têm o mesmo telefone.
 *
 * As trocas de senha gravavam só a conta de dono. O perfil ficava com a
 * senha ANTIGA — e quem entrava com ela caía no login de barbeiro: o painel
 * escondia endereço, produtos e despesas, e o Financeiro (só do dono)
 * quebrava. Foi o que aconteceu ao reinstalar o app na tela de início.
 *
 * Toda troca de senha de um dos dois passa por aqui e grava nos dois.
 */
export async function gravarSenhaDoDono(
  quem: { ownerId: string } | { barberId: string },
  passwordHash: string,
  extra: { recoveryCodeHash?: null } = {},
): Promise<void> {
  let ownerId: string | null = null;
  if ("ownerId" in quem) {
    ownerId = quem.ownerId;
  } else {
    const b = await prisma.barber.findUnique({
      where: { id: quem.barberId },
      select: { isOwnerProfile: true, shop: { select: { ownerId: true } } },
    });
    if (!b?.isOwnerProfile) {
      // Barbeiro contratado: só ele.
      await prisma.barber.update({ where: { id: quem.barberId }, data: { passwordHash, ...extra } });
      return;
    }
    ownerId = b.shop.ownerId;
  }

  await prisma.$transaction([
    prisma.owner.update({ where: { id: ownerId }, data: { passwordHash, ...extra } }),
    prisma.barber.updateMany({
      where: { isOwnerProfile: true, shop: { ownerId } },
      data: { passwordHash },
    }),
  ]);
}
