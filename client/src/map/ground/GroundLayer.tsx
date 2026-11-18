import type Konva from "konva";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Image as KImage, Layer } from "react-konva";
import { FrameWatch, reliefAffected, TERRAINS, type MapConfig, type MapProp, type ReliefChunks, type TerrainChunks, type WaterCurrent } from "@rpg/shared";
import { useApp } from "../../store";
import { detailTile, filteredWatercolor, loadTerrainImages, TERRAIN_ART, type DetailKind } from "../terrain/terrainArt";
import type { GroundView } from "./glKit";
import { GroundRenderer, TerrainTooLarge } from "./GroundRenderer";
import { notifyGroundDrawn, useGroundOutputs } from "./groundOutputs";
import type { LightingInput } from "./lightPass";
import type { ReliefJob, ReliefResult } from "./reliefTypes";
import { SCENE_LIGHT } from "./sceneLight";
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
function changedChunks<Chunk>(before: Record<string, Chunk>, after: Record<string, Chunk>): string[] {
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
  lighting,
  relief,
  reliefEpoch,
  smallScreen,
}: {
  /** Tela pequena (celular, tablet): o relevo guardado começa com menos detalhe (vale ao criar o motor). */
  smallScreen: boolean;
  /** Relevo a desenhar (com a prévia da pincelada, se houver). */
  relief: ReliefChunks;
  /** Sobe a cada relevo inteiro novo (outra cena, arquivo carregado). */
  reliefEpoch: number;
  /** Paredes, luzes e luz da cena (docs/design/luz.md); `null` = sem luz na placa (fica a película de antes). */
  lighting: LightingInput | null;
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
  const [engine, setEngine] = useState<{ renderer: GroundRenderer; worker: Worker; reliefWorker: Worker } | null>(null);
  const renderer = engine?.renderer ?? null;
  const worker = engine?.worker ?? null;
  const reliefWorker = engine?.reliefWorker ?? null;
  const reliefJob = useRef(0);
  const reliefSent = useRef<{ chunks: ReliefChunks; epoch: number } | null>(null);
  const smallScreenRef = useRef(smallScreen);
  smallScreenRef.current = smallScreen;
  const imageRef = useRef<Konva.Image>(null);
  const [version, setVersion] = useState(0);
  // Sobe quando o navegador devolve o contexto WebGL perdido: o motor é refeito do zero.
  const [generation, setGeneration] = useState(0);
  const jobId = useRef(0);
  const uploaded = useRef<{ chunks: TerrainChunks; epoch: number } | null>(null);
  // Água pedida ao Worker e ainda não chegou: o terreno mostra a aquarela da água (sem buraco ao soltar o pincel).
  const [waterPending, setWaterPending] = useState(true);
  // O chão desligou por terreno grande demais (não por falha do WebGL): volta sozinho se o terreno passar a caber.
  const tooLarge = useRef(false);

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
      created = new GroundRenderer(canvas, smallScreenRef.current);
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
      setWaterPending(false);
      setVersion((value) => value + 1);
    };
    createdWorker.onerror = fail;
    // Relevo: a altura de cada pedaço é calculada no Worker (7 a ~35 ms por pedaço).
    const createdReliefWorker = new Worker(new URL("./reliefWorker.ts", import.meta.url), { type: "module" });
    createdReliefWorker.onmessage = (event: MessageEvent<ReliefResult>) => {
      if (event.data.id !== reliefJob.current) return;
      created.setReliefWindows(event.data.windows);
      setVersion((value) => value + 1);
    };
    createdReliefWorker.onerror = fail;
    reliefSent.current = null;
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
    useGroundOutputs.setState({ light: created.lightImage, flame: created.flameImage });
    // Motor novo, sem água: a próxima conta deixa a água pendente de novo (aquarela até chegar).
    lastCommitted.current = null;
    useApp.setState({ groundFailed: false });
    setEngine({ renderer: created, worker: createdWorker, reliefWorker: createdReliefWorker });
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      createdWorker.terminate();
      createdReliefWorker.terminate();
      created.dispose();
      useGroundOutputs.setState({ light: null, flame: null });
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
      // Depois de terreno grande demais, tenta de novo do zero (pode ter diminuído).
      renderer.setTerrain(chunks, !before || before.epoch !== epoch || tooLarge.current ? "all" : changedChunks(before.chunks, chunks));
    } catch (error) {
      tooLarge.current = error instanceof TerrainTooLarge;
      useApp.setState({ groundFailed: true });
      return;
    }
    if (tooLarge.current) {
      tooLarge.current = false;
      useApp.setState({ groundFailed: false });
    }
    uploaded.current = { chunks, epoch };
    setVersion((value) => value + 1);
  }, [renderer, chunks, epoch]);

  // Relevo: pede ao Worker a altura dos pedaços afetados pelo que mudou (relevo inteiro novo: todos, do zero).
  useEffect(() => {
    if (!renderer || !reliefWorker) return;
    const before = reliefSent.current;
    const fresh = !before || before.epoch !== reliefEpoch;
    if (fresh) renderer.forgetRelief("all");
    const changed = fresh ? Object.keys(relief) : changedChunks(before.chunks, relief);
    reliefSent.current = { chunks: relief, epoch: reliefEpoch };
    if (changed.length === 0) return;
    reliefJob.current += 1;
    const job: ReliefJob = { id: reliefJob.current, chunks: relief, keys: reliefAffected(changed) };
    reliefWorker.postMessage(job);
  }, [renderer, reliefWorker, relief, reliefEpoch]);

  // Água: as contas no Worker, só com o terreno confirmado (a prévia do pincel não conta).
  const lastCommitted = useRef<TerrainChunks | null>(null);
  useEffect(() => {
    if (!worker) return;
    // Só a forma da água (o terreno) deixa a água pendente; correnteza e pedras não mudam onde há água.
    if (lastCommitted.current !== committed) {
      lastCommitted.current = committed;
      setWaterPending(true);
    }
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
  const waterDraft = draft || waterPending;
  const waterDraftRef = useRef(waterDraft);
  waterDraftRef.current = waterDraft;
  // Tempo da água: contínuo (não volta a zero quando algo muda); parada, fica no último instante.
  const timeRef = useRef(performance.now() / 1000);
  const reduceFx = useApp((state) => state.reduceFx);
  const windStalled = useApp((state) => state.windStalled);
  const groundFailed = useApp((state) => state.groundFailed);
  const animate = !reduceFx && !windStalled;

  // Luz: paredes, tochas e luz da cena (a geometria só é refeita, e o chão redesenhado, quando algo muda de fato).
  useEffect(() => {
    if (!renderer || !lighting) return;
    if (renderer.setLighting(lighting, animate)) setVersion((value) => value + 1);
  }, [renderer, lighting, animate]);

  // Sombra do relevo: segue a luz da cena (sem luz na placa, fica a de dia).
  const sceneId = lighting?.scene ?? "day";
  useEffect(() => {
    if (!renderer) return;
    renderer.setReliefSun(SCENE_LIGHT[sceneId]);
    setVersion((value) => value + 1);
  }, [renderer, sceneId]);

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
      // Anima com água na tela, com tocha tremulando ou com a luz da cena ainda trocando.
      if (now - lastDraw < FRAME_MS || !(renderer.visibleWater(viewRef.current) || renderer.flickering || renderer.reliefPending)) return;
      lastDraw = now;
      timeRef.current = now / 1000;
      renderer.render(viewRef.current, timeRef.current, { waterDraft: waterDraftRef.current });
      imageRef.current?.getLayer()?.batchDraw();
      notifyGroundDrawn();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [renderer, animate]);

  // Quadro na hora: quando a visão, o tamanho, o terreno ou a água mudam (com a água parada, é o único desenho).
  useEffect(() => {
    if (!renderer) return;
    renderer.render(groundView, timeRef.current, { waterDraft });
    imageRef.current?.getLayer()?.batchDraw();
    notifyGroundDrawn();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groundView é refeito a cada render a partir destes valores
  }, [renderer, version, waterDraft, view.x, view.y, view.scale, size.width, size.height, grid.cellPx, grid.offsetX, grid.offsetY]);

  if (!renderer || renderer.empty || groundFailed) return null;
  return (
    <Layer listening={false}>
      <KImage ref={imageRef} image={renderer.groundImage} x={-view.x / view.scale} y={-view.y / view.scale} width={size.width / view.scale} height={size.height / view.scale} />
    </Layer>
  );
});
