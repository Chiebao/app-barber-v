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
export function paletteToVars(p: WebPalette): string {
  return [
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
