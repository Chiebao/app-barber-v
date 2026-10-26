import { Composition } from "remotion";
import { ClienteAgenda, DURACAO_CLIENTE_AGENDA } from "./ClienteAgenda";
import { ALTURA, FPS, LARGURA } from "./tema";

export function Raiz() {
  return (
    <Composition id="ClienteAgenda" component={ClienteAgenda} durationInFrames={DURACAO_CLIENTE_AGENDA} fps={FPS} width={LARGURA} height={ALTURA} />
  );
}
