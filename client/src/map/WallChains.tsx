import { wallChains, type MapConfig, type Wall, type WallStyle } from "@rpg/shared";
import { useMemo } from "react";
import { Shape as KShape } from "react-konva";
import { chainArt, type StripImage } from "./wallChainArt";

/**
 * Paredes emendadas no mapa (docs/design/paredes.md): um desenho só, sem cliques (cada parede continua com a sua
 * área de clique em `WallShape`). Primeiro a tinta de todas as cadeias, depois o corpo de todas: as emendas somem.
 * `walls` já vem com o desenho de cada uma resolvido (inclusive a prévia de *Trocar desenho*).
 */
export function WallChains({ walls, grid, sceneStyle }: { walls: Wall[]; grid: MapConfig; sceneStyle: WallStyle }) {
  const chains = useMemo(() => wallChains(walls, sceneStyle), [walls, sceneStyle]);
  return (
    <KShape
      listening={false}
      sceneFunc={(konvaContext) => {
        const ctx = konvaContext._context;
        const matrix = ctx.getTransform();
        const pxPerUnit = Math.hypot(matrix.a, matrix.b);
        // Só o que está na tela (o palco não gira: escala e deslocamento).
        const view = { x: -matrix.e / matrix.a, y: -matrix.f / matrix.d, width: ctx.canvas.width / matrix.a, height: ctx.canvas.height / matrix.d };
        const draw = (image: StripImage) => {
          const box = image.bounds;
          if (box.x > view.x + view.width || box.x + box.width < view.x || box.y > view.y + view.height || box.y + box.height < view.y) return;
          ctx.save();
          ctx.translate(image.x, image.y);
          ctx.rotate(image.angle);
          ctx.drawImage(image.canvas, image.left, image.top, image.width, image.height);
          ctx.restore();
        };
        const arts = chains.map((chain) => chainArt(chain, grid, pxPerUnit));
        for (const { ink } of arts) ink.forEach(draw);
        for (const { body } of arts) body.forEach(draw);
      }}
    />
  );
}
