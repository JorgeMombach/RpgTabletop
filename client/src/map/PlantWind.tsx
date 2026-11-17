import Konva from "konva";
import { useEffect, useRef, type RefObject } from "react";
import { Group, Image as KImage, Shape } from "react-konva";
import {
  FrameWatch,
  gust,
  windOf,
  type MapConfig,
  type MapProp,
  type WeatherState,
} from "@rpg/shared";
import { useApp } from "../store";
import { PROP_EXTENT, type Glint, type PlantLayers } from "./propArt";

/**
 * Vento nas plantas (docs/design/vento.md): a planta vira um grupo com a copa de baixo (com a sombra) e a de cima, e um
 * relógio por camada de objetos mexe as três. O grupo não gira (o vento é do mapa); cada imagem gira com o objeto.
 */

/** O que o relógio precisa de cada planta: os nós e onde ela está (casas), sem procurar no palco a cada quadro. */
export interface PlantEntry {
  group: Konva.Group;
  low: Konva.Image;
  high: Konva.Image;
  /** Só existe se a planta tem folhas que piscam. */
  glints: Konva.Shape | null;
  col: number;
  row: number;
  seed: number;
  /** Pixels do mapa por casa desta planta (já com o tamanho do objeto). */
  cellPx: number;
  rotation: number;
  /** Rajada do último quadro: as folhas que piscam brilham mais na rajada. */
  gust: number;
}

export type PlantRegistry = Map<string, PlantEntry>;

/** Cor das folhas que viram para a luz (a do teste aprovado). */
const GLINT_COLOR = "#b5dc78";
/** Quadros do vento: no máximo 30 por segundo. */
const FRAME_MS = 33;
/** Folga (em casas do mapa) em volta da tela: a planta que entra já chega balançando. */
const VIEW_MARGIN_CELLS = 2;
/** Casa menor que isso na tela: o balanço some (menos de meio pixel), então nem redesenha. */
const MIN_CELL_ON_SCREEN = 20;

/** Uma planta balançando. Só aparece com vento ligado; em edição o mapa usa o objeto parado de sempre. */
export function PlantNode({
  p,
  grid,
  layers,
  faded,
  registry,
  time,
}: {
  p: MapProp;
  grid: MapConfig;
  layers: PlantLayers;
  faded: boolean;
  registry: PlantRegistry;
  time: RefObject<number>;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const lowRef = useRef<Konva.Image>(null);
  const highRef = useRef<Konva.Image>(null);
  const glintRef = useRef<Konva.Shape>(null);
  const cellPx = grid.cellPx * p.size;
  const side = PROP_EXTENT[p.kind] * 2 * cellPx;
  const x = grid.offsetX + p.col * grid.cellPx;
  const y = grid.offsetY + p.row * grid.cellPx;

  useEffect(() => {
    const group = groupRef.current;
    const low = lowRef.current;
    const high = highRef.current;
    if (!group || !low || !high) return;
    registry.set(p.id, {
      group,
      low,
      high,
      glints: glintRef.current,
      col: p.col,
      row: p.row,
      seed: p.seed % 1000,
      cellPx,
      rotation: p.rotation,
      gust: 0,
    });
    return () => {
      registry.delete(p.id);
    };
  }, [registry, p.id, p.col, p.row, p.seed, p.rotation, cellPx, layers]);

  const imageProps = {
    width: side,
    height: side,
    offsetX: side / 2,
    offsetY: side / 2,
    rotation: p.rotation,
    perfectDrawEnabled: false,
    listening: false,
  };
  // As folhas estão em pixels da imagem guardada: a mesma escala e o mesmo centro da copa de cima.
  const glintScale = side / layers.high.width;
  return (
    <Group
      ref={groupRef}
      id={`prop-${p.id}`}
      x={x}
      y={y}
      opacity={faded ? 0.45 : 1}
      listening={false}
    >
      <KImage ref={lowRef} image={layers.low} {...imageProps} />
      <KImage ref={highRef} image={layers.high} {...imageProps} />
      {layers.glints.length > 0 && (
        <Shape
          ref={glintRef}
          rotation={p.rotation}
          scaleX={glintScale}
          scaleY={glintScale}
          listening={false}
          perfectDrawEnabled={false}
          sceneFunc={(ctx) =>
            drawGlints(
              ctx._context,
              layers.glints,
              time.current ?? 0,
              registry.get(p.id)?.gust ?? 0,
            )
          }
        />
      )}
    </Group>
  );
}

/** Folhas que viram para a luz e voltam: piscam mais quando a rajada está forte. */
function drawGlints(
  ctx: CanvasRenderingContext2D,
  glints: Glint[],
  t: number,
  gustNow: number,
) {
  ctx.fillStyle = GLINT_COLOR;
  for (const glint of glints) {
    const pulse = Math.max(0, Math.sin(t * glint.speed + glint.phase));
    const alpha = pulse ** 6 * (0.35 + Math.abs(gustNow) * 0.5);
    if (alpha < 0.01) continue;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.beginPath();
    ctx.ellipse(
      glint.x,
      glint.y,
      glint.width,
      glint.height,
      glint.turn + pulse * 0.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * O relógio do vento de uma camada de objetos: a 30 quadros por segundo, mexe só as plantas na tela (com folga);
 * sem nenhuma na tela, não redesenha. Cada quadro passa pelo detector: aparelho que não aguenta para o vento.
 */
export function useWindClock(
  layerRef: RefObject<Konva.Layer | null>,
  registry: PlantRegistry,
  time: RefObject<number>,
  weather: WeatherState | null,
  active: boolean,
) {
  useEffect(() => {
    const layer = layerRef.current;
    if (!active || !layer) return;
    const { strength, direction } = windOf(weather);
    const watch = new FrameWatch();
    let sinceDraw = FRAME_MS;
    const animation = new Konva.Animation((frame) => {
      if (!frame) return false;
      // Só conta quadros com a página à vista e em foco: janela de trás ou minimizada fica lenta sem o aparelho estar.
      const watching =
        document.visibilityState === "visible" && document.hasFocus();
      if (watching && !watch.tick(frame.timeDiff)) {
        useApp.setState({ windStalled: true });
        return false;
      }
      sinceDraw += frame.timeDiff;
      if (sinceDraw < FRAME_MS) return false;
      sinceDraw = 0;
      const t = frame.time / 1000;
      time.current = t;
      const stage = layer.getStage();
      const scale = stage.scaleX() || 1;
      const left = -stage.x() / scale;
      const top = -stage.y() / scale;
      const right = left + stage.width() / scale;
      const bottom = top + stage.height() / scale;
      let visible = 0;
      for (const plant of registry.values()) {
        if (plant.cellPx * scale < MIN_CELL_ON_SCREEN) continue;
        const margin = plant.cellPx * (VIEW_MARGIN_CELLS + 2);
        const x = plant.group.x();
        const y = plant.group.y();
        if (
          x < left - margin ||
          x > right + margin ||
          y < top - margin ||
          y > bottom + margin
        )
          continue;
        visible++;
        const low =
          gust(t, plant.col, plant.row, plant.seed, direction) * strength;
        const high =
          gust(t - 0.25, plant.col, plant.row, plant.seed, direction) *
          strength;
        plant.gust = low;
        const unit = plant.cellPx;
        // Deslocamentos em casas (os do teste aprovado), no sentido do vento; o giro soma ao do objeto.
        place(
          plant.low,
          low * 0.035 * unit * direction,
          low * 0.012 * unit,
          plant.rotation + degrees(low * 0.018 * direction),
        );
        const highX = high * 0.06 * unit * direction;
        const highY = high * 0.021 * unit;
        const highTurn = plant.rotation + degrees(high * 0.03 * direction);
        place(plant.high, highX, highY, highTurn);
        if (plant.glints) place(plant.glints, highX, highY, highTurn);
      }
      return visible > 0;
    }, layer);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [layerRef, registry, time, weather, active]);
}

function place(node: Konva.Node, x: number, y: number, rotation: number) {
  node.x(x);
  node.y(y);
  node.rotation(rotation);
}

const degrees = (radians: number) => (radians * 180) / Math.PI;
