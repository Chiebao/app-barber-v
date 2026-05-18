import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await prisma.shop.findUnique({
    where: { slug: params.slug },
    select: { name: true, slug: true },
  });

  if (!shop) {
    return { title: "Barbearia não encontrada" };
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-black.vercel.app").replace(/\/+$/, "");
  const url = `${baseUrl}/${shop.slug}`;

  return {
    title: `${shop.name} — Agende seu corte online`,
    description: `Agende seu corte em ${shop.name} de forma rápida e fácil. Escolha o profissional, horário e serviço que preferir.`,
    openGraph: {
      title: `✂️ ${shop.name} — Agende seu corte online`,
      description: `Agende em ${shop.name} de forma rápida e fácil. Escolha o profissional, horário e serviço.`,
      url,
      siteName: "BarberPro",
      type: "website",
      images: [
        {
          url: `${baseUrl}/api/og?shop=${encodeURIComponent(shop.name)}`,
          width: 1200,
          height: 630,
          alt: `Agende em ${shop.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `✂️ ${shop.name} — Agende online`,
      description: `Agende seu corte em ${shop.name}.`,
      images: [`${baseUrl}/api/og?shop=${encodeURIComponent(shop.name)}`],
    },
  };
}

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
