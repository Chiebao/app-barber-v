import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getPaletteById } from "@/app/lib/palettes";

/**
 * Imagem do dia para o STATUS do WhatsApp do barbeiro (1080×1920).
 *
 * O WhatsApp não deixa sistema nenhum postar no Status de ninguém — não há
 * API para isso. O que dá para fazer é deixar a imagem PRONTA: o barbeiro
 * toca em "Postar no Status", o celular abre o compartilhar e ele escolhe
 * "Meu status". Dois toques.
 *
 * Muda todo dia de propósito: status repetido ninguém olha. Leva os
 * horários LIVRES de hoje (a mesma conta da página de agendamento), a data
 * e uma frase que gira pelo dia do ano. Dia cheio vira "garanta amanhã".
 *
 * Edge (como a imagem do link): o Node do @vercel/og quebra no Windows. Os
 * horários vêm de ./dados, que fala com o banco.
 */
export const runtime = "edge";

const FRASES = [
  "Hoje tem horário pra você",
  "Seu corte de hoje começa aqui",
  "Visual em dia, agenda aberta",
  "Ainda dá tempo de ficar na régua",
  "Reserve antes que acabe",
  "A cadeira está te esperando",
  "Corte marcado, cabeça tranquila",
];

/** Mistura duas cores hex (o Satori não conhece color-mix). */
function mistura(hex: string, com: string, peso: number): string {
  const a = hex.replace("#", ""), b = com.replace("#", "");
  const c = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * peso + parseInt(b.slice(i, i + 2), 16) * (1 - peso));
  return "#" + [0, 2, 4].map((i) => c(i).toString(16).padStart(2, "0")).join("");
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const r = await fetch(`${req.nextUrl.origin}/api/status/${encodeURIComponent(params.slug)}/dados`, { cache: "no-store" });
    if (r.status === 404) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    if (!r.ok) return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    const d = (await r.json()) as { nome: string; slug: string; logoUrl: string | null; tema: string; hoje: string; dia: string; amanha: boolean; livres: string[] };
    const shop = { name: d.nome, slug: d.slug, logoUrl: d.logoUrl, colorTheme: d.tema };
    const hoje = d.hoje;
    const dia = d.dia;
    const amanha = d.amanha;
    const livres = d.livres;

    const p = getPaletteById(shop.colorTheme);
    const accent = p.id === "midnight_gold" ? "#F5B731" : p.brand500;
    const claro = !p.dark;
    const g1 = claro ? accent : mistura(accent, "#FFFFFF", 0.55);
    const g3 = mistura(accent, "#000000", claro ? 0.55 : 0.72);
    const sobre = claro ? "#FFFFFF" : "#0B0B14";
    const fundo = p.dark900;
    const superficie = p.dark800;
    const texto = p.textPrimary;
    const suave = p.textSecondary;

    const doAno = Math.floor((Date.parse(hoje) - Date.parse(hoje.slice(0, 4) + "-01-01")) / 86_400_000);
    const semente = [...shop.slug].reduce((s, c) => s + c.charCodeAt(0), 0);
    const frase = FRASES[(doAno + semente) % FRASES.length];
    const dataExtenso = new Date(dia + "T12:00:00.000Z").toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    });
    const mostrar = livres.slice(0, 9);
    const resto = livres.length - mostrar.length;
    const base = (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/+$/, "").replace(/^https?:\/\//, "");

    const imagem = new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", padding: "150px 90px 120px",
            background: `radial-gradient(circle at 100% 0%, ${mistura(accent, fundo, 0.28)} 0%, ${fundo} 55%)`,
            color: texto, fontFamily: "sans-serif",
          }}
        >
          {/* Moldura com cantoneiras — o "HUD" da imagem */}
          <div style={{ position: "absolute", top: 60, left: 60, width: 70, height: 70, borderTop: `6px solid ${g1}`, borderLeft: `6px solid ${g1}`, display: "flex" }} />
          <div style={{ position: "absolute", bottom: 60, right: 60, width: 70, height: 70, borderBottom: `6px solid ${g1}`, borderRight: `6px solid ${g1}`, display: "flex" }} />

          {shop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} width={200} height={200} style={{ borderRadius: 100, border: `5px solid ${accent}`, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 200, height: 200, borderRadius: 100, border: `5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, color: accent }}>
              {shop.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ marginTop: 44, fontSize: 76, fontWeight: 700, textAlign: "center", lineHeight: 1.1, display: "flex" }}>{shop.name}</div>
          <div style={{ marginTop: 36, fontSize: 52, color: g1, textAlign: "center", lineHeight: 1.2, display: "flex" }}>{frase}</div>

          <div style={{ marginTop: 70, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: suave, display: "flex" }}>
            {amanha ? "Hoje lotou · livres amanhã" : "Horários livres hoje"}
          </div>
          <div style={{ marginTop: 12, fontSize: 38, color: texto, display: "flex" }}>{dataExtenso}</div>

          <div style={{ marginTop: 44, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, width: 900 }}>
            {mostrar.length === 0 ? (
              <div style={{ fontSize: 40, color: suave, display: "flex" }}>Agenda cheia — veja os próximos dias pelo link</div>
            ) : (
              mostrar.map((h) => (
                <div key={h} style={{ width: 270, height: 110, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `3px solid ${mistura(accent, superficie, 0.6)}`, background: superficie, fontSize: 56, fontWeight: 700, color: texto }}>
                  {h}
                </div>
              ))
            )}
          </div>
          {resto > 0 && <div style={{ marginTop: 24, fontSize: 36, color: suave, display: "flex" }}>e mais {resto} horário{resto > 1 ? "s" : ""}</div>}

          <div style={{ flex: 1, display: "flex" }} />

          <div style={{ width: 900, height: 150, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: `linear-gradient(135deg, ${g1} 0%, ${accent} 45%, ${g3} 100%)`, color: sobre, fontSize: 50, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase" }}>
            Agende pelo link
          </div>
          <div style={{ marginTop: 30, fontSize: 40, color: texto, display: "flex" }}>{base}/{shop.slug}</div>
          <div style={{ marginTop: 40, fontSize: 26, letterSpacing: 8, color: suave, display: "flex" }}>BARBERPRO</div>
        </div>
      ),
      { width: 1080, height: 1920 },
    );

    // Pode ficar alguns minutos no cache: o horário que alguém acabou de
    // pegar ainda apareceria livre, mas o link mostra a verdade na hora.
    imagem.headers.set("Cache-Control", "public, max-age=300");
    return imagem;
  } catch (error) {
    console.error("[status] erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
