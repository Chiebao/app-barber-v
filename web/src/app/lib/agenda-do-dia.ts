import { prisma } from "@/app/lib/prisma";
import { enviarModelo } from "@/app/lib/whatsapp-send";
import { agoraNaBarbearia } from "@/app/lib/time-slots";

/**
 * O resumo da agenda no WhatsApp do barbeiro, de manhã.
 *
 * A rede de segurança de fora do sistema: se às 10h de sábado a internet da
 * barbearia (ou a Vercel, ou o Supabase) estiver fora, a lista de quem vem
 * hoje já está no celular dele, num aplicativo que não é o nosso.
 *
 * O cache do painel cobre o caso comum; isto cobre o caso em que o aparelho
 * dele é outro, ou o navegador limpou os dados, ou ele nunca abriu o painel
 * hoje. São camadas diferentes de propósito.
 */

/** Um dia inteiro em UTC — a mesma janela explícita do resto do sistema. */
function janelaDoDia(diaISO: string) {
  return {
    gte: new Date(diaISO + "T00:00:00.000Z"),
    lte: new Date(diaISO + "T23:59:59.999Z"),
  };
}

/**
 * A lista numa linha só.
 *
 * A Meta REJEITA parâmetro de modelo com quebra de linha, então " · " é o que
 * resta. Longo demais também é recusado, por isso o corte com "e mais N".
 */
export function resumirAgenda(
  itens: Array<{ startTime: string; cliente: string; servicos: string[] }>,
  limiteChars = 700,
): string {
  const partes = itens.map(
    (a) => `${a.startTime} ${a.cliente}${a.servicos.length ? ` (${a.servicos.join(" + ")})` : ""}`,
  );

  const texto: string[] = [];
  let tamanho = 0;
  for (let i = 0; i < partes.length; i++) {
    const custo = partes[i].length + 3;
    // Só corta se ainda sobrar gente — cortar no último não economiza nada.
    if (tamanho + custo > limiteChars && i < partes.length) {
      texto.push(`e mais ${partes.length - i}`);
      break;
    }
    texto.push(partes[i]);
    tamanho += custo;
  }
  return texto.join(" · ");
}

export interface ResultadoAgenda {
  enviados: number;
  semAgenda: number;
  falhas: number;
  /** Bateu fora da janela da manhã e nada foi mandado. */
  foraDaJanela: boolean;
}

/**
 * Só de manhã.
 *
 * O cron da Vercel roda uma vez por dia, mas o agendador externo bate de
 * hora em hora — sem esta janela o barbeiro recebe a agenda às 3 da manhã,
 * que é quando o despertador dele não devia tocar por nossa causa.
 */
const JANELA = { de: "06:00", ate: "10:00" };

/**
 * Manda para cada barbeiro ativo a agenda DELE de hoje.
 *
 * Cada barbeiro recebe só a própria lista: é o que ele usa, e mandar a da
 * barbearia inteira para todo mundo entregaria a agenda dos colegas.
 */
export async function enviarAgendaDoDia(agora = new Date()): Promise<ResultadoAgenda> {
  const fora: ResultadoAgenda = { enviados: 0, semAgenda: 0, falhas: 0, foraDaJanela: false };

  // O dia e a hora são os da barbearia, não os do servidor.
  const { dia: hoje, hora } = agoraNaBarbearia(agora);
  if (hora < JANELA.de || hora > JANELA.ate) {
    fora.foraDaJanela = true;
    return fora;
  }

  const barbeiros = await prisma.barber.findMany({
    where: { active: true },
    select: {
      id: true, name: true, phone: true, agendaEnviadaEm: true,
      shop: { select: { id: true, name: true } },
    },
  });

  for (const b of barbeiros) {
    if (!b.phone) continue;

    // Já mandou hoje? O cron da Vercel roda 1x/dia mas o externo bate mais
    // vezes, e cada cópia é uma mensagem paga.
    if (b.agendaEnviadaEm && b.agendaEnviadaEm.toISOString().slice(0, 10) === hoje) continue;

    const agenda = await prisma.appointment.findMany({
      where: {
        barberId: b.id,
        date: janelaDoDia(hoje),
        status: { in: ["confirmed", "completed"] },
      },
      orderBy: { startTime: "asc" },
      select: {
        startTime: true,
        client: { select: { name: true } },
        services: { select: { service: { select: { name: true } } } },
      },
    });

    // Dia vazio não vale uma mensagem paga: não há agenda para proteger.
    if (agenda.length === 0) { fora.semAgenda++; continue; }

    const lista = resumirAgenda(
      agenda.map((a) => ({
        startTime: a.startTime,
        cliente: a.client?.name ?? "Cliente",
        servicos: a.services.map((s) => s.service.name),
      })),
    );

    const ok = await enviarModelo(b.phone, "agenda_do_dia", [
      b.name.split(" ")[0],
      b.shop.name,
      lista,
    ]);

    if (ok) {
      // Só marca quando a Meta confirmou. Marcar antes faria uma falha de
      // envio virar silêncio permanente até o dia seguinte.
      await prisma.barber.update({
        where: { id: b.id },
        data: { agendaEnviadaEm: new Date() },
      });
      fora.enviados++;
    } else {
      fora.falhas++;
    }
  }

  return fora;
}
