import type Konva from "konva";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Image as KImage, Layer } from "react-konva";
import { duneMask, type Bridge, type Stair, type FloorChunks, reliefAffected, ReliefQueue, TERRAINS, wallPieces, type MapConfig, type MapProp, type ReliefChunks, type TerrainChunks, type Wall, type WallStyle, type WaterCurrent, type WeatherState, windOf } from "@rpg/shared";
import { useApp } from "../../store";
import { filteredWatercolor, loadTerrainImages, TERRAIN_ART } from "../terrain/terrainArt";
import type { GroundView } from "./glKit";
import { GroundRenderer, TerrainTooLarge } from "./GroundRenderer";
import { useWindStalled, watchFrame } from "../windStall";
import { usePropDrag } from "../props/propDrag";
import { useTokenDrag } from "../dragFollow";
import type { TokenCaster } from "./shadowCasters";
import { notifyEffectsDrawn, notifyFogDrawn, notifyGroundDrawn, notifyPropsDrawn, notifyWallsDrawn, notifyWeatherDrawn, setDrawnView, useDrawnBox, useGroundOutputs, type DrawnView } from "./groundOutputs";
import type { WeatherInput } from "../weather/weatherPass";
import type { FrameInput } from "./framePass";
import type { MapEffect } from "@rpg/shared";
import type { FogInput } from "./fogPass";
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
/**
 * Zoom provisório (docs/design/desempenho.md): durante o gesto as imagens prontas só esticam com o palco; o desenho
 * completo, na escala nova, sai este tempo depois do último passo.
 */
export const ZOOM_SETTLE_MS = 150;
/** Relevo vazio (a água sem mar não depende do relevo). */
const NO_RELIEF: ReliefChunks = {};
/** Espera depois do último traço de relevo antes de refazer a costa do mar (pintar relevo não refaz a água a cada traço). */
const SEA_RELIEF_SETTLE_MS = 600;
/** Folga do desenho no meio do afastamento: cobre 1,4× a tela (uns três passos da rodinha). */
const ZOOM_OUT_MARGIN = 1.4;

/** As imagens desenhadas na visão `drawn` cobrem a tela inteira na visão atual. */
function coversView(drawn: DrawnView, view: { x: number; y: number; scale: number }, size: { width: number; height: number }): boolean {
  const drawnLeft = -drawn.x / drawn.scale;
  const drawnTop = -drawn.y / drawn.scale;
  const left = -view.x / view.scale;
  const top = -view.y / view.scale;
  const slack = 0.5 / view.scale;
  return (
    drawnLeft <= left + slack &&
    drawnTop <= top + slack &&
    drawnLeft + drawn.width / drawn.scale >= left + size.width / view.scale - slack &&
    drawnTop + drawn.height / drawn.scale >= top + size.height / view.scale - slack
  );
}

/** A mesma tela numa escala `ZOOM_OUT_MARGIN` vezes menor, com o mesmo centro: a área desenhada fica maior. */
function widerView(view: GroundView): GroundView {
  const scale = view.scale / ZOOM_OUT_MARGIN;
  const centerX = (view.width / 2 - view.stageX) / view.scale;
  const centerY = (view.height / 2 - view.stageY) / view.scale;
  return { ...view, scale, stageX: view.width / 2 - centerX * scale, stageY: view.height / 2 - centerY * scale };
}
/** Espera depois da última mudança antes de recalcular a água (o mestre pintando em sequência). */
const SETTLE_MS = 150;

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
  walls,
  sceneStyle,
  gm,
  dust,
  floors,
  bridges,
  stairs,
  stairRelief,
  fadedProps,
  weather,
  tokenCasters,
  fog,
  effects,
  weatherInput,
  frameInput,
}: {
  /** Moldura da cena (docs/design/moldura.md); `null` = sem moldura. */
  frameInput: FrameInput | null;
  /** Clima vivendo no mapa (docs/design/clima.md); `null` = sem clima ou a película de hoje. */
  weatherInput: WeatherInput | null;
  /** Efeitos de área pela placa (docs/design/efeitos.md); `null` = desenhados pelo Konva. */
  effects: MapEffect[] | null;
  /** Névoa de guerra pela placa (docs/design/nevoa.md); `null` = desligada ou desenhada pelo Konva. */
  fog: FogInput | null;
  /** Tokens que fazem sombra (docs/design/sombras.md), em casas; o arrasto é aplicado aqui. */
  tokenCasters: TokenCaster[];
  /** Copas com token embaixo (docs/design/objetos.md): meio transparentes e paradas. */
  fadedProps: ReadonlySet<string>;
  /** Clima da cena: o vento nas plantas. */
  weather: WeatherState;
  /** Pontes da cena (docs/design/pontes.md). */
  bridges: Bridge[];
  /** Escadas da cena (docs/design/escadas.md). */
  stairs: Stair[];
  /**
   * Relevo confirmado, sem a prévia da pincelada: o perfil das escadas é refeito só quando ele muda (a conta da altura
   * roda no processador; a cada movimento do pincel travaria).
   */
  stairRelief: ReliefChunks;
  /** Piso da cena (com a prévia da passada, se houver). */
  floors: FloorChunks;
  /** Vento do clima para a poeira das dunas: 0 = nada, 1 = vento, 2 = tempestade de areia; direção 1 = direita. */
  dust: { level: 0 | 1 | 2; direction: 1 | -1 };
  /** Paredes, portas e janelas (com a prévia de *Trocar desenho* já aplicada): desenhadas na placa de vídeo. */
  walls: Wall[];
  sceneStyle: WallStyle;
  /** Mestre vê a marca de trancada e de secreta. */
  gm: boolean;
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
  grid: Pick<MapConfig, "cellPx" | "offsetX" | "offsetY" | "feetPerCell" | "grid">;
  view: StageView;
  size: { width: number; height: number };
}) {
  // Canvas, renderizador e Worker nascem e morrem juntos, dentro do efeito (no modo estrito do React o efeito roda,
  // limpa e roda de novo: cada vez com os seus).
  const [engine, setEngine] = useState<{ renderer: GroundRenderer; worker: Worker; reliefWorker: Worker } | null>(null);
  const renderer = engine?.renderer ?? null;
  const worker = engine?.worker ?? null;
  const reliefWorker = engine?.reliefWorker ?? null;
  // Relevo: um pedido ao Worker por vez (o que muda durante ele vai junto no próximo), sempre com o relevo mais novo.
  const reliefQueue = useRef(new ReliefQueue());
  const reliefLatest = useRef(relief);
  reliefLatest.current = relief;
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
  const waterPendingRef = useRef(waterPending);
  waterPendingRef.current = waterPending;
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
    const queue = new ReliefQueue();
    reliefQueue.current = queue;
    createdReliefWorker.onmessage = (event: MessageEvent<ReliefResult>) => {
      // Resposta de antes de recomeçar (outra cena, aplainar tudo): não vale, mas destrava o próximo pedido.
      if (queue.accept(event.data.id)) created.setReliefWindows(event.data.windows);
      sendRelief(createdReliefWorker, queue);
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
    useGroundOutputs.setState({ light: created.lightImage, flame: created.flameImage, walls: created.wallImage, propsBelow: created.propsBelowImage, propsAbove: created.propsAboveImage, fog: created.fogImage, fogTint: created.fogTintImage, effects: created.effectsImage, weatherGround: created.weatherGroundImage, weatherAir: created.weatherAirImage, weatherGlow: created.weatherGlowImage, frame: created.frameImage, propIcon: (kind, side) => created.propIcon(kind, side) });
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
      useGroundOutputs.setState({ light: null, flame: null, walls: null, propsBelow: null, propsAbove: null, fog: null, fogTint: null, effects: null, weatherGround: null, weatherAir: null, weatherGlow: null, frame: null, drawnView: null, propIcon: null });
      setEngine(null);
    };
  }, [generation]);

  // Aquarelas (com o ajuste de cor), ladrilhos de detalhe e a terra do barranco: uma vez por motor.
  useEffect(() => {
    if (!renderer) return;
    let alive = true;
    let attempt = 0;
    let retry = 0;
    // As aquarelas: se falharem (rede caiu, servidor reiniciando), tenta de novo duas vezes antes de desligar o chão.
    const load = () =>
      loadTerrainImages()
        .then((images) => {
          if (!alive) return;
          const watercolors = TERRAINS.map((terrain) => filteredWatercolor(terrain, images[TERRAIN_ART[terrain].image]));
          renderer.setArt(watercolors, images.dirt_01);
          setVersion((value) => value + 1);
        })
        .catch(() => {
          if (!alive) return;
          attempt++;
          if (attempt < 3) retry = window.setTimeout(load, 2000);
          else useApp.setState({ groundFailed: true });
        });
    load();
    return () => {
      alive = false;
      window.clearTimeout(retry);
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

  /** Manda o próximo pedido da fila (se não há um em andamento), com o relevo mais novo. */
  function sendRelief(target: Worker, queue: ReliefQueue) {
    const next = queue.take();
    if (!next) return;
    const job: ReliefJob = { id: next.id, chunks: reliefLatest.current, keys: next.keys };
    target.postMessage(job);
  }

  // Relevo: marca os pedaços afetados pelo que mudou (relevo inteiro novo: recomeça do zero e redesenha na hora).
  useEffect(() => {
    if (!renderer || !reliefWorker) return;
    const queue = reliefQueue.current;
    const before = reliefSent.current;
    const fresh = !before || before.epoch !== reliefEpoch;
    if (fresh) {
      queue.reset();
      renderer.forgetRelief("all");
      setVersion((value) => value + 1);
    }
    const changed = fresh ? Object.keys(relief) : changedChunks(before.chunks, relief);
    reliefSent.current = { chunks: relief, epoch: reliefEpoch };
    if (changed.length > 0) queue.mark(reliefAffected(changed));
    sendRelief(reliefWorker, queue);
  }, [renderer, reliefWorker, relief, reliefEpoch]);

  // Paredes: peças novas a cada mudança (porta aberta, desenho trocado, parede nova); a camada é refeita no desenho.
  const pieces = useMemo(() => wallPieces(walls, sceneStyle, { gm }), [walls, sceneStyle, gm]);
  useEffect(() => {
    if (!renderer) return;
    renderer.setWalls(pieces);
    setVersion((value) => value + 1);
  }, [renderer, pieces]);

  // Pré-compilar o que a ferramenta escolhida vai desenhar (a primeira compilação trava a placa um instante): ao
  // escolher o desenho de parede, o material de piso ou o terreno do pincel, não no meio do traço.
  const tool = useApp((state) => state.tool);
  const wallDrawStyle = useApp((state) => state.wallDrawStyle);
  const floorMaterial = useApp((state) => state.floorBrush.material);
  const bridgeKind = useApp((state) => state.bridgeBrush.kind);
  const stairShape = useApp((state) => state.stairBrush.shape);
  const brushTerrain = useApp((state) => TERRAINS.find((terrain) => terrain === state.terrainBrush.terrain));
  useEffect(() => {
    if (!renderer) return;
    if (tool === "walls") renderer.warm({ wall: wallDrawStyle ?? sceneStyle });
    if (tool === "walls") renderer.warm({ wall: "opening" });
    if (tool === "floor") renderer.warm({ floor: floorMaterial });
    if (tool === "terrain" && brushTerrain) renderer.warm({ terrain: brushTerrain });
    if (tool === "bridge") renderer.warm({ bridge: bridgeKind });
    if (tool === "stair") renderer.warm({ stair: stairShape });
    if (tool === "props") renderer.warm({ props: true });
  }, [renderer, tool, wallDrawStyle, sceneStyle, floorMaterial, brushTerrain, bridgeKind, stairShape]);

  // Pontes: com o relevo (nível das pontas); a camada é refeita no próximo desenho.
  useEffect(() => {
    if (!renderer) return;
    renderer.setBridges(bridges, relief);
    setVersion((value) => value + 1);
  }, [renderer, bridges, relief]);

  // Escadas: com o relevo confirmado (o perfil segue o chão); a camada é refeita no próximo desenho.
  useEffect(() => {
    if (!renderer) return;
    renderer.setStairs(stairs, stairRelief);
    setVersion((value) => value + 1);
  }, [renderer, stairs, stairRelief]);

  // Objetos (docs/design/objetos.md): com o relevo confirmado (a base de cada um); as imagens são refeitas no desenho.
  useEffect(() => {
    if (!renderer) return;
    renderer.setProps(props, stairRelief);
    setVersion((value) => value + 1);
  }, [renderer, props, stairRelief]);

  // Objeto arrastado ou mexido pelas alças: o desenho acompanha (só o que muda; o resto do chão fica).
  const propDrag = usePropDrag();
  useEffect(() => {
    if (!renderer) return;
    renderer.setPropDrag(propDrag.id, propDrag.drag);
    setVersion((value) => value + 1);
  }, [renderer, propDrag]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setPropFaded(fadedProps);
    setVersion((value) => value + 1);
  }, [renderer, fadedProps]);

  // Tokens no mapa de alturas: o arrastado anda junto (só o chão redesenha, não o mapa inteiro).
  const tokenDrag = useTokenDrag();
  useEffect(() => {
    if (!renderer) return;
    const shifted = tokenDrag.id
      ? tokenCasters.map((caster) => (caster.id === tokenDrag.id ? { ...caster, x: caster.x + tokenDrag.dx / grid.cellPx, y: caster.y + tokenDrag.dy / grid.cellPx } : caster))
      : tokenCasters;
    renderer.setTokenCasters(shifted);
    setVersion((value) => value + 1);
  }, [renderer, tokenCasters, tokenDrag, grid.cellPx]);

  // Vento nas plantas: parado com a ferramenta Objetos, com Reduzir efeitos e no aparelho que não aguenta.
  const windStalled = useWindStalled();
  const propWindOff = useApp((state) => state.tool === "props" || state.reduceFx) || windStalled;
  useEffect(() => {
    if (!renderer) return;
    const wind = windOf(weather);
    renderer.setPropWind(propWindOff ? null : { strength: wind.strength, direction: [wind.direction * 0.95, 0.31] });
    setVersion((value) => value + 1);
  }, [renderer, weather, propWindOff]);

  // Pisos: a camada é refeita no próximo desenho.
  useEffect(() => {
    if (!renderer) return;
    renderer.setFloors(floors);
    setVersion((value) => value + 1);
  }, [renderer, floors]);

  // Poeira das dunas: onde há duna (do relevo, com a prévia) e o vento do clima; parada com a animação desligada.
  const reduceDust = useApp((state) => state.reduceFx) || windStalled;
  // sem vento (ou com a animação desligada) não há poeira: a máscara nem é montada (o pincel do relevo muda a toda hora)
  const blowing = dust.level > 0 && !reduceDust;
  const dunes = useMemo(() => (blowing ? duneMask(relief) : null), [relief, blowing]);
  useEffect(() => {
    if (!renderer) return;
    renderer.setDust(dunes, reduceDust ? 0 : dust.level, dust.direction);
    setVersion((value) => value + 1);
  }, [renderer, dunes, dust.level, dust.direction, reduceDust]);

  // O relevo só vai para a água com mar na cena (a costa junto a relevo mais alto vira penhasco); sem mar, pintar
  // relevo não refaz as contas da água. Com mar, a costa acompanha o relevo só quando o pincel para.
  const hasSea = useMemo(() => Object.values(committed).some((chunk) => chunk.sea !== undefined), [committed]);
  const [seaRelief, setSeaRelief] = useState<ReliefChunks>(() => (hasSea ? relief : NO_RELIEF));
  useEffect(() => {
    if (!hasSea) return void setSeaRelief(NO_RELIEF);
    const timer = setTimeout(() => setSeaRelief(relief), SEA_RELIEF_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hasSea, relief]);

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
      const job: WaterJob = { id: jobId.current, chunks: committed, currents, rocks, perCell: PER_CELL, relief: seaRelief };
      worker.postMessage(job);
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [worker, committed, currents, rocks, seaRelief]);

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
  // Zoom provisório: a escala do último desenho completo, o gesto em andamento e o desenho agendado para depois dele.
  const paintedScaleRef = useRef<number | null>(null);
  const zoomingRef = useRef(false);
  const zoomTimerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(zoomTimerRef.current), []);
  // Terreno confirmado novo que o efeito da água ainda não viu: já é pendente (no quadro logo depois de soltar o pincel,
  // nem a prévia nem o pendente estariam ligados, e a água sumiria até o Worker responder).
  const waterDraft = draft || waterPending || lastCommitted.current !== committed;
  const waterDraftRef = useRef(waterDraft);
  waterDraftRef.current = waterDraft;
  // Tempo da água: contínuo (não volta a zero quando algo muda); parada, fica no último instante.
  const timeRef = useRef(performance.now() / 1000);
  const reduceFx = useApp((state) => state.reduceFx);
  const groundFailed = useApp((state) => state.groundFailed);
  const animate = !reduceFx && !windStalled;

  /** Um desenho do chão: a camada da imagem, as outras saídas e, se mudou, a das paredes. */
  const paint = (target: GroundRenderer, frameView: GroundView, time: number, frameDraft: boolean) => {
    // Chão já desligado: o mapa usa o desenho de antes (não insiste num programa que não compila).
    if (useApp.getState().groundFailed) return;
    try {
      target.render(frameView, time, { waterDraft: frameDraft });
    } catch {
      // Programa das paredes que o aparelho recusou (compilado tarde, no desenho): volta tudo ao desenho de antes.
      useApp.setState({ groundFailed: true });
      return;
    }
    // as imagens ficam presas ao mapa na visão deste desenho
    setDrawnView({ x: frameView.stageX, y: frameView.stageY, scale: frameView.scale, width: frameView.width, height: frameView.height });
    imageRef.current?.getLayer()?.batchDraw();
    notifyGroundDrawn();
    if (target.wallsFresh) notifyWallsDrawn();
    if (target.propsFresh) notifyPropsDrawn();
    if (target.fogging) notifyFogDrawn();
    notifyEffectsDrawn();
    if (target.weathering) notifyWeatherDrawn();
  };
  const paintRef = useRef(paint);
  paintRef.current = paint;

  // Efeitos de área (docs/design/efeitos.md): as máscaras de quem mudou são refeitas.
  useEffect(() => {
    if (!renderer) return;
    renderer.setEffects(effects, { feetPerCell: grid.feetPerCell, grid: grid.grid });
    setVersion((value) => value + 1);
  }, [renderer, effects, grid.feetPerCell, grid.grid]);

  // Moldura da cena (docs/design/moldura.md): desenhada a cada desenho completo.
  useEffect(() => {
    if (!renderer) return;
    renderer.setFrame(frameInput);
    setVersion((value) => value + 1);
  }, [renderer, frameInput]);

  // Clima vivendo no mapa (docs/design/clima.md): o telhado é refeito quando os cômodos mudam.
  useEffect(() => {
    if (!renderer) return;
    renderer.setWeather(weatherInput);
    setVersion((value) => value + 1);
  }, [renderer, weatherInput]);

  // Efeito que acompanha um token: anda junto no arrasto (em casas).
  useEffect(() => {
    if (!renderer) return;
    renderer.setEffectFollow(tokenDrag.id, tokenDrag.dx / grid.cellPx, tokenDrag.dy / grid.cellPx);
  }, [renderer, tokenDrag, grid.cellPx]);

  // Névoa (docs/design/nevoa.md): as máscaras são refeitas no próximo desenho.
  useEffect(() => {
    if (!renderer) return;
    renderer.setFog(fog);
    setVersion((value) => value + 1);
  }, [renderer, fog]);

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
    // chão desligado (o mapa voltou ao desenho de antes): nada a animar nem a medir
    if (!renderer || !animate || groundFailed) return;
    let frame = 0;
    let lastDraw = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // o vigia de aparelho lento (o mesmo do vento); relevo calculando e água chegando não contam
      if (!watchFrame(renderer.busy || waterPendingRef.current)) return;
      // no meio do gesto de zoom nada é redesenhado (as imagens esticam); o desenho completo vem ao parar
      if (zoomingRef.current) return;
      // Anima com água, tocha tremulando ou poeira na tela, ou com a luz da cena ainda trocando.
      // os efeitos que mexem na luz pedem o desenho inteiro (a luz tremula com eles)
      const ground = renderer.visibleWater(viewRef.current) || renderer.flickering(viewRef.current) || renderer.swaying || renderer.busy || renderer.dusting(viewRef.current) || (renderer.effecting && renderer.effectsLit);
      if (now - lastDraw < FRAME_MS || !(ground || renderer.fogging || renderer.effecting || renderer.weathering)) return;
      lastDraw = now;
      timeRef.current = now / 1000;
      // só a fumaça da névoa andando: refaz só ela (o chão, a luz e os objetos ficam como estão)
      if (!ground) {
        if (renderer.effecting) {
          renderer.renderEffects(viewRef.current, timeRef.current);
          notifyEffectsDrawn();
        }
        if (renderer.fogging) {
          renderer.renderFog(viewRef.current, timeRef.current);
          notifyFogDrawn();
        }
        if (renderer.weathering) {
          renderer.renderWeather(viewRef.current);
          notifyWeatherDrawn();
        }
        return;
      }
      paintRef.current(renderer, viewRef.current, timeRef.current, waterDraftRef.current);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [renderer, animate, groundFailed]);

  // Com a animação desligada (Reduzir efeitos, aparelho lento), o relevo ainda precisa de quadros para ser calculado
  // (e as paredes, para o programa compilar): um quadro por vez até acabar (só cálculo e desenho, sem água animando).
  useEffect(() => {
    if (!renderer || animate) return;
    let frame = 0;
    const tick = () => {
      if (!renderer.busy) return;
      if (zoomingRef.current) {
        frame = requestAnimationFrame(tick);
        return;
      }
      paintRef.current(renderer, viewRef.current, timeRef.current, waterDraftRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [renderer, animate, version]);

  // Densidade da tela mudou (janela arrastada para outro monitor): redesenha na densidade nova. A consulta vale para a
  // densidade de agora, então é refeita a cada troca.
  useEffect(() => {
    let query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const changed = () => {
      query.removeEventListener("change", changed);
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener("change", changed);
      setVersion((value) => value + 1);
    };
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);

  // Quadro na hora: quando a visão, o tamanho, o terreno ou a água mudam (com a água parada, é o único desenho).
  // Zoom (escala diferente da do último desenho): as imagens prontas esticam e um desenho completo sai ZOOM_SETTLE_MS
  // depois do último passo. Afastando, quando elas já não cobrem a tela, um desenho com folga (escala menor, área
  // maior) cobre os próximos passos. Arrasto e o resto: na hora.
  useEffect(() => {
    if (!renderer) return;
    window.clearTimeout(zoomTimerRef.current);
    if (paintedScaleRef.current !== null && view.scale !== paintedScaleRef.current) {
      const drawn = useGroundOutputs.getState().drawnView;
      if (drawn && !coversView(drawn, view, size)) paint(renderer, widerView(groundView), timeRef.current, waterDraft);
      zoomingRef.current = true;
      zoomTimerRef.current = window.setTimeout(() => {
        zoomingRef.current = false;
        paintedScaleRef.current = viewRef.current.scale;
        paintRef.current(renderer, viewRef.current, timeRef.current, waterDraftRef.current);
      }, ZOOM_SETTLE_MS);
      return;
    }
    zoomingRef.current = false;
    paintedScaleRef.current = view.scale;
    paint(renderer, groundView, timeRef.current, waterDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groundView é refeito a cada render a partir destes valores
  }, [renderer, version, waterDraft, view.x, view.y, view.scale, size.width, size.height, grid.cellPx, grid.offsetX, grid.offsetY]);

  const drawnBox = useDrawnBox(view, size);
  if (!renderer || renderer.empty || groundFailed) return null;
  return (
    <Layer listening={false}>
      <KImage ref={imageRef} image={renderer.groundImage} {...drawnBox} />
    </Layer>
  );
});
