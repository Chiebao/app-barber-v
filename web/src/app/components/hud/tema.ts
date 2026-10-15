/**
 * "Ilha escura": força o tema escuro do HUD dentro de um trecho, mantendo
 * a cor de destaque da barbearia.
 *
 * Usada no modal e no toast. Os conteúdos que as telas põem dentro do modal
 * ainda usam `text-white`/`text-gray-300` (as telas migram nas Fases 2 e 3);
 * se o modal seguisse a paleta CLARA, esse texto branco sumiria no fundo
 * creme. Escuro sempre, com o destaque da paleta, nunca quebra.
 *
 * Precisa ir junto com a classe `hud-scope`, que recalcula os derivados.
 */
export const ILHA_ESCURA: React.CSSProperties = {
  ["--dark-900" as string]: "#0B0B14",
  ["--dark-800" as string]: "#161625",
  ["--border-color" as string]: "#2A2D42",
  ["--text-primary" as string]: "#F5F5F7",
  ["--text-secondary" as string]: "#8B8FA3",
  ["--hud-tint-mix" as string]: "62%",
  ["--hud-ok" as string]: "#4ADE80",
  ["--hud-warn" as string]: "#FB923C",
  ["--hud-err" as string]: "#F87171",
  ["--hud-info" as string]: "#60A5FA",
  ["--hud-shadow" as string]: "rgba(0,0,0,0.55)",
};
