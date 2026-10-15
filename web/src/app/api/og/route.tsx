import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { WEB_PALETTES } from "@/app/lib/palettes";

export const runtime = "edge";

/**
 * Imagem do link quando ele é compartilhado no WhatsApp.
 *
 * É a primeira coisa que o cliente vê da barbearia — muitas vezes antes do
 * site. Então mostra a LOGO dela, não um ícone genérico de tesoura, e usa a
 * paleta que o dono escolheu.
 *
 * Edge runtime: sem Prisma aqui. Os dados chegam por query string, montados
 * pelo layout do slug, que tem acesso ao banco.
 */

/**
 * Paletas lidas de palettes.ts (módulo puro, roda no Edge). Antes havia uma
 * cópia à mão aqui, e ela tinha divergido: "Pedra Limpa" estava como
 * `clean_stone` (o id real é `clean_slate`) e saía com as cores da Midnight
 * Gold; a Ametista estava com outro roxo.
 */
const PALETAS: Record<string, { brand: string; fundo: string; fundo2: string }> = Object.fromEntries(
  WEB_PALETTES.map((p) => [
    p.id,
    // Midnight Gold usa o ouro do visual Ouro HUD, igual ao resto do app.
    { brand: p.id === "midnight_gold" ? "#F5B731" : p.brand500, fundo: p.dark900, fundo2: p.dark800 },
  ]),
);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const nome = p.get("shop") || "BarberPro";
  const logo = p.get("logo");
  const cidade = p.get("cidade");
  // O cartao nasceu para a pagina de uma BARBEARIA, onde quem ve e cliente
  // marcando corte. Na landing page quem ve e barbeiro decidindo comprar, e
  // "Agendar horario" convida ele para a coisa errada.
  const chamada = p.get("cta") || "Agendar horário";
  // A assinatura embaixo vira ruido quando o titulo JA e BarberPro.
  const assinatura = p.get("assinatura") ?? "BARBERPRO";
  const tema = PALETAS[p.get("tema") || "midnight_gold"] || PALETAS.midnight_gold;

  // Fundo claro pede texto escuro — senão o nome some no cartão do WhatsApp
  const claro = tema.fundo.toUpperCase() > "#800000";
  const corTexto = claro ? "#1A1A1F" : "#F5F5F7";
  const corSuave = claro ? "#6B6B75" : "#8B8FA3";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${tema.fundo} 0%, ${tema.fundo2} 55%, ${tema.fundo} 100%)`,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Fio dourado no topo — a moldura da barbearia */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: `linear-gradient(90deg, transparent, ${tema.brand}, transparent)`,
          }}
        />

        {logo ? (
          <img
            src={logo}
            width={190}
            height={190}
            style={{
              width: 190,
              height: 190,
              borderRadius: 999,
              objectFit: "cover",
              border: `5px solid ${tema.brand}`,
              marginBottom: 32,
            }}
          />
        ) : (
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: 999,
              border: `5px solid ${tema.brand}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 84,
              marginBottom: 32,
              background: tema.fundo2,
            }}
          >
            ✂️
          </div>
        )}

        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: corTexto,
            textAlign: "center",
            maxWidth: "84%",
            lineHeight: 1.15,
            display: "flex",
          }}
        >
          {nome}
        </div>

        {cidade && (
          <div style={{ fontSize: 28, color: corSuave, marginTop: 14, display: "flex" }}>
            {cidade}
          </div>
        )}

        <div
          style={{
            marginTop: 36,
            padding: "16px 44px",
            borderRadius: 999,
            background: tema.brand,
            color: claro ? "#FFFFFF" : "#14121B",
            fontSize: 30,
            fontWeight: 700,
            display: "flex",
          }}
        >
          {chamada}
        </div>

        {assinatura && (
          <div
            style={{
              position: "absolute",
              bottom: 34,
              fontSize: 20,
              color: corSuave,
              letterSpacing: 3,
              display: "flex",
            }}
          >
            {assinatura}
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
