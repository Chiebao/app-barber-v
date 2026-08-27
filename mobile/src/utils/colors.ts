// Cores estáticas de fallback — em runtime use useColors() que segue o tema.
export const colors = {
  brand: {
    400: "#F5B731",
    500: "#E8960A",
    600: "#C47A08",
  },
  dark: {
    // 700 e o tom de borda/superficie elevada — as telas ja pediam por ele
    700: "#1F1F33",
    800: "#161625",
    900: "#0B0B14",
  },
  gray: {
    300: "#A9ADBE",
    400: "#8B8FA3",
    500: "#555870",
    600: "#3E4058",
    700: "#2A2D42",
  },
  white: "#F5F5F7",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  /** Alias semantico de red — usado em acoes destrutivas. */
  error: "#ef4444",
};
