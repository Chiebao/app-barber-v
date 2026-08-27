// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens — BarberPro Mobile
// Centraliza tipografia, espaçamento e border radius para todo o app.
// Cores vêm do ThemeContext (useColors / useTheme) — aqui ficam tokens fixos.
// ─────────────────────────────────────────────────────────────────────────────

// ── Typography ───────────────────────────────────────────────────────────────
export const fontSize = {
  /** 32px — Logo, tela de boas-vindas */
  display: 32,
  /** 24px — Títulos de página */
  h1: 24,
  /** 20px — Títulos de seção */
  h2: 20,
  /** 16px — Títulos de card, subtítulos */
  h3: 16,
  /** 16px — Texto principal, inputs */
  bodyLarge: 16,
  /** 14px — Texto padrão, descrições */
  body: 14,
  /** 13px — Texto secundário */
  bodySmall: 13,
  /** 12px — Labels, metadata, badges */
  caption: 12,
  /** 11px — Timestamps, hints */
  micro: 11,
} as const;

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const fontFamily = {
  /** Marcellus — titulos. Letra romana inscricional, de placa gravada.
   *  Tem um peso so, entao serif e serifBold apontam para a mesma fonte. */
  serif: "Marcellus_400Regular",
  serifBold: "Marcellus_400Regular",
  /** Manrope — corpo, labels e botoes */
  sans: "Manrope_500Medium",
  sansBold: "Manrope_600SemiBold",
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  compact: 1.4,
};

// ── Spacing (escala de 4px) ──────────────────────────────────────────────────
export const spacing = {
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px */
  lg: 16,
  /** 20px */
  xl: 20,
  /** 24px */
  "2xl": 24,
  /** 32px */
  "3xl": 32,
  /** 48px */
  "4xl": 48,
  /** 60px — Top de tela (abaixo da status bar) */
  screenTop: 60,
} as const;

// ── Border Radius ────────────────────────────────────────────────────────────
export const radius = {
  /** 8px — Badges, chips */
  sm: 8,
  /** 12px — Inputs, botões */
  md: 12,
  /** 16px — Cards */
  lg: 16,
  /** 24px — Bottom sheets */
  xl: 24,
  /** 9999px — Avatares, pills */
  full: 9999,
} as const;

// ── Shadows ──────────────────────────────────────────────────────────────────
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ── Hit Slop (touch targets) ─────────────────────────────────────────────────
export const hitSlop = {
  small: { top: 8, bottom: 8, left: 8, right: 8 },
  medium: { top: 12, bottom: 12, left: 12, right: 12 },
} as const;

// ── Feedback Colors (invariáveis entre temas) ────────────────────────────────
export const feedback = {
  success: "#22c55e",
  successBg: "#22c55e14",
  error: "#ef4444",
  errorBg: "#ef444414",
  warning: "#f59e0b",
  warningBg: "#f59e0b14",
  info: "#3b82f6",
  infoBg: "#3b82f614",
} as const;

// ── Animation Durations ──────────────────────────────────────────────────────
export const duration = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

// ── Min Touch Target ─────────────────────────────────────────────────────────
export const minTouchTarget = 48;
