import {
  decodeLayer,
  FLOOR_MATERIALS,
  TERRAIN_CHUNK_SIDE,
  TERRAIN_FINE,
  type FloorChunks,
  type MapConfig,
} from "@rpg/shared";
import { useMemo } from "react";
import { Shape as KShape } from "react-konva";
import { FLOOR_FLAT_COLOR } from "./floorArt";

/**
 * Pisos sem WebGL 2 (docs/design/pisos.md): cada ponto fino com piso vira um quadradinho de 1/4 de casa na cor
 * chapada do material, para o mestre não perder o piso. Cada pedaço é uma imagem guardada (um pixel por ponto),
 * esticada sem suavizar.
 */
export function FloorLayer({
  chunks,
  grid,
}: {
  chunks: FloorChunks;
  grid: Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;
}) {
  const images = useMemo(() => {
    const out: { canvas: HTMLCanvasElement; cx: number; cy: number }[] = [];
    for (const [key, text] of Object.entries(chunks)) {
      const bytes = decodeLayer(text);
      if (!bytes) continue;
      const canvas = document.createElement("canvas");
      canvas.width = TERRAIN_CHUNK_SIDE;
      canvas.height = TERRAIN_CHUNK_SIDE;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      for (let index = 0; index < bytes.length; index++) {
        const material = FLOOR_MATERIALS[(bytes[index] & 15) - 1];
        if (!material) continue;
        ctx.fillStyle = FLOOR_FLAT_COLOR[material];
        ctx.fillRect(
          index % TERRAIN_CHUNK_SIDE,
          Math.floor(index / TERRAIN_CHUNK_SIDE),
          1,
          1,
        );
      }
      const [cx, cy] = key.split(",").map(Number);
      out.push({ canvas, cx, cy });
    }
    return out;
  }, [chunks]);

  // Cada ponto fino é o centro do seu quadradinho: a imagem começa meio ponto antes do canto do pedaço.
  const point = grid.cellPx / TERRAIN_FINE;
  return (
    <KShape
      listening={false}
      sceneFunc={(konvaContext) => {
        const ctx = konvaContext._context;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const { canvas, cx, cy } of images) {
          const x = grid.offsetX + cx * TERRAIN_CHUNK_SIDE * point - point / 2;
          const y = grid.offsetY + cy * TERRAIN_CHUNK_SIDE * point - point / 2;
          ctx.drawImage(
            canvas,
            x,
            y,
            TERRAIN_CHUNK_SIDE * point,
            TERRAIN_CHUNK_SIDE * point,
          );
        }
        ctx.restore();
      }}
    />
  );
}
