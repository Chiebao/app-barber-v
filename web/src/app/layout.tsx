import type { Metadata, Viewport } from "next";
import { Manrope, Marcellus } from "next/font/google";
import "./globals.css";
import { Toaster } from "./lib/toast";

// Manrope na interface: a clareza da Inter com contorno mais fino e
// numeros melhores — num app que e quase todo preco e horario, isso pesa.
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
});

// Marcellus nos titulos: letra romana inscricional, a mesma das placas
// gravadas de barbearia. Tem um peso so — serve para titulo, nunca para
// texto corrido. E, ao contrario da Playfair, o traco nao some no escuro.
const marcellus = Marcellus({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400"],
});

export const viewport: Viewport = {
  themeColor: "#0B0B14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "BarberPro - Agendamento Online",
  description: "Agende seu corte de cabelo online de forma rápida e fácil",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BarberPro",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${marcellus.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-dark-900 text-white antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
