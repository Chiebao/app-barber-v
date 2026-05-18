import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const shopName = req.nextUrl.searchParams.get("shop") || "BarberPro";

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
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top decorative line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, transparent, #f59e0b, transparent)",
          }}
        />

        {/* Scissors icon */}
        <div
          style={{
            fontSize: 72,
            marginBottom: 16,
          }}
        >
          ✂️
        </div>

        {/* Shop name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#f59e0b",
            textAlign: "center",
            maxWidth: "80%",
            lineHeight: 1.2,
          }}
        >
          {shopName}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "#9ca3af",
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          Agende seu corte online
        </div>

        {/* CTA badge */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(245, 158, 11, 0.15)",
            border: "2px solid rgba(245, 158, 11, 0.4)",
            borderRadius: 16,
            padding: "14px 32px",
          }}
        >
          <div style={{ fontSize: 22, color: "#f59e0b", fontWeight: 700 }}>
            📱 Toque para agendar
          </div>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: 30,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 16, color: "#6b7280" }}>Powered by</div>
          <div style={{ fontSize: 18, color: "#9ca3af", fontWeight: 700 }}>BarberPro</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
