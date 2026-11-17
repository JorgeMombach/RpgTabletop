import type Konva from "konva";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Image as KImage, Layer } from "react-konva";
import { FrameWatch, TERRAINS, type MapConfig, type MapProp, type TerrainChunks, type WaterCurrent } from "@rpg/shared";
import { useApp } from "../../store";
import { detailTile, filteredWatercolor, loadTerrainImages, TERRAIN_ART, type DetailKind } from "../terrain/terrainArt";
import type { GroundView } from "./glKit";
import { GroundRenderer } from "./GroundRenderer";
import type { WaterJob, WaterResult, WaterRock } from "./waterTypes";

/**
 * O chão do mapa (docs/design/renderizador-chao.md): terreno pintado e água animada num renderizador WebGL só, numa
 * camada própria entre a mesa/imagem e o grid. O canvas do tamanho da tela aparece aqui como uma imagem presa à tela
 * (desfaz o pan e o zoom do palco). O terreno sobe pedaço a pedaço quando muda (a passada do pincel aparece na hora);
 * as contas da água vão para um Worker quando a água pintada, as linhas de correnteza ou as pedras mudam.
 */

/** Pixels por casa das contas da água (distância e rio). */
const PER_CELL = 20;
/** Quadros da água: no máximo 30 por segundo. */
const FRAME_MS = 33;
/** Espera depois da última mudança antes de recalcular a água (o mestre pintando em sequência). */
const SETTLE_MS = 150;
/** Resolução dos ladrilhos de detalhe (px por casa). */
const DETAIL_PER_CELL = 40;

/** Objetos que viram pedra no rio, e o raio (em casas, no tamanho 1). */
const ROCK_RADIUS: Partial<Record<MapProp["kind"], number>> = { stones: 0.3, boulder: 0.4 };

interface StageView {
  x: number;
  y: number;
  scale: number;
}

/** Pedaços diferentes entre dois terrenos (o objeto do pedaço muda quando ele muda). */
function changedChunks(before: TerrainChunks, after: TerrainChunks): string[] {
  const keys = new Set<string>();
  for (const key of Object.keys(after)) if (before[key] !== after[key]) keys.add(key);
  for (const key of Object.keys(before)) if (!(key in after)) keys.add(key);
  return [...keys];
}

export const GroundLayer = memo(function GroundLayer({
  chunks,
  committed,
  draft,
  epoch,
  currents,
  props,
  grid,
  view,
  size,
}: {
  /** O terreno a desenhar (com a prévia da passada do pincel, se houver). */
  chunks: TerrainChunks;
  /** O terreno confirmado pelo servidor (o que a água usa). */
  committed: TerrainChunks;
  draft: boolean;
  /** Sobe a cada terreno inteiro novo (outra cena, arquivo carregado): tudo sobe de novo. */
  epoch: number;
  currents: WaterCurrent[];
  props: MapProp[];
  grid: Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;
  view: StageView;
  size: { width: number; height: number };
}) {
  // Canvas, renderizador e Worker nascem e morrem juntos, dentro do efeito (no modo estrito do React o efeito roda,
  // limpa e roda de novo: cada vez com os seus).
  const [engine, setEngine] = useState<{ renderer: GroundRenderer; worker: Worker } | null>(null);
  const renderer = engine?.renderer ?? null;
  const worker = engine?.worker ?? null;
  const imageRef = useRef<Konva.Image>(null);
  const [version, setVersion] = useState(0);
  // Sobe quando o navegador devolve o contexto WebGL perdido: o motor é refeito do zero.
  const [generation, setGeneration] = useState(0);
  const jobId = useRef(0);
  const uploaded = useRef<{ chunks: TerrainChunks; epoch: number } | null>(null);

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

  // Se o WebGL falha (shader que não compila, contexto recusado, terreno grande demais para as texturas do aparelho)
  // ou se perde (driver reiniciado, notebook acordando), `groundFailed` liga: o mapa volta ao desenho de antes.
  // Contexto devolvido: o motor volta.
  useEffect(() => {
    const fail = () => useApp.setState({ groundFailed: true });
    const canvas = document.createElement("canvas");
    let created: GroundRenderer;
    try {
      created = new GroundRenderer(canvas);
    } catch {
      fail();
      return;
    }
    const createdWorker = new Worker(new URL("./waterWorker.ts", import.meta.url), { type: "module" });
    createdWorker.onmessage = (event: MessageEvent<WaterResult>) => {
      // Resposta de um pedido que já foi substituído: ignora.
      if (event.data.id !== jobId.current) return;
      try {
        created.setWaterFields(event.data.fields);
      } catch {
        fail();
        return;
      }
      setVersion((value) => value + 1);
    };
    createdWorker.onerror = fail;
    const lost = (event: Event) => {
      // Sem isso o navegador nunca devolve o contexto.
      event.preventDefault();
      fail();
    };
    const restored = () => {
      useApp.setState({ groundFailed: false });
      setGeneration((value) => value + 1);
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    uploaded.current = null;
    useApp.setState({ groundFailed: false });
    setEngine({ renderer: created, worker: createdWorker });
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      createdWorker.terminate();
      created.dispose();
      setEngine(null);
    };
  }, [generation]);

  // Aquarelas (com o ajuste de cor), ladrilhos de detalhe e a terra do barranco: uma vez por motor.
  useEffect(() => {
    if (!renderer) return;
    let alive = true;
    loadTerrainImages()
      .then((images) => {
        if (!alive) return;
        const watercolors = TERRAINS.map((terrain) => filteredWatercolor(terrain, images[TERRAIN_ART[terrain].image]));
        const details: Record<DetailKind, HTMLCanvasElement> = {
          grass: detailTile("grass", DETAIL_PER_CELL),
          dirt: detailTile("dirt", DETAIL_PER_CELL),
          stone: detailTile("stone", DETAIL_PER_CELL),
          water: detailTile("water", DETAIL_PER_CELL),
        };
        renderer.setArt(watercolors, details, images.dirt_01);
        setVersion((value) => value + 1);
      })
      .catch(() => useApp.setState({ groundFailed: true }));
    return () => {
      alive = false;
    };
  }, [renderer]);

  // Terreno: sobe só o que mudou (terreno inteiro novo, tudo de novo).
  useEffect(() => {
    if (!renderer) return;
    const before = uploaded.current;
    try {
      renderer.setTerrain(chunks, !before || before.epoch !== epoch ? "all" : changedChunks(before.chunks, chunks));
    } catch {
      useApp.setState({ groundFailed: true });
      return;
    }
    uploaded.current = { chunks, epoch };
    setVersion((value) => value + 1);
  }, [renderer, chunks, epoch]);

  // Água: as contas no Worker, só com o terreno confirmado (a prévia do pincel não conta).
  useEffect(() => {
    if (!worker) return;
    const timer = window.setTimeout(() => {
      jobId.current += 1;
      const job: WaterJob = { id: jobId.current, chunks: committed, currents, rocks, perCell: PER_CELL };
      worker.postMessage(job);
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [worker, committed, currents, rocks]);

  const groundView: GroundView = {
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
  const viewRef = useRef(groundView);
  viewRef.current = groundView;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // Tempo da água: contínuo (não volta a zero quando algo muda); parada, fica no último instante.
  const timeRef = useRef(performance.now() / 1000);
  const reduceFx = useApp((state) => state.reduceFx);
  const windStalled = useApp((state) => state.windStalled);
  const groundFailed = useApp((state) => state.groundFailed);
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
      // Só conta quadros com a página à vista e em foco: janela de trás ou minimizada fica lenta sem o aparelho estar.
      const watching = document.visibilityState === "visible" && document.hasFocus();
      if (watching && !watch.tick(elapsed)) {
        useApp.setState({ windStalled: true });
        return;
      }
      if (now - lastDraw < FRAME_MS || !renderer.visibleWater(viewRef.current)) return;
      lastDraw = now;
      timeRef.current = now / 1000;
      renderer.render(viewRef.current, timeRef.current, { waterDraft: draftRef.current });
      imageRef.current?.getLayer()?.batchDraw();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [renderer, animate]);

  // Quadro na hora: quando a visão, o tamanho, o terreno ou a água mudam (com a água parada, é o único desenho).
  useEffect(() => {
    if (!renderer) return;
    renderer.render(groundView, timeRef.current, { waterDraft: draft });
    imageRef.current?.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groundView é refeito a cada render a partir destes valores
  }, [renderer, version, draft, view.x, view.y, view.scale, size.width, size.height, grid.cellPx, grid.offsetX, grid.offsetY]);

  if (!renderer || renderer.empty || groundFailed) return null;
  return (
    <Layer listening={false}>
      <KImage ref={imageRef} image={renderer.canvas} x={-view.x / view.scale} y={-view.y / view.scale} width={size.width / view.scale} height={size.height / view.scale} />
    </Layer>
  );
});
