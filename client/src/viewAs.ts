// Ver o mapa como um jogador (Passo 11): o servidor manda ao mestre o estado que o jogador recebe
// (`view:preview`), e o mapa desenha esse estado só para olhar, até o mestre sair.
import { socket } from "./socket";
import { setTool, useApp } from "./store";

/** Começa a ver como o jogador (`null` volta à visão do mestre). */
export function viewAs(playerId: string | null) {
  setTool("move");
  useApp.setState({ viewAsId: playerId, ...(playerId === null && { preview: null }) });
  socket.emit("view:as", playerId);
}
