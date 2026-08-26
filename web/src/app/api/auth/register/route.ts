import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { hashPassword, signToken } from "@/app/lib/auth";
import { generateRecoveryCode, hashRecoveryCode } from "@/app/lib/recovery-code";
import slugify from "slugify";
import { z } from "zod";

const schema = z.object({
  ownerName: z.string().min(2),
  shopName: z.string().min(2),
  phone: z.string().regex(/^\d{10,11}$/, "Telefone deve ter 10 ou 11 digitos"),
  password: z.string().min(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  workDays: z.array(z.number().min(0).max(6)),
  avgServiceTime: z.number().min(10).default(30),
  pixKey: z.string().optional(),
  services: z.array(z.object({
    name: z.string(),
    duration: z.number().min(5),
    price: z.number().min(0),
    category: z.string(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const existingOwner = await prisma.owner.findUnique({ where: { phone: data.phone } });
    if (existingOwner) {
      return NextResponse.json({ error: "Telefone ja cadastrado" }, { status: 400 });
    }

    let slug = slugify(data.shopName, { lower: true, strict: true });
    const slugExists = await prisma.shop.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    const passwordHash = await hashPassword(data.password);

    // Codigo de recuperacao ja no cadastro: se a pessoa errar a senha sem
    // perceber e sair, ainda consegue voltar sozinha. Sem isso, so o suporte.
    const recoveryCode = generateRecoveryCode();
    const recoveryCodeHash = await hashRecoveryCode(recoveryCode);

    const owner = await prisma.owner.create({
      data: {
        name: data.ownerName,
        phone: data.phone,
        passwordHash,
        recoveryCodeHash,
        shops: {
          create: {
            name: data.shopName,
            slug,
            openTime: data.openTime,
            closeTime: data.closeTime,
            workDays: data.workDays,
            avgServiceTime: data.avgServiceTime,
            pixKey: data.pixKey || null,
            services: { create: data.services },
            // Cria o proprio dono como primeiro barbeiro automaticamente.
            //
            // isOwnerProfile ja nasce marcado: antes ficava false e so era
            // corrigido depois, quando alguem chamava /api/me/owner-barber e
            // ele casava pelo telefone. Ate la a barbearia tinha um perfil de
            // dono que o sistema nao reconhecia como tal — dava para desativar
            // o proprio dono e tira-lo da tela de agendamento do cliente.
            barbers: {
              create: {
                name: data.ownerName,
                phone: data.phone,
                passwordHash,
                role: "owner",
                isOwnerProfile: true,
              },
            },
          },
        },
      },
      include: { shops: { include: { services: true, barbers: true } } },
    });

    const shop = owner.shops[0];
    const token = signToken({ userId: owner.id, role: "owner", shopId: shop.id });
    const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    return NextResponse.json({
      token,
      role: "owner",
      user: { id: owner.id, name: owner.name, phone: owner.phone },
      shop: { id: shop.id, name: shop.name, slug: shop.slug, link: `${base}/${shop.slug}` },
      // Mostrado UMA vez na tela de sucesso — depois so fica o hash
      recoveryCode,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Dados invalidos", details: error.errors }, { status: 400 });
    console.error("Register error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
