import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num, sumMoney } from "@/app/lib/money";
import { occupiesSlotWhere, appointmentStartUtc } from "@/app/lib/pending-deadline";
import { bloqueiosDoDia, invadeBloqueio, emMinutos, emTexto } from "@/app/lib/bloqueios";
import { expedienteDoDia } from "@/app/lib/expediente";

/**
 * Cliente troca os serviços do próprio agendamento.
 *
 * A troca MUDA A DURAÇÃO, e por isso esta rota precisa das mesmas checagens da
 * criação. Ela não tinha nenhuma: recalculava o fim e gravava.
 *
 * O buraco concreto: João marca Corte (30 min) às 14:00 e Pedro marca 14:30.
 * João volta aqui e troca para Corte + Barba + Platinado (2h). O agendamento
 * dele passa a ir até as 16:00, e os dois ficam marcados às 14:30.
 *
 * A porta da frente estava trancada — a criação roda numa transação
 * Serializable desde sempre. Esta janela é que ficou aberta, porque a rota é
 * anterior a ela e ninguém voltou aqui quando a trava foi construída.
 *
 * Só encurtar é livre: quem tira um serviço não invade nada.
 */

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { serviceIds, phone } = await req.json();
    if (!phone || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "");

    // Verifica que o agendamento pertence a esse cliente e está confirmado
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        status: "confirmed",
        client: { phone: cleanPhone },
      },
      include: { shop: { include: { services: true } } },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado ou já realizado" }, { status: 404 });
    }

    // Atendimento que já começou não se edita. Sem isto, dava para trocar os
    // serviços de um corte de ontem e reescrever o que foi cobrado.
    if (appointmentStartUtc(appointment.date, appointment.startTime) <= new Date()) {
      return NextResponse.json(
        { error: "Esse horário já passou e não pode mais ser alterado" },
        { status: 400 },
      );
    }

    // Valida que todos os serviços pertencem à barbearia
    const shopServiceIds = appointment.shop.services.map((s) => s.id);
    const invalid = serviceIds.filter((id: string) => !shopServiceIds.includes(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: "Serviço inválido" }, { status: 400 });
    }

    // Busca os serviços selecionados
    const selectedServices = appointment.shop.services.filter((s) => serviceIds.includes(s.id));
    const totalPrice = sumMoney(selectedServices.map((s) => s.price));
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

    // Recalcula endTime
    const inicio = emMinutos(appointment.startTime);
    if (!Number.isFinite(inicio)) {
      return NextResponse.json({ error: "Horário inválido" }, { status: 400 });
    }
    const endTime = emTexto(inicio + totalDuration);

    const dia = appointment.date.toISOString().split("T")[0];
    const alongou = endTime > appointment.endTime;

    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          // Só quem ALONGA precisa ser checado: encurtar libera espaço, nunca
          // invade. Checar sempre faria um cliente sem culpa levar 409 porque a
          // agenda ficou apertada depois que ele marcou.
          if (alongou) {
            const conflitos = await tx.appointment.findMany({
              where: {
                barberId: appointment.barberId,
                // O próprio agendamento não conta como conflito consigo mesmo.
                id: { not: appointment.id },
                date: { gte: new Date(dia + "T00:00:00.000Z"), lte: new Date(dia + "T23:59:59.999Z") },
                ...occupiesSlotWhere(),
              },
              select: { startTime: true, endTime: true },
            });
            if (conflitos.some((a) => appointment.startTime < a.endTime && endTime > a.startTime)) {
              throw new Error("SLOT_CONFLICT");
            }

            const bloq = await bloqueiosDoDia(tx, appointment.barberId, dia, appointment.shop.slotInterval);
            if (bloq.diaTodo) throw new Error("SLOT_BLOCKED");

            const exp = await expedienteDoDia(tx, appointment.shop, dia);
            if (!exp.aberto) throw new Error("SLOT_BLOCKED");
            if (invadeBloqueio(appointment.startTime, endTime, [...bloq.intervalos, ...exp.pausas])) {
              throw new Error("SLOT_BLOCKED");
            }

            // Passar do fechamento é o caso mais fácil de acontecer sem má-fé:
            // o último horário do dia cabia para um corte, não para três.
            if (emMinutos(endTime) > emMinutos(exp.fecha)) {
              throw new Error("SLOT_AFTER_CLOSE");
            }
          }

          await tx.appointmentService.deleteMany({ where: { appointmentId: params.id } });
          await tx.appointmentService.createMany({
            data: serviceIds.map((serviceId: string) => ({ appointmentId: params.id, serviceId })),
          });

          return tx.appointment.update({
            where: { id: params.id },
            data: { totalPrice, totalDuration, endTime },
            include: {
              services: { include: { service: true } },
              barber: { select: { name: true } },
            },
          });
        },
        { isolationLevel: "Serializable" },
      );

      return NextResponse.json({
        appointment: {
          id: updated.id,
          startTime: updated.startTime,
          endTime: updated.endTime,
          totalPrice: num(updated.totalPrice),
          services: updated.services.map((as) => ({ name: as.service.name, price: num(as.service.price) })),
        },
      });
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : "";
      if (msg === "SLOT_AFTER_CLOSE") {
        return NextResponse.json(
          { error: "Com esses serviços o atendimento passa do horário de fechamento" },
          { status: 409 },
        );
      }
      if (msg === "SLOT_BLOCKED") {
        return NextResponse.json(
          { error: "Com esses serviços o atendimento esbarra num horário indisponível" },
          { status: 409 },
        );
      }
      if (
        msg === "SLOT_CONFLICT" ||
        msg.includes("could not serialize") ||
        (erro as { code?: string })?.code === "P2034"
      ) {
        return NextResponse.json(
          { error: "Com esses serviços o atendimento passa por cima do próximo cliente. Escolha menos serviços ou fale com a barbearia." },
          { status: 409 },
        );
      }
      throw erro;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
