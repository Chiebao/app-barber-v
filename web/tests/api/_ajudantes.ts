import { PrismaClient } from "@prisma/client";
import type { APIRequestContext } from "@playwright/test";

/**
 * Apoio para os testes de regra de negócio.
 *
 * Cada teste cria a PRÓPRIA barbearia descartável e a apaga no fim. Isso
 * custa alguns segundos e evita o problema clássico de suíte compartilhada:
 * um teste que deixa lixo faz o próximo falhar por motivo errado, e aí
 * ninguém confia mais no vermelho.
 *
 * Prisma entra só onde a API não alcança — criar atendimento no passado,
 * envelhecer uma assinatura. Tudo que dá para fazer pela API é feito pela
 * API, porque é assim que o app roda de verdade.
 */

export const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

let _prisma: PrismaClient | null = null;
export function db(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

export async function fecharDb() {
  if (_prisma) { await _prisma.$disconnect(); _prisma = null; }
}

/** Telefone único por execução — dois testes em paralelo não colidem. */
export function telefoneDeTeste(): string {
  const n = String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 90) + 10);
  return "11" + n.slice(-9);
}

export interface Loja {
  shopId: string;
  slug: string;
  ownerId: string;
  token: string;
  telefone: string;
  senha: string;
  auth: Record<string, string>;
  servicoId: string;
  barbeiroDonoId: string;
}

/** Cria uma barbearia completa pela API pública de cadastro. */
export async function criarLoja(
  req: APIRequestContext,
  opcoes: { abre?: string; fecha?: string; dias?: number[] } = {},
): Promise<Loja> {
  const telefone = telefoneDeTeste();
  const senha = "teste123456";

  const res = await req.post(`${BASE}/api/auth/register`, {
    data: {
      ownerName: "Dono Teste",
      shopName: "Teste " + Date.now() + Math.floor(Math.random() * 1000),
      phone: telefone,
      password: senha,
      openTime: opcoes.abre ?? "08:00",
      closeTime: opcoes.fecha ?? "20:00",
      workDays: opcoes.dias ?? [0, 1, 2, 3, 4, 5, 6],
      avgServiceTime: 30,
      aceitouTermos: true,
      services: [{ name: "Corte", duration: 30, price: 40, category: "corte" }],
    },
  });

  if (!res.ok()) throw new Error("cadastro falhou: " + res.status() + " " + (await res.text()).slice(0, 200));
  const d = await res.json();

  const p = db();
  const servico = await p.service.findFirstOrThrow({ where: { shopId: d.shop.id } });
  const dono = await p.barber.findFirstOrThrow({ where: { shopId: d.shop.id, isOwnerProfile: true } });

  return {
    shopId: d.shop.id,
    slug: d.shop.slug,
    ownerId: d.user?.id ?? "",
    token: d.token,
    telefone,
    senha,
    auth: { "Content-Type": "application/json", Authorization: `Bearer ${d.token}` },
    servicoId: servico.id,
    barbeiroDonoId: dono.id,
  };
}

/** Apaga a barbearia e tudo pendurado nela. Seguro de chamar duas vezes. */
export async function apagarLoja(loja: Loja | null) {
  if (!loja) return;
  const p = db();
  const shopId = loja.shopId;

  const existe = await p.shop.findUnique({ where: { id: shopId }, select: { ownerId: true } });
  if (!existe) return;

  const ids = (await p.appointment.findMany({ where: { shopId }, select: { id: true } })).map((a) => a.id);
  await p.comandaItem.deleteMany({ where: { appointmentId: { in: ids } } });
  await p.appointmentService.deleteMany({ where: { appointmentId: { in: ids } } });
  await p.rating.deleteMany({ where: { shopId } });
  await p.appointment.deleteMany({ where: { shopId } });
  await p.loyaltyCount.deleteMany({ where: { shopId } });
  await p.shopEvent.deleteMany({ where: { shopId } });
  await p.blockedSlot.deleteMany({ where: { shopId } });
  await p.waitlist.deleteMany({ where: { shopId } });
  await p.bannedClient.deleteMany({ where: { shopId } });
  await p.product.deleteMany({ where: { shopId } });
  await p.service.deleteMany({ where: { shopId } });
  await p.subscriptionInvoice.deleteMany({ where: { subscription: { shopId } } });
  await p.subscription.deleteMany({ where: { shopId } });
  await p.pushSubscription.deleteMany({ where: { barber: { shopId } } });
  await p.barber.deleteMany({ where: { shopId } });
  await p.shop.delete({ where: { id: shopId } });
  await p.owner.delete({ where: { id: existe.ownerId } });
}

/** Apaga clientes criados pelo teste (a tabela Client é global). */
export async function apagarClientes(telefones: string[]) {
  if (telefones.length === 0) return;
  const p = db();
  await p.appointmentService.deleteMany({ where: { appointment: { client: { phone: { in: telefones } } } } });
  await p.comandaItem.deleteMany({ where: { appointment: { client: { phone: { in: telefones } } } } });
  await p.appointment.deleteMany({ where: { client: { phone: { in: telefones } } } });
  await p.client.deleteMany({ where: { phone: { in: telefones } } });
}

/** Data ISO (YYYY-MM-DD) a N dias de hoje, no fuso local. */
export function diaISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Cria um atendimento direto no banco.
 *
 * A API não deixa agendar no passado — e é isso que a gente precisa para
 * testar dívida antiga e fechamento de mês.
 */
export async function semearAtendimento(loja: Loja, opcoes: {
  clienteNome: string;
  clienteTelefone: string;
  diasAtras: number;
  preco: number;
  pago?: boolean | string;
  prometidoEmDias?: number;
  barbeiroId?: string;
  status?: string;
}) {
  const p = db();
  const cliente = await p.client.upsert({
    where: { phone: opcoes.clienteTelefone },
    create: { name: opcoes.clienteNome, phone: opcoes.clienteTelefone },
    update: { name: opcoes.clienteNome },
  });

  const metodo = typeof opcoes.pago === "string" ? opcoes.pago : opcoes.pago ? "pix" : null;
  const prometido = opcoes.prometidoEmDias !== undefined
    ? new Date(Date.now() + opcoes.prometidoEmDias * 86_400_000)
    : null;

  const apt = await p.appointment.create({
    data: {
      shopId: loja.shopId,
      barberId: opcoes.barbeiroId ?? loja.barbeiroDonoId,
      clientId: cliente.id,
      date: new Date(diaISO(-opcoes.diasAtras) + "T00:00:00Z"),
      startTime: "10:00",
      endTime: "10:30",
      totalDuration: 30,
      totalPrice: opcoes.preco,
      status: opcoes.status ?? (metodo ? "completed" : "confirmed"),
      paymentMethod: metodo ?? (prometido ? "adiado" : null),
      paidAt: metodo ? new Date() : null,
      deferredPaymentDate: prometido,
    },
  });

  await p.appointmentService.create({ data: { appointmentId: apt.id, serviceId: loja.servicoId } });
  return apt;
}

/** Move a assinatura no tempo, para testar vencimento sem esperar 14 dias. */
export async function envelhecerAssinatura(loja: Loja, campos: {
  trialEndsAt?: Date | null;
  periodoFim?: Date;
  status?: string;
  canceladaEm?: Date | null;
}) {
  await db().subscription.update({ where: { shopId: loja.shopId }, data: campos });
}

export const emDias = (n: number) => new Date(Date.now() + n * 86_400_000);
