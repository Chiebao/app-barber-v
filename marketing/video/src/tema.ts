import { loadFont as carregarMarcellus } from "@remotion/google-fonts/Marcellus";
import { loadFont as carregarManrope } from "@remotion/google-fonts/Manrope";

// As mesmas fontes do app: Marcellus nos títulos, Manrope no resto.
export const { fontFamily: TITULO } = carregarMarcellus("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: TEXTO } = carregarManrope("normal", { weights: ["500", "700", "800"], subsets: ["latin", "latin-ext"] });

// Paleta Midnight Gold do "Ouro HUD" (web/src/app/lib/palettes.ts).
export const COR = {
  fundo: "#07070D",
  fundo2: "#0B0B14",
  cartao: "#161625",
  borda: "#2A2D42",
  texto: "#F5F5F7",
  texto2: "#8B8FA3",
  ouro: "#F5B731",
  ouroClaro: "#FBDB98",
  ouroEscuro: "#8A6414",
};

export const GRADIENTE_OURO = `linear-gradient(100deg, ${COR.ouroClaro} 0%, ${COR.ouro} 45%, ${COR.ouroEscuro} 100%)`;

export const FPS = 30;
export const LARGURA = 1080;
export const ALTURA = 1920;
