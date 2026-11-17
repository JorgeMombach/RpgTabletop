import type Konva from "konva";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Image as KImage, Layer } from "react-konva";
import { FrameWatch, type MapConfig, type MapProp, type TerrainChunks, type WaterCurrent } from "@rpg/shared";
import { useApp } from "../../store";
import { WaterRenderer, type WaterView } from "./WaterRenderer";
import type { WaterJob, WaterResult, WaterRock } from "./waterTypes";

/**
 * Água animada (docs/design/agua.md) no mapa: uma camada própria entre o terreno e o grid. As contas vão para um
 * Worker quando a água pintada, as linhas de correnteza ou as pedras mudam; o renderizador WebGL desenha num canvas do
 * tamanho da tela, que aparece aqui como uma imagem presa à tela (desfaz o pan e o zoom do palco).
 */

/** Pixels por casa das contas da água (distância e rio). */
const PER_CELL = 20;
/** Quadros da água: no máximo 30 por segundo. */
const FRAME_MS = 33;
/** Espera depois da última mudança antes de recalcular (o mestre pintando em sequência). */
const SETTLE_MS = 150;

/** Objetos que viram pedra no rio, e o raio (em casas, no tamanho 1). */
const ROCK_RADIUS: Partial<Record<MapProp["kind"], number>> = { stones: 0.3, boulder: 0.4 };

let dirtImage: Promise<HTMLImageElement> | null = null;
function loadDirt(): Promise<HTMLImageElement> {
  dirtImage ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "/terreno/dirt_01.webp";
  });
  return dirtImage;
}

interface StageView {
  x: number;
  y: number;
  scale: number;
}

export const WaterLayer = memo(function WaterLayer({
  chunks,
  currents,
  props,
  grid,
  view,
  size,
}: {
  chunks: TerrainChunks;
  currents: WaterCurrent[];
  props: MapProp[];
  grid: Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;
  view: StageView;
  size: { width: number; height: number };
}) {
  // Canvas, renderizador e Worker nascem e morrem juntos, dentro do efeito (no modo estrito do React o efeito roda,
  // limpa e roda de novo: cada vez com os seus).
  const [engine, setEngine] = useState<{ renderer: WaterRenderer; worker: Worker } | null>(null);
  const renderer = engine?.renderer ?? null;
  const worker = engine?.worker ?? null;
  const imageRef = useRef<Konva.Image>(null);
  const [version, setVersion] = useState(0);
  const jobId = useRef(0);

  // Pedras: só os objetos que podem virar pedra; a lista só muda quando uma delas muda.
  const rocksKey = props
    .filter((prop) => ROCK_RADIUS[prop.kind])
    .map((prop) => `${prop.col},${prop.row},${prop.size},${prop.kind}`)
    .join("|");
  const rocks = useMemo<WaterRock[]>(
    () => props.filter((prop) => ROCK_RADIUS[prop.kind]).map((prop) => ({ col: prop.col, row: prop.row, radius: (ROCK_RADIUS[prop.kind] ?? 0) * prop.size })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave já resume o que importa das pedras
    [rocksKey],
  );

  useEffect(() => {
    if (!WaterRenderer.supported()) return;
    const created = new WaterRenderer(document.createElement("canvas"));
    const createdWorker = new Worker(new URL("./waterWorker.ts", import.meta.url), { type: "module" });
    createdWorker.onmessage = (event: MessageEvent<WaterResult>) => {
      // Resposta de um pedido que já foi substituído: ignora.
      if (event.data.id !== jobId.current) return;
      created.setFields(event.data.fields);
      setVersion((value) => value + 1);
    };
    setEngine({ renderer: created, worker: createdWorker });
    return () => {
      createdWorker.terminate();
      created.dispose();
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    if (!renderer) return;
    let alive = true;
    loadDirt()
      .then((image) => {
        if (!alive) return;
        renderer.setDirt(image);
        setVersion((value) => value + 1);
      })
      .catch(() => {
        // Sem a aquarela de terra o barranco não sai; a água continua sem ele.
      });
    return () => {
      alive = false;
    };
  }, [renderer]);

  useEffect(() => {
    if (!worker) return;
    const timer = window.setTimeout(() => {
      jobId.current += 1;
      const job: WaterJob = { id: jobId.current, chunks, currents, rocks, perCell: PER_CELL };
      worker.postMessage(job);
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [worker, chunks, currents, rocks]);

  const waterView: WaterView = {
    offsetX: grid.offsetX,
    offsetY: grid.offsetY,
    cellPx: grid.cellPx,
    stageX: view.x,
    stageY: view.y,
    scale: view.scale,
    width: size.width,
    height: size.height,
    pixelRatio: window.devicePixelRatio || 1,
  };

  const viewRef = useRef(waterView);
  viewRef.current = waterView;
  // Tempo da água: contínuo (não volta a zero quando algo muda); parada, fica no último instante.
  const timeRef = useRef(performance.now() / 1000);
  const reduceFx = useApp((state) => state.reduceFx);
  const windStalled = useApp((state) => state.windStalled);
  const animate = !reduceFx && !windStalled;

  // Relógio da água: no máximo 30 quadros por segundo, só com água na tela. Cada quadro passa pelo detector (o mesmo
  // do vento): aparelho que não aguenta para a água e as plantas. Aba oculta: o navegador já pausa.
  useEffect(() => {
    if (!renderer || !animate) return;
    const watch = new FrameWatch();
    let frame = 0;
    let previous = performance.now();
    let lastDraw = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = now - previous;
      previous = now;
      const watching = document.visibilityState === "visible" && document.hasFocus();
      if (watching && !watch.tick(elapsed)) {
        useApp.setState({ windStalled: true });
        return;
      }
      if (now - lastDraw < FRAME_MS || renderer.empty || !renderer.visible(viewRef.current)) return;
      lastDraw = now;
      timeRef.current = now / 1000;
      renderer.render(viewRef.current, timeRef.current);
      imageRef.current?.getLayer()?.batchDraw();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [renderer, animate]);

  // Quadro na hora: quando a visão, o tamanho ou a água mudam (com a água parada, é o único desenho).
  useEffect(() => {
    if (!renderer) return;
    renderer.render(waterView, timeRef.current);
    imageRef.current?.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- waterView é refeito a cada render a partir destes valores
  }, [renderer, version, view.x, view.y, view.scale, size.width, size.height, grid.cellPx, grid.offsetX, grid.offsetY]);

  if (!renderer || renderer.empty) return null;
  return (
    <Layer listening={false}>
      <KImage ref={imageRef} image={renderer.canvas} x={-view.x / view.scale} y={-view.y / view.scale} width={size.width / view.scale} height={size.height / view.scale} />
    </Layer>
  );
});
