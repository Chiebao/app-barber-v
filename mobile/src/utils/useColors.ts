import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Returns a colors object with the same shape as the static colors.ts,
 * but derived from the currently active theme palette.
 * Use this instead of importing from colors.ts.
 */
export function useColors() {
  const { palette } = useTheme();

  return useMemo(() => ({
    brand: {
      400: palette.brandLight,
      500: palette.brand,
      600: palette.brandDark,
    },
    dark: {
      // Superfície um passo acima do fundo — usada como cartão elevado
      700: palette.border,
      800: palette.bgSecondary,
      900: palette.bgPrimary,
    },
    gray: {
      300: palette.textSecondary,
      400: palette.textSecondary,
      500: palette.textMuted,
      600: palette.textMuted,
      700: palette.border,
    },
    white: palette.textPrimary,
    green: "#4ADE80",
    red: "#F87171",
    blue: "#60A5FA",
    /** Alias semântico de red — ações destrutivas. */
    error: "#F87171",
  }), [palette]);
}
