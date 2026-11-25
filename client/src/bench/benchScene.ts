import { LIMITS, MAP_TORCH_COLORS, type ActionResult, type MapTorchStyle } from "@rpg/shared";
import { act } from "../actions";
import { scatter } from "../map/scatter";
import { paintReliefStroke, paintTerrainStroke } from "../map/mapHistory";
import { useApp } from "../store";

/**
 * A cena pesada do teste de desempenho (docs/design/desempenho.md): 60 × 40 casas com terreno variado, rio, relevo e
 * dunas, mar na borda direita, 300 objetos de floresta, 20 fontes de luz (modelos e cores variados, 2 arandelas), 6 cômodos, névoa e chuva à noite. Montada pelas ações do jogo numa cena
 * nova e apagada no fim. A água do lago fica para o cenário "primeira água".
 */

const SCENE_NAME = "Teste de desempenho";

export interface BenchScene {
  /** A cena em que o mestre estava (volta para ela no fim). */
  previousSceneId: string;
  sceneId: string;
}

function currentState() {
  const state = useApp.getState().state;
  if (!state) throw new Error("Sem estado do jogo: abra o app como mestre antes do teste.");
  return state;
}

/** Espera a ação; recusada, o teste para com o motivo. Devolve os ids criados. */
async function must(result: Promise<ActionResult>, what: string): Promise<string[]> {
  const outcome = await result;
  if (!outcome.ok) throw new Error(`${what}: ${outcome.error}`);
  return outcome.ids ?? [];
}

/** Espera o estado do jogo chegar com a condição (o servidor responde antes de o estado novo chegar). */
async function until(condition: () => boolean, timeoutMs = 5000) {
  const started = performance.now();
  while (!condition()) {
    if (performance.now() - started > timeoutMs) throw new Error("O estado do jogo não chegou a tempo.");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Um sorteio repetível (a mesma cena a cada medição). */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export async function buildBenchScene(): Promise<BenchScene> {
  const previousSceneId = currentState().sceneId;
  const [sceneId] = await must(act("scene:add", { name: SCENE_NAME }), "Criar a cena");
  if (!sceneId) throw new Error("A cena de teste não veio com id.");
  await must(act("scene:switch", { id: sceneId }), "Trocar para a cena");
  await until(() => currentState().sceneId === sceneId);
  const scene = { previousSceneId, sceneId };
  try {
    await fillBenchScene();
  } catch (error) {
    // montagem pela metade: a cena de teste não fica para trás
    await removeBenchScene(scene);
    throw error;
  }
  return scene;
}

/** O conteúdo da cena pesada, na cena de teste já ativa. */
async function fillBenchScene() {
  // Terreno: grama em tudo, terra, areia, pedra e um rio.
  await must(paintTerrainStroke({ terrain: "grass", radius: 1, strength: 1, points: [], rect: { from: { x: 0, y: 0 }, to: { x: 60, y: 40 } } }), "Grama");
  await must(paintTerrainStroke({ terrain: "dirt", radius: 2, strength: 1, points: [2, 20, 10, 18, 20, 21, 30, 19, 40, 22] }), "Caminho de terra");
  await must(paintTerrainStroke({ terrain: "sand", radius: 1, strength: 1, points: [], rect: { from: { x: 44, y: 28 }, to: { x: 60, y: 40 } } }), "Areia");
  await must(paintTerrainStroke({ terrain: "stone", radius: 3, strength: 1, points: [8, 8, 12, 6] }), "Pedra");
  await must(paintTerrainStroke({ terrain: "water", radius: 1, strength: 1, points: [0, 4, 10, 6, 20, 3, 30, 7, 42, 4, 60, 8] }), "Rio");
  // mar na borda direita (docs/design/mar.md): praia na areia, margem na grama, borda aberta fora da pintura
  await must(paintTerrainStroke({ terrain: "sea", radius: 1, strength: 1, points: [], rect: { from: { x: 52, y: 0 }, to: { x: 60, y: 40 } } }), "Mar");

  // Relevo: morros e dunas na areia.
  await must(paintReliefStroke({ level: 2, soft: true, radius: 4, points: [20, 30, 26, 32] }), "Morro");
  await must(paintReliefStroke({ level: 1, soft: true, radius: 3, points: [6, 32, 10, 36] }), "Morrote");
  await must(paintReliefStroke({ level: 0, soft: true, dune: 2, radius: 6, points: [48, 32, 56, 36] }), "Dunas");

  // Paredes: 6 cômodos de 5 × 4 casas, cada um com uma porta.
  for (let index = 0; index < 6; index++) {
    const left = 2 + (index % 3) * 7;
    const top = 10 + Math.floor(index / 3) * 6;
    const corners = [
      { col: left, row: top },
      { col: left + 5, row: top },
      { col: left + 5, row: top + 4 },
      { col: left, row: top + 4 },
    ];
    for (let side = 0; side < 4; side++) {
      await must(act("wall:add", { from: corners[side], to: corners[(side + 1) % 4], door: side === 2 }), "Parede");
    }
  }

  // Floresta: 300 objetos espalhados, fora das paredes.
  const cells = new Set<string>();
  for (let col = 32; col < 58; col++) for (let row = 10; row < 27; row++) cells.add(`${col},${row}`);
  const forest = scatter("forest", cells, 1, [], seeded(7), "square", currentState().battle.walls).slice(0, Math.min(300, LIMITS.props));
  await must(act("prop:addMany", { items: forest }), "Floresta");

  // Fontes de luz (docs/design/luzes.md): 18 nos cômodos e no caminho, em modelos e cores variados, e 2 arandelas
  // nas paredes de cima do primeiro e do segundo cômodo (viradas para dentro).
  const models: MapTorchStyle[] = ["stick", "iron", "brazier", "campfire", "lantern", "candles", "candelabra", "oilLamp", "orb"];
  for (let index = 0; index < 18; index++) {
    const col = 4.5 + (index % 9) * 4.2;
    const row = index < 9 ? 12 : 24.5;
    const color = MAP_TORCH_COLORS[index % MAP_TORCH_COLORS.length];
    await must(act("maptorch:add", { col, row, style: models[index % models.length], ...(color !== "flame" && { color }) }), "Fonte de luz");
  }
  for (const left of [2, 9]) await must(act("maptorch:add", { col: left + 2.5, row: 10.12, style: "sconce", facing: 90 }), "Arandela");

  // moldura da cena (docs/design/moldura.md): a mesa de fora e a moldura também entram na medição
  await must(act("battle:grid", { frame: { cols: 60, rows: 40, style: "bronze" } }), "Moldura");
  await must(act("fog:set", { enabled: true }), "Névoa");
  await must(act("weather:set", { kind: "rain", intensity: 0.6, wind: 20, light: "night" }), "Chuva à noite");
  await until(() => currentState().battle.props.length > 0 && currentState().battle.torches.length === 20);
}

export async function removeBenchScene(scene: BenchScene) {
  await must(act("scene:switch", { id: scene.previousSceneId }), "Voltar para a cena");
  await until(() => currentState().sceneId === scene.previousSceneId);
  await must(act("scene:remove", { id: scene.sceneId }), "Apagar a cena de teste");
}
