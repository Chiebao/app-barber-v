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
      800: palette.bgSecondary,
      900: palette.bgPrimary,
    },
    gray: {
      400: palette.textSecondary,
      500: palette.textMuted,
      600: palette.textMuted,
      700: palette.border,
    },
    white: palette.textPrimary,
    green: "#22c55e",
    red: "#ef4444",
    blue: "#3b82f6",
  }), [palette]);
}
