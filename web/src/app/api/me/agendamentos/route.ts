import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import { occupiesSlotWhere, appointmentStartUtc } from "@/app/lib/pending-deadline";
import { bloqueiosDoDia, invadeBloqueio, emMinutos, emTexto } from "@/app/lib/bloqueios";
import { expedienteDoDia } from "@/app/lib/expediente";
import { num, sumMoney } from "@/app/lib/money";
import { enviarModelo } from "@/app/lib/whatsapp-send";
import { horariosLivres } from "@/app/lib/horarios-livres";
import { barbeiroDoToken } from "@/app/lib/barbeiro-do-token";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Agendamento criado pelo barbeiro, no balcão.
 *
 * Rota separada da pública de propósito. A pública carrega regras que existem
 * para desconhecido na internet — pré-pagamento por Pix depois de duas faltas,
 * aviso ao barbeiro, contagem de conversão — e nenhuma delas faz sentido com o
 * cliente parado na frente dele. Exigir Pix de quem já está na cadeira seria
 * absurdo, e o aviso de "novo agendamento" avisaria o barbeiro do que ele
 * acabou de digitar.
 *
 * Misturar as duas com um sinalizador na rota pública seria pior: um endpoint
 * público que muda de regra conforme um campo do corpo é exatamente onde
 * buracos de autorização nascem.
 *
 * O que NÃO muda: conflito de horário e bloqueio continuam valendo, na mesma
 * transação Serializable. O barbeiro pode furar a fila, não a física.
 */

/** A mesma janela do cron de lembretes — mudar lá sem mudar aqui abre um vão. */
const HORAS_DO_LEMBRETE = Number(process.env.REMINDER_HOURS_BEFORE || 2);

const schema = z.object({
  clientName: z.string().trim().min(2, "Nome muito curto").max(80),
  clientPhone: z.string().trim().min(8, "Telefone inválido"),
  serviceIds: z.array(z.string()).min(1, "Escolha ao menos um serviço"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  barberId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const data = schema.parse(await req.json());

    const shop = await prisma.shop.findUnique({ where: { id: payload.shopId } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Barbeiro contratado só agenda para si; o dono escolhe.
    const barberId = await barbeiroDoToken(payload, data.barberId);
    if (!barberId) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    const services = await prisma.service.findMany({
      where: { id: { in: data.serviceIds }, shopId: shop.id },
    });
    if (services.length !== data.serviceIds.length) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 400 });
    }

    const totalDuration = services.reduce((s, x) => s + x.duration, 0);
    const totalPrice = sumMoney(services.map((s) => s.price));

    const inicio = emMinutos(data.startTime);
    if (!Number.isFinite(inicio)) {
      return NextResponse.json({ error: "Horário inválido" }, { status: 400 });
    }
    const endTime = emTexto(inicio + totalDuration);

    // Telefone sempre só dígitos: é assim que o cliente é encontrado em todo
    // o resto do app, e um formato divergente cria um cliente duplicado.
    const phone = data.clientPhone.replace(/\D/g, "");
    // NAO atualiza o nome: `Client` e global e a chave e o telefone, entao
    // pai e filho que usam o mesmo numero sao a MESMA linha. Renomear aqui
    // reescrevia o nome no agendamento do outro — e em todas as lojas.
    // O nome desta marcacao fica congelado no proprio agendamento.
    const client = await prisma.client.upsert({
      where: { phone },
      create: { name: data.clientName.trim(), phone },
      update: {},
    });

    const dateObj = new Date(data.date + "T00:00:00.000Z");

    try {
      const agendamento = await prisma.$transaction(
        async (tx) => {
          const conflitos = await tx.appointment.findMany({
            where: {
              barberId,
              date: { gte: new Date(data.date + "T00:00:00.000Z"), lte: new Date(data.date + "T23:59:59.999Z") },
              ...occupiesSlotWhere(),
            },
            select: { startTime: true, endTime: true },
          });
          if (conflitos.some((a) => data.startTime < a.endTime && endTime > a.startTime)) {
            throw new Error("SLOT_CONFLICT");
          }

          const bloq = await bloqueiosDoDia(tx, barberId, data.date, shop.slotInterval);
          if (bloq.diaTodo) throw new Error("SLOT_BLOCKED");
          const exp = await expedienteDoDia(tx, shop, data.date);
          if (!exp.aberto) throw new Error("SLOT_BLOCKED");
          if (invadeBloqueio(data.startTime, endTime, [...bloq.intervalos, ...exp.pausas])) {
            throw new Error("SLOT_BLOCKED");
          }

          return tx.appointment.create({
            data: {
              shopId: shop.id,
              barberId,
              clientId: client.id,
              // Congelado aqui: o `Client` e compartilhado por telefone, e
              // quem marcar depois com o mesmo numero nao muda este nome.
              clientName: data.clientName.trim(),
              date: dateObj,
              startTime: data.startTime,
              endTime,
              totalDuration,
              totalPrice,
              status: "confirmed",
              services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
            },
            include: { services: { include: { service: true } } },
          });
        },
        { isolationLevel: "Serializable" },
      );

      // Quando o corte é DEPOIS da janela do lembrete, não fazemos nada: o
      // cron avisa sozinho, como faz com quem agendou pelo link.
      //
      // Perto demais, o cron chegaria atrasado ou chamaria de "lembrete"
      // algo que o cliente talvez nem saiba que existe. Aí avisamos na hora
      // e carimbamos reminderSentAt, senão ele recebe duas mensagens.
      const comeca = appointmentStartUtc(dateObj, agendamento.startTime);
      const faltam = (comeca.getTime() - Date.now()) / 60000;
      let avisado = false;
      if (faltam > 0 && faltam <= HORAS_DO_LEMBRETE * 60) {
        const quando = format(dateObj, "dd 'de' MMMM", { locale: ptBR });
        const vars = [
          client.name.split(" ")[0],
          shop.name,
          quando,
          agendamento.startTime,
        ];
        // Se o modelo novo ainda não passou pela aprovação da Meta, o
        // lembrete aprovado serve: melhor a palavra errada que o silêncio.
        avisado =
          (await enviarModelo(client.phone, "agendamento_marcado", vars)) ||
          (await enviarModelo(client.phone, "lembrete_agendamento", [
            vars[0], shop.name, agendamento.startTime, services.map((s) => s.name).join(", "),
          ]));
        if (avisado) {
          await prisma.appointment.update({
            where: { id: agendamento.id },
            data: { reminderSentAt: new Date() },
          });
        }
      }

      return NextResponse.json({
        agendamento: {
          id: agendamento.id,
          date: data.date,
          startTime: agendamento.startTime,
          endTime: agendamento.endTime,
          totalPrice: num(agendamento.totalPrice),
          cliente: client.name,
          avisado,
        },
      });
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : "";
      if (msg === "SLOT_BLOCKED") {
        return NextResponse.json({ error: "Esse horário está bloqueado na sua agenda" }, { status: 409 });
      }
      if (
        msg === "SLOT_CONFLICT" ||
        msg.includes("could not serialize") ||
        (erro as { code?: string })?.code === "P2034"
      ) {
        return NextResponse.json({ error: "Já existe atendimento nesse horário" }, { status: 409 });
      }
      throw erro;
    }
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/**
 * Horários livres para o painel montar os botões.
 *
 * Mesma conta que o cliente vê, pela mesma função — inclusive o encaixe.
 * O barbeiro escolhe tocando num horário que existe, em vez de rolar um
 * seletor de relógio até achar um que talvez esteja ocupado.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const date = sp.get("date");
    const duration = Number(sp.get("duration") || 0);
    if (!date || !duration) {
      return NextResponse.json({ error: "date e duration obrigatórios" }, { status: 400 });
    }

    const shop = await prisma.shop.findUnique({ where: { id: payload.shopId } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Barbeiro contratado só vê a própria agenda, como no resto do painel.
    const barberId = await barbeiroDoToken(payload, sp.get("barberId"));

    const { slots, motivo } = await horariosLivres(prisma, {
      shop, date, duration, barberId,
    });

    return NextResponse.json({ slots, motivo: motivo ?? null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
