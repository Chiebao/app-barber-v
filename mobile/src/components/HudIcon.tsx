import React from "react";
import { Feather } from "@expo/vector-icons";

/**
 * Ícone de linha do Ouro HUD no app.
 *
 * Feather vem junto com o Expo (`@expo/vector-icons`, dependência do próprio
 * `expo`) — nada foi instalado. Traço fino e uniforme, o mesmo desenho dos
 * ícones do site. Substitui os emojis de interface.
 */
export type NomeHudIcon = React.ComponentProps<typeof Feather>["name"];

/** Emoji de interface antigo -> ícone de linha. */
const DE_EMOJI: Record<string, NomeHudIcon> = {
  "📅": "calendar", "🗓️": "calendar", "💰": "dollar-sign", "💵": "dollar-sign", "📊": "bar-chart-2",
  "👥": "users", "👤": "user", "✂️": "scissors", "💈": "scissors", "🛍️": "shopping-bag", "📦": "package",
  "🏆": "award", "🎁": "gift", "⏰": "clock", "🕐": "clock", "⏱️": "clock", "🔒": "lock", "🔑": "key",
  "🚫": "slash", "⚙️": "settings", "ℹ️": "info", "📋": "clipboard", "🔗": "link", "📤": "share-2",
  "📱": "smartphone", "📞": "phone", "💬": "message-circle", "🔔": "bell", "🏠": "home", "➕": "plus",
  "✏️": "edit-2", "🗑️": "trash-2", "🔁": "repeat", "🔄": "refresh-cw", "📷": "camera", "🖼️": "image",
  "🎨": "droplet", "⭐": "star", "✅": "check-circle", "❌": "x-circle", "⚠️": "alert-triangle",
  "🚪": "log-out", "🔍": "search", "📝": "file-text", "📈": "trending-up", "💳": "credit-card",
};

export function iconeDoEmoji(texto?: string): NomeHudIcon | null {
  if (!texto) return null;
  const limpo = texto.replace(/️/g, "").trim();
  for (const [e, nome] of Object.entries(DE_EMOJI)) {
    if (e.replace(/️/g, "") === limpo) return nome;
  }
  return (Feather.glyphMap as Record<string, number>)[limpo] !== undefined ? (limpo as NomeHudIcon) : null;
}

export default function HudIcon({ nome, size = 20, color }: { nome: NomeHudIcon; size?: number; color: string }) {
  return <Feather name={nome} size={size} color={color} />;
}
