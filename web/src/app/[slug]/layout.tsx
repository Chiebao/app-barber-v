import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await prisma.shop.findUnique({
    where: { slug: params.slug },
    select: { name: true, slug: true, logoUrl: true, colorTheme: true, city: true, state: true },
  });

  if (!shop) {
    return { title: "Barbearia não encontrada" };
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").replace(/\/+$/, "");
  const url = `${baseUrl}/${shop.slug}`;

  const cidade = [shop.city, shop.state].filter(Boolean).join("/");

  // A imagem carrega a logo e a paleta da barbearia — é o cartão que o
  // cliente vê no WhatsApp, e ele deve parecer da barbearia, não da
  // plataforma.
  const og = new URLSearchParams({ shop: shop.name, tema: shop.colorTheme });
  if (shop.logoUrl) og.set("logo", shop.logoUrl);
  if (cidade) og.set("cidade", cidade);
  const imagem = `${baseUrl}/api/og?${og.toString()}`;

  // Descrição curta de propósito: no cartão do WhatsApp, cada linha de texto
  // abaixo da imagem empurra a imagem para cima e deixa o preview mais
  // parecido com propaganda. O nome da barbearia já está DENTRO da imagem.
  const descricao = cidade ? `Agende seu horário · ${cidade}` : "Agende seu horário";

  return {
    title: shop.name,
    description: descricao,
    openGraph: {
      title: shop.name,
      description: descricao,
      url,
      siteName: shop.name,
      locale: "pt_BR",
      type: "website",
      images: [
        {
          url: imagem,
          width: 1200,
          height: 630,
          alt: `Agende em ${shop.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shop.name,
      description: descricao,
      images: [imagem],
    },
  };
}

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
