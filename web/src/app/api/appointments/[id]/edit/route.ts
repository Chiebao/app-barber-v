import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { serviceIds, phone } = await req.json();
    if (!phone || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
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
      return NextResponse.json({ error: "Agendamento não encontrado ou ja realizado" }, { status: 404 });
    }

    // Valida que todos os serviços pertencem à barbearia
    const shopServiceIds = appointment.shop.services.map((s) => s.id);
    const invalid = serviceIds.filter((id: string) => !shopServiceIds.includes(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: "Servico invalido" }, { status: 400 });
    }

    // Busca os serviços selecionados
    const selectedServices = appointment.shop.services.filter((s) => serviceIds.includes(s.id));
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

    // Recalcula endTime
    const [h, m] = appointment.startTime.split(":").map(Number);
    const endMinutes = h * 60 + m + totalDuration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    // Atualiza appointment_services (remove todos e recria)
    await prisma.appointmentService.deleteMany({ where: { appointmentId: params.id } });
    await prisma.appointmentService.createMany({
      data: serviceIds.map((serviceId: string) => ({ appointmentId: params.id, serviceId })),
    });

    // Atualiza o agendamento
    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: { totalPrice, totalDuration, endTime },
      include: {
        services: { include: { service: true } },
        barber: { select: { name: true } },
      },
    });

    return NextResponse.json({
      appointment: {
        id: updated.id,
        startTime: updated.startTime,
        endTime: updated.endTime,
        totalPrice: updated.totalPrice,
        services: updated.services.map((as) => ({ name: as.service.name, price: as.service.price })),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
