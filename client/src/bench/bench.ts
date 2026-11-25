import { APP_VERSION } from "@rpg/shared";
import { addCurrent, paintReliefStroke, paintTerrainStroke, undo } from "../map/mapHistory";
import { buildBenchScene, removeBenchScene } from "./benchScene";
import { glCounts, type GlCounts } from "./glCounters";

/**
 * Teste de desempenho repetível (docs/design/desempenho.md): monta a cena pesada, roda os cenários e devolve a tabela.
 * Só em desenvolvimento, com `?bench` no endereço: `await window.rpgBench.run()`. Instruções em
 * `.claude/skills/desempenho/SKILL.md`.
 */

export type ScenarioId = "idle" | "zoom" | "pan" | "firstWater" | "water50" | "relief" | "forestWind";

export interface ScenarioResult {
  frames: number;
  medianMs: number;
  p95Ms: number;
  worstMs: number;
  /** Memória do JS no fim (MB); `null` fora do Chromium. */
  heapMb: number | null;
  gl: GlCounts;
}

export interface BenchReport {
  when: string;
  version: string;
  screen: { width: number; height: number; dpr: number };
  scenarios: Record<ScenarioId, ScenarioResult>;
  /** Só no "água 50×": memória e objetos da placa antes de começar. */
  water50Before: { heapMb: number | null; gl: GlCounts };
}

declare global {
  interface Window {
    /** O teste de desempenho (só em desenvolvimento, com `?bench`). */
    rpgBench?: { run: () => Promise<BenchReport> };
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Memória do JS em MB (`performance.memory` só existe no Chromium). */
function heapMb(): number | null {
  const memory: unknown = Reflect.get(performance, "memory");
  if (typeof memory !== "object" || memory === null) return null;
  const used: unknown = Reflect.get(memory, "usedJSHeapSize");
  return typeof used === "number" ? Math.round((used / 1048576) * 10) / 10 : null;
}

/** Mede os intervalos entre quadros enquanto `action` roda (mais `tailMs` depois, para o que vem atrasado). */
async function measure(action: () => Promise<void>, tailMs = 500): Promise<ScenarioResult> {
  const intervals: number[] = [];
  let running = true;
  let previous = performance.now();
  const tick = (now: number) => {
    intervals.push(now - previous);
    previous = now;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame((now) => {
    previous = now;
    requestAnimationFrame(tick);
  });
  await action();
  await wait(tailMs);
  running = false;
  await wait(50);
  const sorted = [...intervals].sort((a, b) => a - b);
  const at = (fraction: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] : 0);
  const round = (value: number) => Math.round(value * 10) / 10;
  return { frames: intervals.length, medianMs: round(at(0.5)), p95Ms: round(at(0.95)), worstMs: round(sorted[sorted.length - 1] ?? 0), heapMb: heapMb(), gl: glCounts() };
}

/** O palco do mapa (o maior conteúdo do Konva na tela). */
function stageContent(): HTMLElement {
  const contents = [...document.querySelectorAll<HTMLElement>(".konvajs-content")];
  const largest = contents.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (!largest) throw new Error("Mapa não encontrado na tela.");
  return largest;
}

function centerOf(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Espera o mapa assentar (relevo calculando, água chegando): até 1 s sem quadro acima de 50 ms, no máximo `maxMs`. */
async function settle(maxMs = 15000) {
  const started = performance.now();
  let calmSince = performance.now();
  let previous = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      if (now - previous > 50) calmSince = now;
      previous = now;
      if (now - calmSince > 1000 || now - started > maxMs) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Enquadra o mapa inteiro (o botão do mapa). */
function fitMap() {
  const button = document.querySelector<HTMLButtonElement>('button[aria-label="Enquadrar o mapa inteiro"]');
  button?.click();
}

async function zoomScenario() {
  const content = stageContent();
  const { x, y } = centerOf(content);
  for (let step = 0; step < 40; step++) {
    const deltaY = step < 20 ? -100 : 100;
    content.dispatchEvent(new WheelEvent("wheel", { clientX: x, clientY: y, deltaY, bubbles: true, cancelable: true }));
    await wait(16);
  }
}

async function panScenario() {
  const content = stageContent();
  const start = centerOf(content);
  const fire = (target: EventTarget, type: string, x: number, y: number) => {
    const init = { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: type.endsWith("up") ? 0 : 1 };
    target.dispatchEvent(new PointerEvent(type, init));
    target.dispatchEvent(new MouseEvent(type.replace("pointer", "mouse"), init));
  };
  fire(content, "pointerdown", start.x, start.y);
  for (let step = 1; step <= 60; step++) {
    fire(window, "pointermove", start.x - step * 10, start.y);
    await wait(16);
  }
  fire(window, "pointerup", start.x - 600, start.y);
}

export async function run(): Promise<BenchReport> {
  const scene = await buildBenchScene();
  try {
    fitMap();
    await settle();
    const idle = await measure(() => wait(3000), 0);
    const zoom = await measure(zoomScenario);
    await settle();
    fitMap();
    await settle();
    const pan = await measure(panScenario);
    fitMap();
    await settle();
    const firstWater = await measure(async () => {
      await paintTerrainStroke({ terrain: "waterDark", radius: 4, strength: 1, points: [14, 30, 16, 30] });
      await settle(8000);
    }, 0);
    const water50Before = { heapMb: heapMb(), gl: glCounts() };
    const water50 = await measure(async () => {
      for (let index = 0; index < 50; index++) {
        const col = 4 + (index % 10) * 5;
        await paintTerrainStroke({ terrain: "water", radius: 1, strength: 1, points: [col, 38, col + 2, 38] });
        await addCurrent([col, 37, col + 3, 37]);
        await undo("terrain");
        await undo("terrain");
      }
      await settle(8000);
      // tempo para o coletor de lixo do JS passar antes de ler a memória
      await wait(3000);
    }, 0);
    const relief = await measure(async () => {
      await paintReliefStroke({ level: 3, soft: true, radius: 3, points: [36, 34, 40, 36] });
      await paintReliefStroke({ level: 0, soft: true, dune: 3, radius: 4, points: [52, 30, 56, 30] });
      await settle();
    }, 0);
    const forestWind = await measure(() => wait(5000), 0);
    return {
      when: new Date().toISOString(),
      version: APP_VERSION,
      screen: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      scenarios: { idle, zoom, pan, firstWater, water50, relief, forestWind },
      water50Before,
    };
  } finally {
    await removeBenchScene(scene);
  }
}
