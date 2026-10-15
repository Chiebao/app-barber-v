export interface WebPalette {
  id: string;
  name: string;
  dark: boolean;
  brand500: string;
  dark900: string;
  dark800: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  overlayStart: string; // rgba for gradient top
  overlayEnd: string;   // rgba for gradient bottom
  glowColor: string;    // radial glow rgba
}

export const WEB_PALETTES: WebPalette[] = [
  {
    id: "midnight_gold",
    name: "Midnight Gold",
    dark: true,
    brand500: "#c9a96e",
    dark900: "#0B0B14",
    dark800: "#161625",
    textPrimary: "#F5F5F7",
    textSecondary: "#8B8FA3",
    border: "#2A2D42",
    overlayStart: "rgba(8, 6, 16, 0.40)",
    overlayEnd: "rgba(8, 6, 16, 0.82)",
    glowColor: "rgba(201, 169, 110, 0.10)",
  },
  {
    id: "deep_emerald",
    name: "Selva Esmeralda",
    dark: true,
    brand500: "#10b981",
    dark900: "#081A10",
    dark800: "#0F2A1B",
    textPrimary: "#F0FDF4",
    textSecondary: "#7DD3A8",
    border: "#1A3D2A",
    overlayStart: "rgba(5, 18, 10, 0.40)",
    overlayEnd: "rgba(5, 18, 10, 0.82)",
    glowColor: "rgba(16, 185, 129, 0.10)",
  },
  {
    id: "royal_amethyst",
    name: "Ametista Real",
    dark: true,
    brand500: "#a855f7",
    dark900: "#100820",
    dark800: "#1A1038",
    textPrimary: "#FAF5FF",
    textSecondary: "#C4A0E8",
    border: "#3A1870",
    overlayStart: "rgba(12, 5, 26, 0.40)",
    overlayEnd: "rgba(12, 5, 26, 0.82)",
    glowColor: "rgba(168, 85, 247, 0.10)",
  },
  {
    id: "warm_parchment",
    name: "Pergaminho Quente",
    dark: false,
    brand500: "#b45309",
    dark900: "#FBF3E4",
    dark800: "#FFF9F1",
    textPrimary: "#1A0E00",
    textSecondary: "#6B4423",
    border: "#DFC07A",
    overlayStart: "rgba(251, 243, 228, 0.55)",
    overlayEnd: "rgba(251, 243, 228, 0.90)",
    glowColor: "rgba(180, 83, 9, 0.08)",
  },
  {
    id: "clean_slate",
    name: "Pedra Limpa",
    dark: false,
    brand500: "#1d4ed8",
    dark900: "#EEF2F7",
    dark800: "#FAFBFD",
    textPrimary: "#0E1629",
    textSecondary: "#3F4E63",
    border: "#C2CCDA",
    overlayStart: "rgba(238, 242, 247, 0.55)",
    overlayEnd: "rgba(238, 242, 247, 0.90)",
    glowColor: "rgba(29, 78, 216, 0.08)",
  },
];

export const DEFAULT_WEB_PALETTE = WEB_PALETTES[0];

export function getPaletteById(id: string): WebPalette {
  return WEB_PALETTES.find((p) => p.id === id) ?? DEFAULT_WEB_PALETTE;
}

/** Returns inline CSS variables string for a palette */
/**
 * Tokens do visual "Ouro HUD", derivados da paleta.
 *
 * O dourado das referencias e so a Midnight Gold: em cada barbearia o
 * destaque vira a cor dela, e as duas pontas do gradiente metalico saem dela
 * (`globals.css`, com `color-mix`). A Midnight Gold usa o ouro das
 * referencias (#F5B731) e nao o `brand500` antigo (#c9a96e, mais apagado):
 * o desenho inteiro foi feito em cima daquele ouro.
 *
 * Nas paletas CLARAS o gradiente vai da cor para o escuro, nao do claro para
 * a cor: a ponta clara some no fundo creme/cinza e o texto metalico fica
 * ilegivel. As cores de estado tambem escurecem — verde-limao em fundo claro
 * nao passa no contraste.
 */
function hudVars(p: WebPalette): string[] {
  const accent = p.id === "midnight_gold" ? "#F5B731" : p.brand500;
  // Nas claras o gradiente escurece (vai da cor para o escuro), entao o
  // texto do botao e BRANCO: escuro sobre o marrom do Pergaminho media 1,8:1.
  const sobreAccent = !p.dark ? "#FFFFFF" : "#0B0B14";
  const claro = !p.dark;
  return [
    `--hud-accent: ${accent}`,
    `--hud-on-accent: ${sobreAccent}`,
    `--hud-mix-claro: ${claro ? "100%" : "55%"}`,
    `--hud-mix-escuro: ${claro ? "55%" : "72%"}`,
    `--hud-tint-mix: ${claro ? "100%" : "62%"}`,
    `--hud-ok: ${claro ? "#166534" : "#4ADE80"}`,
    `--hud-warn: ${claro ? "#9A3412" : "#FB923C"}`,
    `--hud-err: ${claro ? "#B91C1C" : "#F87171"}`,
    `--hud-info: ${claro ? "#1D4ED8" : "#60A5FA"}`,
    `--hud-shadow: ${claro ? "rgba(15,23,42,0.18)" : "rgba(0,0,0,0.55)"}`,
  ];
}

/** As mesmas variaveis como objeto de estilo — para tematizar so um trecho da tela. */
export function paletteToStyle(p: WebPalette): Record<string, string> {
  return Object.fromEntries(
    paletteToVars(p)
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(":");
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
      }),
  );
}

export function paletteToVars(p: WebPalette): string {
  return [
    ...hudVars(p),
    `--brand-500: ${p.brand500}`,
    `--dark-900: ${p.dark900}`,
    `--dark-800: ${p.dark800}`,
    `--text-primary: ${p.textPrimary}`,
    `--text-secondary: ${p.textSecondary}`,
    `--border-color: ${p.border}`,
    `--overlay-start: ${p.overlayStart}`,
    `--overlay-end: ${p.overlayEnd}`,
    `--glow-color: ${p.glowColor}`,
  ].join("; ");
}
