/**
 * O robô comercial ligado ao banco e ao envio. A decisão em si é a função pura
 * de `lib/robo-fluxo.ts`; aqui só se busca o que ela precisa saber e se executa
 * o que ela mandou.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { desfazerParar, registrarParar } from "@/app/lib/parar";
import { decidir, type Contexto, type EstadoDaConversa, type MensagemRecebida } from "@/app/lib/robo-fluxo";
import { telefoneCanonico, variantesDoTelefone } from "@/app/lib/telefone";
import { enviarBotoes, enviarWhatsApp } from "@/app/lib/whatsapp-send";

/**
 * Respostas por número por hora, contando a resposta a cliente de barbearia.
 *
 * Contra conversa em loop com outro robô (uma resposta automática respondendo à
 * outra para sempre) e gasto à toa: acima de 1.000 por mês, as respostas são
 * pagas. Gente de verdade não chega a 20 em uma hora.
 */
export const MAX_RESPOSTAS_POR_HORA = 20;

/** O corpo da Meta para uma mensagem, só com o que usamos. */
export interface MensagemDaMeta {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
  button?: { text?: string; payload?: string };
}

function lerMensagem(msg: MensagemDaMeta): MensagemRecebida {
  const tipo = msg.type || "text";
  if (tipo === "text") return { tipo: "texto", texto: (msg.text?.body || "").slice(0, 2000) };
  // Resposta de botão. Antes de o robô existir, viraria "o cliente mandou um arquivo".
  if (tipo === "interactive" && msg.interactive?.button_reply) {
    const r = msg.interactive.button_reply;
    return { tipo: "botao", texto: r.title || "", botaoId: r.id };
  }
  if (tipo === "button" && msg.button) {
    return { tipo: "botao", texto: msg.button.text || "", botaoId: msg.button.payload };
  }
  // O que não é texto vira um aviso legível, para o barbeiro saber que existe
  // um áudio esperando e responder pelo WhatsApp dele.
  return { tipo: "midia", texto: `[${tipo}] o cliente mandou ${tipo === "audio" ? "um áudio" : "um arquivo"}` };
}

/** O cadastro mais antigo do número: é o que diz se já tinha conta antes da conversa. */
async function buscarConta(variantes: string[]): Promise<Contexto["conta"]> {
  const [dono, barbeiro] = await Promise.all([
    prisma.owner.findFirst({
      where: { phone: { in: variantes } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.barber.findFirst({
      where: { phone: { in: variantes }, active: true },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const datas = [dono?.createdAt, barbeiro?.createdAt].filter((d): d is Date => !!d);
  if (datas.length === 0) return null;
  return { criadaEm: new Date(Math.min(...datas.map((d) => d.getTime()))) };
}

/**
 * A barbearia do cliente, pelo agendamento mais próximo. Um cliente pode
 * frequentar duas; a mais provável é a do horário que está chegando.
 */
async function buscarCliente(variantes: string[]) {
  const clientes = await prisma.client.findMany({
    where: { phone: { in: variantes } },
    select: { id: true, name: true },
  });
  if (clientes.length === 0) return { nome: null, cliente: null };

  const ids = clientes.map((c) => c.id);
  const campos = {
    date: true,
    startTime: true,
    clientId: true,
    shop: { select: { id: true, name: true, phone: true, slug: true } },
  } as const;
  const agendamento =
    (await prisma.appointment.findFirst({
      where: { clientId: { in: ids }, date: { gte: new Date(Date.now() - 12 * 3600_000) }, status: { not: "cancelled" } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: campos,
    })) ||
    // Sem horário à frente, vale o último atendimento: é a barbearia dele.
    (await prisma.appointment.findFirst({
      where: { clientId: { in: ids } },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      select: campos,
    }));

  // Sem nenhum agendamento, para o robô ele é um número desconhecido.
  if (!agendamento) return { nome: clientes[0].name, cliente: null };

  return {
    nome: clientes.find((c) => c.id === agendamento.clientId)?.name ?? clientes[0].name,
    shopId: agendamento.shop.id,
    cliente: {
      barbearia: agendamento.shop,
      quando: { date: agendamento.date, startTime: agendamento.startTime },
    },
  };
}

/** Conta uma resposta. Falso = passou do limite desta hora, e não responde. */
async function podeResponder(canonico: string): Promise<boolean> {
  const chave = `robo:${canonico}`;
  const agora = new Date();
  try {
    const atual = await prisma.rateLimit.findUnique({ where: { chave } });
    const naJanela = !!atual && atual.janelaAte > agora;
    if (naJanela && atual!.tentativas >= MAX_RESPOSTAS_POR_HORA) return false;

    const janelaAte = naJanela ? atual!.janelaAte : new Date(agora.getTime() + 60 * 60_000);
    const tentativas = naJanela ? atual!.tentativas + 1 : 1;
    await prisma.rateLimit.upsert({
      where: { chave },
      create: { chave, tentativas, janelaAte },
      update: { tentativas, janelaAte },
    });
    return true;
  } catch (erro) {
    // O contador é proteção: se ele falhar, o cliente ainda recebe a resposta.
    console.error("[Robô] falha ao contar resposta:", erro);
    return true;
  }
}

async function gravarConversa(canonico: string, nome: string | null, estado: EstadoDaConversa) {
  await prisma.conversaComercial.upsert({
    where: { telefone: canonico },
    create: { telefone: canonico, nome, ...estado },
    update: { ...(nome ? { nome } : {}), ...estado },
  });
}

/** Trata uma mensagem recebida, do começo ao fim. Só responde a quem escreveu. */
export async function tratarMensagem(msg: MensagemDaMeta, nomePerfil: string | null): Promise<void> {
  const waMessageId = msg.id!;
  const telefone = msg.from!.replace(/\D/g, "");
  const canonico = telefoneCanonico(telefone);
  const variantes = variantesDoTelefone(telefone);
  const mensagem = lerMensagem(msg);

  const [pedido, conversa, conta, achado] = await Promise.all([
    prisma.pedidoParar.findUnique({ where: { telefone: canonico } }),
    prisma.conversaComercial.findUnique({ where: { telefone: canonico } }),
    buscarConta(variantes),
    buscarCliente(variantes),
  ]);

  const decisao = decidir({
    mensagem,
    agora: new Date(),
    pediuParar: !!pedido,
    conversa,
    conta,
    cliente: achado.cliente,
  });

  // Ordem 1, a trava contra resposta dobrada: a Meta reenvia o webhook quando
  // não recebe 200 rápido, e sem isto o mesmo "oi" geraria duas respostas.
  try {
    await prisma.inboundMessage.create({
      data: {
        waMessageId,
        // A conversa comercial não aparece no painel de barbearia nenhuma, nem
        // de quem já marcou horário numa delas.
        shopId: decisao.comBarbearia ? achado.shopId ?? null : null,
        clientPhone: telefone,
        clientName: achado.nome || nomePerfil,
        texto: mensagem.texto,
        tipo: msg.type || "text",
      },
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return;
    throw erro;
  }

  // PARAR vale mesmo acima do limite de respostas: o pedido é obrigação nossa.
  if (decisao.parar === "registrar") await registrarParar(telefone);
  if (decisao.parar === "desfazer") await desfazerParar(telefone);

  const temResposta = decisao.mensagens.length > 0;
  const pode = temResposta ? await podeResponder(canonico) : false;

  // Acima do limite a conversa não anda: a pessoa não recebeu a próxima etapa.
  if (decisao.conversa && (pode || decisao.parar === "registrar" || !temResposta)) {
    await gravarConversa(canonico, nomePerfil, decisao.conversa);
  }

  if (!pode) {
    if (temResposta) console.warn("[Robô] limite de respostas por hora atingido, mensagem guardada sem resposta");
    return;
  }

  // Responde para o número como a Meta mandou: o `from` é o que ela reconhece.
  for (const m of decisao.mensagens) {
    if (m.botoes?.length) await enviarBotoes(telefone, m.texto, m.botoes);
    else await enviarWhatsApp(telefone, m.texto);
  }
}
