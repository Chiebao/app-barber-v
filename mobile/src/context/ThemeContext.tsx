import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

// ---------------------------------------------------------------------------
// Palette definition
// ---------------------------------------------------------------------------
export interface ColorPalette {
  id: string;
  name: string;
  dark: boolean;
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  // Brand / accent
  brand: string;
  brandLight: string;
  brandDark: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // UI chrome
  border: string;
  // Background overlay (used on ScreenBackground)
  overlay: string;
  // Status bar style
  statusBar: "light" | "dark";
}

// ---------------------------------------------------------------------------
// 5 Palettes — 3 escuras, 2 claras
// Baseadas em teoria de cores: complementar, análogo e split-complementar
// ---------------------------------------------------------------------------
export const PALETTES: ColorPalette[] = [
  // 1. ESCURA — Midnight Gold (padrão, brand âmbar sobre azul-noite)
  {
    id: "midnight_gold",
    name: "Midnight Gold",
    dark: true,
    bgPrimary: "#0B0B14",
    bgSecondary: "#161625",
    bgTertiary: "#0B0B14cc",
    // Ouro das referências Ouro HUD (claro → ouro → escuro)
    brand: "#F5B731",
    brandLight: "#F9DA8A",
    brandDark: "#C47A08",
    textPrimary: "#F5F5F7",
    textSecondary: "#8B8FA3",
    textMuted: "#555870",
    border: "#2A2D42",
    overlay: "rgba(8, 8, 16, 0.70)",
    statusBar: "light",
  },
  // 2. ESCURA — Selva Esmeralda (verde complementar, inspirado em barbearias vintage)
  {
    id: "deep_emerald",
    name: "Selva Esmeralda",
    dark: true,
    bgPrimary: "#081A10",
    bgSecondary: "#0F2A1B",
    bgTertiary: "#081A10cc",
    brand: "#10b981",
    brandLight: "#34d399",
    brandDark: "#059669",
    textPrimary: "#F0FDF4",
    textSecondary: "#7DD3A8",
    textMuted: "#3D8B65",
    border: "#1A3D2A",
    overlay: "rgba(5, 18, 10, 0.72)",
    statusBar: "light",
  },
  // 3. ESCURA — Ametista Real (roxo triádico com alto contraste, premium)
  {
    id: "royal_amethyst",
    name: "Ametista Real",
    dark: true,
    bgPrimary: "#100820",
    bgSecondary: "#1A1038",
    bgTertiary: "#100820cc",
    brand: "#a855f7",
    brandLight: "#c084fc",
    brandDark: "#7c3aed",
    textPrimary: "#FAF5FF",
    textSecondary: "#C4A0E8",
    textMuted: "#8B6BAA",
    border: "#3A1870",
    overlay: "rgba(12, 5, 26, 0.72)",
    statusBar: "light",
  },
  // 4. CLARA — Pergaminho Quente (âmbar-marrom, remete ao couro e madeira da barbearia)
  {
    id: "warm_parchment",
    name: "Pergaminho Quente",
    dark: false,
    bgPrimary: "#FBF3E4",
    bgSecondary: "#FFF9F1",
    bgTertiary: "#FBF3E4cc",
    brand: "#b45309",
    brandLight: "#d97706",
    brandDark: "#92400e",
    textPrimary: "#1A0E00",
    textSecondary: "#6B4423",
    textMuted: "#9A7B5A",
    border: "#DFC07A",
    overlay: "rgba(251, 243, 228, 0.93)",
    statusBar: "dark",
  },
  // 5. CLARA — Pedra Limpa (azul-ardósia neutro, moderno e profissional)
  {
    id: "clean_slate",
    name: "Pedra Limpa",
    dark: false,
    bgPrimary: "#EEF2F7",
    bgSecondary: "#FAFBFD",
    bgTertiary: "#EEF2F7cc",
    brand: "#1d4ed8",
    brandLight: "#3b82f6",
    brandDark: "#1e40af",
    textPrimary: "#0E1629",
    textSecondary: "#3F4E63",
    textMuted: "#8A96A8",
    border: "#C2CCDA",
    overlay: "rgba(238, 242, 247, 0.93)",
    statusBar: "dark",
  },
];

export const DEFAULT_PALETTE = PALETTES[0];

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface ThemeContextValue {
  palette: ColorPalette;
  setPalette: (id: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: async () => {},
});

const STORAGE_KEY = "app_color_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<ColorPalette>(DEFAULT_PALETTE);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved) {
          const found = PALETTES.find((p) => p.id === saved);
          if (found) setPaletteState(found);
        }
      } catch {
        // first launch
      }
    })();
  }, []);

  const setPalette = useCallback(async (id: string) => {
    const found = PALETTES.find((p) => p.id === id);
    if (!found) return;
    setPaletteState(found);
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, id);
    } catch {
      // storage error — palette still applied in memory
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
