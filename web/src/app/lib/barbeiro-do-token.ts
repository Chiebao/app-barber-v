import { prisma } from "@/app/lib/prisma";

/**
 * De quem é a agenda que este token pode mexer.
 *
 * Existe porque a mesma regra estava escrita em quatro rotas, de três jeitos
 * diferentes, e dois estavam errados — do mesmo jeito:
 *
 *     const alvo = barberId || payload.userId;   // ERRADO para dono
 *
 * Para um dono, `payload.userId` é o id da tabela **Owner**, e procurá-lo na
 * tabela **Barber** nunca acha nada. O sintoma era "Barbeiro não encontrado"
 * em barbearia que tinha barbeiro — e só aparecia quando o dono NÃO escolhia
 * ninguém, que é justamente o caso da barbearia com um barbeiro só, onde o
 * seletor nem chega a ser exibido.
 *
 * A ponte entre as duas tabelas é `isOwnerProfile`, não o id.
 */
export async function barbeiroDoToken(
  payload: { userId: string; role: string; shopId: string },
  pedido?: string | null,
): Promise<string | null> {
  if (payload.role !== "owner") {
    // Barbeiro contratado só mexe na própria agenda, mesmo que mande outro id.
    const eu = await prisma.barber.findFirst({
      where: { id: payload.userId, shopId: payload.shopId },
      select: { id: true },
    });
    return eu?.id ?? null;
  }

  if (pedido) {
    const alvo = await prisma.barber.findFirst({
      where: { id: pedido, shopId: payload.shopId },
      select: { id: true },
    });
    return alvo?.id ?? null;
  }

  // Dono sem escolher: é a agenda dele mesmo.
  const meu = await prisma.barber.findFirst({
    where: { shopId: payload.shopId, isOwnerProfile: true },
    select: { id: true },
  });
  if (meu) return meu.id;

  // Barbearia antiga, criada antes de o dono virar barbeiro automaticamente:
  // cai no primeiro barbeiro ativo em vez de dizer que não existe nenhum.
  const qualquer = await prisma.barber.findFirst({
    where: { shopId: payload.shopId, active: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return qualquer?.id ?? null;
}
