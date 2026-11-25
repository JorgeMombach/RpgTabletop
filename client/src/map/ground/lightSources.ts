import { stopAtWall, TORCH_FEET, type CombatantView, type MapConfig, type MapTorch, type Segment } from "@rpg/shared";
import { TORCH_CELLS } from "../MapTorches";
import { TORCH_MODELS, TORCH_RGB, torchColorIndex, torchFacing, torchOffset } from "../torchModels";
import { tokenCenter } from "../Torch";
import type { LightSource } from "./lightPass";
import { HELD_TORCH_ABOVE, TOKEN_HEIGHT, TORCH_HEIGHT } from "./shadowCasters";

/** Peça sendo arrastada agora (tocha ou token): a luz e a chama acompanham (`dragFollow`). */
export interface Dragging {
  id: string | null;
  dx: number;
  dy: number;
}

/**
 * De onde sai luz, em casas (docs/design/luz.md): tochas fixas (a base da chama no desenho de cada uma) e tokens com
 * tocha acesa (o alcance conta da borda do token). Durante o arrasto, a peça arrastada já leva a luz junto.
 */
export function lightSources(tokens: CombatantView[], torches: MapTorch[], grid: MapConfig, dragging: Dragging, blockers: Segment[]): LightSource[] {
  const reach = TORCH_FEET / grid.feetPerCell;
  const shift = (id: string) => (dragging.id === id ? { x: dragging.dx / grid.cellPx, y: dragging.dy / grid.cellPx } : { x: 0, y: 0 });
  const fixed = torches.map((torch): LightSource => {
    const offset = shift(torch.id);
    const cells = TORCH_CELLS[torch.style];
    const model = TORCH_MODELS[torch.style];
    const anchor = torchOffset(torch, cells, model.light);
    const x = torch.col + offset.x;
    const y = torch.row + offset.y;
    const flame = { x: x + anchor.x, y: y + anchor.y };
    // A chama fica acima da base no desenho: encostada numa parede, a luz sai do lado da base, não do outro cômodo.
    const origin = stopAtWall({ x, y }, flame, blockers);
    return {
      id: torch.id,
      x: origin.x,
      y: origin.y,
      reach: model.feet / grid.feetPerCell,
      kind: "fixed",
      flame,
      height: TORCH_HEIGHT[torch.style],
      skip: 0,
      color: torch.color && torch.color !== "flame" ? TORCH_RGB[torch.color] : null,
      flicker: model.flicker,
      model: { style: torch.style, color: torchColorIndex(torch.color), x, y, cells, facing: torchFacing(torch) },
    };
  });
  const held = tokens
    .filter((token) => token.torch && token.pos)
    .map((token): LightSource => {
      const center = tokenCenter(token, grid);
      const offset = shift(token.id);
      return {
        id: token.id,
        x: (center.x - grid.offsetX) / grid.cellPx + offset.x,
        y: (center.y - grid.offsetY) / grid.cellPx + offset.y,
        reach: reach + center.span / 2,
        kind: "held",
        // acima da cabeça, no centro: o token não faz sombra da própria tocha
        height: TOKEN_HEIGHT[token.size ?? "medium"] + HELD_TORCH_ABOVE,
        skip: center.span / 2,
        color: null,
        flicker: "fire",
      };
    });
  return [...fixed, ...held];
}
