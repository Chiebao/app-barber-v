import { prisma } from "@/app/lib/prisma";
import { agoraNaBarbearia } from "@/app/lib/time-slots";

/**
 * Cortes que se repetem toda semana.
 *
 * O barbeiro cria UMA regra ("toda terça às 10h, até 31/12") e o sistema
 * transforma cada ocorrência num agendamento normal quando aquele dia entra no
 * horizonte da agenda.
 *
 * POR QUE MATERIALIZAR, e não manter a ocorrência virtual: pagamento, falta,
 * comanda, avaliação e fidelidade se penduram num `Appointment` de verdade.
 * Uma ocorrência virtual obrigaria cada uma dessas funcionalidades a entender
 * um segundo formato, e a primeira que esquecesse quebraria calada.
 *
 * POR QUE NÃO CRIAR TUDO DE UMA VEZ: um corte semanal por um ano são 52 linhas
 * criadas hoje para um compromisso que pode acabar em março. A materialização
 * é preguiçosa — só nasce a ocorrência do dia que a agenda realmente pediu.
 */

/** Soma minutos a um "HH:mm" e devolve outro "HH:mm". */
function somaMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + minutos;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "YYYY-MM-DD" de um Date, lendo os campos em UTC (as datas ficam em meio-dia UTC). */
function diaISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * O dia é guardado como meio-dia UTC.
 *
 * Meio-dia e não meia-noite: com meia-noite, qualquer conversão de fuso para
 * oeste joga a data para o dia anterior. No meio do dia sobram 12 horas de
 * folga para cada lado, e o dia continua sendo o mesmo em qualquer fuso do
 * Brasil.
 */
export function dataDoDia(dia: string): Date {
  return new Date(`${dia}T12:00:00.000Z`);
}

/**
 * Datas em que a regra cai dentro do intervalo pedido.
 *
 * Função PURA — é a regra de negócio da recorrência, e é aqui que ela se
 * testa sem banco.
 *
 * @param weekday   0 = domingo ... 6 = sábado
 * @param inicio    primeiro dia válido da regra (YYYY-MM-DD)
 * @param fim       último dia válido da regra (YYYY-MM-DD)
 * @param de        início da janela consultada (YYYY-MM-DD)
 * @param ate       fim da janela consultada (YYYY-MM-DD)
 * @param diasUteis dias em que a barbearia abre; a regra não cai fora deles
 */
export function ocorrenciasNoIntervalo(
  weekday: number,
  inicio: string,
  fim: string,
  de: string,
  ate: string,
  diasUteis: number[],
): string[] {
  // A janela é a interseção entre a vigência da regra e o período consultado.
  const comeco = inicio > de ? inicio : de;
  const termino = fim < ate ? fim : ate;
  if (comeco > termino) return [];
  if (!diasUteis.includes(weekday)) return [];

  const dias: string[] = [];
  const cursor = dataDoDia(comeco);
  const limite = dataDoDia(termino);

  // Anda até o primeiro dia da semana pedido, depois salta de sete em sete.
  while (cursor.getUTCDay() !== weekday && cursor <= limite) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  while (cursor <= limite) {
    dias.push(diaISO(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dias;
}

/**
 * Cria os agendamentos que faltam para as regras ativas da barbearia.
 *
 * Chamada antes de qualquer leitura de agenda ou de horários livres — é o que
 * faz o corte recorrente aparecer para o barbeiro e sumir da lista do cliente
 * sem que nenhuma dessas telas saiba o que é recorrência.
 *
 * NUNCA materializa no passado: uma regra criada hoje não inventa históricos.
 *
 * NUNCA atropela um horário ocupado: se o cliente já pegou aquele horário, a
 * ocorrência daquela semana simplesmente não nasce. Perder uma semana do
 * recorrente é chato; marcar dois cortes na mesma cadeira é pior.
 *
 * É IDEMPOTENTE: a trava `@@unique([recurringId, date])` garante que ler a
 * agenda duas vezes não duplica nada.
 *
 * @returns quantas ocorrências foram criadas.
 */
export async function materializarRecorrentes(
  shopId: string,
  de: string,
  ate: string,
): Promise<number> {
  try {
    return await criarOcorrencias(shopId, de, ate);
  } catch (erro) {
    // Corte fixo é um ACRÉSCIMO à agenda; não pode derrubá-la.
    //
    // Esta função é chamada de dentro da rota de horários livres e da agenda do
    // barbeiro — os dois caminhos mais quentes do sistema. Se ela deixar a
    // exceção subir, um problema aqui vira "nenhum horário disponível" para
    // TODOS os clientes.
    //
    // O caso concreto que motivou a guarda: o deploy chega ao ar antes de
    // `prisma db push` criar a tabela `recurring_appointments`. Sem isto, essa
    // janela de minutos derrubaria o agendamento inteiro.
    console.error("Falha ao materializar cortes fixos:", erro);
    return 0;
  }
}

async function criarOcorrencias(
  shopId: string,
  de: string,
  ate: string,
): Promise<number> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { workDays: true },
  });
  if (!shop) return 0;

  // O horizonte começa hoje: regra nova não gera corte que já passou.
  const { dia: hoje } = agoraNaBarbearia();
  const inicioJanela = de > hoje ? de : hoje;
  if (inicioJanela > ate) return 0;

  const regras = await prisma.recurringAppointment.findMany({
    where: {
      shopId,
      active: true,
      startDate: { lte: dataDoDia(ate) },
      endDate: { gte: dataDoDia(inicioJanela) },
    },
    include: { services: true },
  });
  if (regras.length === 0) return 0;

  let criadas = 0;

  for (const regra of regras) {
    const dias = ocorrenciasNoIntervalo(
      regra.weekday,
      diaISO(regra.startDate),
      diaISO(regra.endDate),
      inicioJanela,
      ate,
      shop.workDays,
    );
    if (dias.length === 0) continue;

    const fim = somaMinutos(regra.startTime, regra.totalDuration);

    // Quais dessas datas já têm a ocorrência criada.
    const existentes = await prisma.appointment.findMany({
      where: { recurringId: regra.id, date: { in: dias.map(dataDoDia) } },
      select: { date: true },
    });
    const jaTem = new Set(existentes.map((a) => diaISO(a.date)));

    for (const dia of dias) {
      if (jaTem.has(dia)) continue;

      // Alguém já ocupou essa cadeira nesse horário? Então a semana passa em
      // branco — conflito nunca vira segundo agendamento.
      const conflito = await prisma.appointment.findFirst({
        where: {
          barberId: regra.barberId,
          date: dataDoDia(dia),
          status: { notIn: ["cancelled"] },
          startTime: { lt: fim },
          endTime: { gt: regra.startTime },
        },
        select: { id: true },
      });
      if (conflito) continue;

      try {
        await prisma.appointment.create({
          data: {
            shopId: regra.shopId,
            barberId: regra.barberId,
            clientId: regra.clientId,
            recurringId: regra.id,
            date: dataDoDia(dia),
            startTime: regra.startTime,
            endTime: fim,
            totalDuration: regra.totalDuration,
            totalPrice: regra.totalPrice,
            status: "confirmed",
            services: {
              create: regra.services.map((s) => ({ serviceId: s.serviceId })),
            },
          },
        });
        criadas++;
      } catch {
        // Corrida entre duas leituras simultâneas: a trava de unicidade barra a
        // segunda. Não é erro — a ocorrência existe, que era o objetivo.
      }
    }
  }

  return criadas;
}
