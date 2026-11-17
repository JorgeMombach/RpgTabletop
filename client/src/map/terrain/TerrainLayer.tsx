import { TERRAIN_CHUNK_CELLS, type MapConfig, type TerrainChunks, type TerrainId } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { Group, Image as KImage } from "react-konva";
import { useApp } from "../../store";
import { renderChunk } from "./renderChunk";
import { loadTerrainImages } from "./terrainArt";

/** Tempo de desenho de pedaços por quadro: abrir um mapa grande vai aparecendo aos poucos, sem travar a tela. */
const FRAME_BUDGET_MS = 10;

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;

/**
 * O pedaço e os que leem a borda dele: cada pedaço lê a primeira coluna do vizinho da direita, a primeira linha do
 * de baixo e o canto; então quem lê este são o da esquerda, o de cima e o da diagonal de cima à esquerda.
 */
function around(key: string): string[] {
  const [cx, cy] = key.split(",").map(Number);
  const out: string[] = [];
  for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) out.push(`${cx + dx},${cy + dy}`);
  return out;
}

/**
 * Terreno pintado (criação de mapa): acima da imagem do mapa e abaixo do grid. Cada pedaço vira uma imagem pronta
 * uma vez; quando chegam pedaços novos, só eles (e os vizinhos, pela borda) são refeitos. A fila anda alguns pedaços
 * por quadro, os mais perto do centro da tela primeiro. Com `draft` (o mestre arrastando o pincel), os pedaços saem
 * com metade dos pixels, para a prévia acompanhar o mouse; ao soltar, os mesmos pedaços chegam do servidor e são
 * refeitos inteiros.
 */
/** Água desenhada pelo WebGL (água animada): o terreno deixa a aquarela dela de fora. */
const WATER_TERRAINS: ReadonlySet<TerrainId> = new Set<TerrainId>(["water", "waterDark"]);

export function TerrainLayer({ chunks, grid, pixelsPerCell, epoch, draft = false, hideWater = false }: { chunks: TerrainChunks; grid: Grid; pixelsPerCell: number; epoch: number; draft?: boolean; hideWater?: boolean }) {
  const [images, setImages] = useState<Record<string, HTMLImageElement> | null>(null);
  const [, setDrawn] = useState(0);
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const queue = useRef(new Set<string>());
  const previous = useRef<{ chunks: TerrainChunks; pixelsPerCell: number; epoch: number; hideWater: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    loadTerrainImages()
      .then((loaded) => alive && setImages(loaded))
      .catch(() => {
        // Sem as aquarelas o terreno não aparece; o resto do mapa segue normal.
      });
    return () => {
      alive = false;
    };
  }, []);

  // O que mudou desde a última vez entra na fila (com os vizinhos); o que sumiu sai do cache. Terreno inteiro novo
  // (`epoch`: outra cena, arquivo carregado) começa do zero: o pedaço velho não fica à mostra enquanto a fila anda.
  useEffect(() => {
    const before = previous.current;
    const everything = !before || before.pixelsPerCell !== pixelsPerCell || before.epoch !== epoch || before.hideWater !== hideWater;
    if (everything) cache.current.clear();
    const changed = new Set<string>();
    for (const key of Object.keys(chunks)) if (everything || before.chunks[key] !== chunks[key]) changed.add(key);
    if (before && !everything) for (const key of Object.keys(before.chunks)) if (!(key in chunks)) changed.add(key);
    for (const key of changed) {
      for (const near of around(key)) {
        if (chunks[near]) queue.current.add(near);
        else cache.current.delete(near);
      }
    }
    previous.current = { chunks, pixelsPerCell, epoch, hideWater };
    setDrawn((n) => n + 1);
  }, [chunks, pixelsPerCell, epoch, hideWater]);

  // A fila: alguns pedaços por quadro, os mais perto do centro da tela primeiro.
  useEffect(() => {
    if (!images) return;
    let frame = 0;
    const step = () => {
      if (queue.current.size === 0) return;
      const { viewCenter } = useApp.getState();
      const chunkPx = TERRAIN_CHUNK_CELLS * grid.cellPx;
      const distance = (key: string) => {
        const [cx, cy] = key.split(",").map(Number);
        return Math.hypot(grid.offsetX + (cx + 0.5) * chunkPx - viewCenter.x, grid.offsetY + (cy + 0.5) * chunkPx - viewCenter.y);
      };
      const ordered = [...queue.current].sort((a, b) => distance(a) - distance(b));
      const start = performance.now();
      const current = previous.current?.chunks ?? {};
      for (const key of ordered) {
        queue.current.delete(key);
        if (current[key]) cache.current.set(key, renderChunk(key, current, images, draft ? pixelsPerCell / 2 : pixelsPerCell, hideWater && !draft ? WATER_TERRAINS : undefined));
        if (performance.now() - start > FRAME_BUDGET_MS) break;
      }
      setDrawn((n) => n + 1);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [images, chunks, pixelsPerCell, draft, hideWater, grid.cellPx, grid.offsetX, grid.offsetY]);

  const chunkPx = TERRAIN_CHUNK_CELLS * grid.cellPx;
  return (
    <Group listening={false}>
      {[...cache.current].map(([key, canvas]) => {
        const [cx, cy] = key.split(",").map(Number);
        return <KImage key={key} image={canvas} x={grid.offsetX + cx * chunkPx} y={grid.offsetY + cy * chunkPx} width={chunkPx} height={chunkPx} />;
      })}
    </Group>
  );
}
