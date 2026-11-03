import type { ActionResult, Drawing, GridPos, MapTorch, MapTorchStyle, Wall } from "@rpg/shared";
import { create } from "zustand";
import { act } from "../actions";
import { useApp } from "../store";

/**
 * Desfazer do mapa (L5, ampliado depois da 2.11): paredes e portas, desenhos (livre, seta, círculo…) e tochas
 * fixas. Volta o que esta pessoa colocou, apagou com a borracha ou arrastou (tocha), pelo botão de cada
 * ferramenta ou Ctrl+Z. Uma pilha só, mas cada ferramenta desfaz só o que é dela; fora delas, Ctrl+Z desfaz o
 * último de qualquer uma. O histórico é deste navegador e desta cena (trocar de cena zera); "Apagar todas"
 * não entra (já tem confirmação).
 */
export type UndoScope = "walls" | "drawings" | "torches";

type Step =
  | { scope: "walls"; kind: "added"; id: string }
  | { scope: "walls"; kind: "removed"; wall: Wall }
  | { scope: "walls"; kind: "erased"; removed: Wall[]; added: string[] }
  | { scope: "drawings"; kind: "added"; id: string }
  | { scope: "drawings"; kind: "erased"; removed: Drawing[]; added: string[] }
  | { scope: "torches"; kind: "added"; id: string }
  | { scope: "torches"; kind: "moved"; id: string; col: number; row: number }
  | { scope: "torches"; kind: "erased"; removed: MapTorch[] };

const MAX_STEPS = 80;
const steps: Step[] = [];

/** Quantos passos de cada ferramenta dá para desfazer (para os botões saberem se ficam habilitados). */
export const useMapUndo = create<Record<UndoScope, number>>(() => ({ walls: 0, drawings: 0, torches: 0 }));

function sync() {
  useMapUndo.setState({
    walls: steps.filter((s) => s.scope === "walls").length,
    drawings: steps.filter((s) => s.scope === "drawings").length,
    torches: steps.filter((s) => s.scope === "torches").length,
  });
}

function push(step: Step) {
  steps.push(step);
  if (steps.length > MAX_STEPS) steps.shift();
  sync();
}

// Outra cena, outros ids: o que estava na pilha não vale mais.
let scene = useApp.getState().state?.sceneId;
useApp.subscribe((s) => {
  const now = s.state?.sceneId;
  if (now === scene) return;
  scene = now;
  steps.length = 0;
  sync();
});

/** Algo voltou com id novo: os passos anteriores que apontavam para o antigo passam a apontar para o novo. */
function renamed(scope: UndoScope, from: string, to: string) {
  for (const s of steps) if (s.scope === scope && (s.kind === "added" || s.kind === "moved") && s.id === from) s.id = to;
}

/** Compara a lista de antes e a de depois de uma passada da borracha: o que sumiu e o que nasceu (pedaços). */
function diff<T extends { id: string }>(before: T[], after: T[]) {
  const now = new Set(after.map((x) => x.id));
  const was = new Set(before.map((x) => x.id));
  return { removed: before.filter((x) => !now.has(x.id)), added: after.filter((x) => !was.has(x.id)).map((x) => x.id) };
}

// ---------- Paredes ----------

export async function addWall(from: GridPos, to: GridPos, door: boolean, thickness: number): Promise<ActionResult> {
  const res = await act("wall:add", { from, to, door, thickness });
  if (res.ok && res.ids?.[0]) push({ scope: "walls", kind: "added", id: res.ids[0] });
  return res;
}

export async function removeWall(w: Wall): Promise<ActionResult> {
  const res = await act("wall:remove", { id: w.id });
  if (res.ok) push({ scope: "walls", kind: "removed", wall: copyWall(w) });
  return res;
}

const copyWall = (w: Wall): Wall => ({ ...w, from: { ...w.from }, to: { ...w.to }, door: w.door && { ...w.door } });

/**
 * Uma passada da borracha (do apertar ao soltar) é um passo só: compara as paredes de antes e de depois.
 * Desfazer tira os pedaços que sobraram e põe de volta as paredes inteiras.
 */
export function recordWallErase(before: Wall[], after: Wall[]) {
  const { removed, added } = diff(before, after);
  if (removed.length > 0) push({ scope: "walls", kind: "erased", removed: removed.map(copyWall), added });
}

/** Põe de volta uma parede apagada (com o estado da porta). */
async function restoreWall(wall: Wall) {
  const { from, to, door, thickness } = wall;
  const res = await act("wall:add", { from, to, door: !!door, thickness });
  const id = res.ok ? res.ids?.[0] : undefined;
  if (!id) return;
  renamed("walls", wall.id, id);
  if (door && (door.open || door.locked || door.secret)) {
    await act("door:set", { id, open: door.open, locked: !!door.locked, secret: !!door.secret });
  }
}

// ---------- Desenhos ----------

export async function addDrawing(d: Omit<Drawing, "id" | "authorId">): Promise<ActionResult> {
  const res = await act("draw:add", d);
  if (res.ok && res.ids?.[0]) push({ scope: "drawings", kind: "added", id: res.ids[0] });
  return res;
}

/** Borracha do desenho: como a das paredes, a passada inteira é um passo. */
export function recordDrawingErase(before: Drawing[], after: Drawing[]) {
  const { removed, added } = diff(before, after);
  if (removed.length > 0) push({ scope: "drawings", kind: "erased", removed: removed.map((d) => ({ ...d, points: [...d.points] })), added });
}

async function restoreDrawing(d: Drawing) {
  const res = await act("draw:add", { kind: d.kind, points: d.points, color: d.color, width: d.width, ...(d.hidden && { hidden: true }) });
  const id = res.ok ? res.ids?.[0] : undefined;
  if (id) renamed("drawings", d.id, id);
}

// ---------- Tochas ----------

export async function addTorch(col: number, row: number, style: MapTorchStyle): Promise<ActionResult> {
  const res = await act("maptorch:add", { col, row, style });
  if (res.ok && res.ids?.[0]) push({ scope: "torches", kind: "added", id: res.ids[0] });
  return res;
}

/** Tocha arrastada: desfazer volta para onde estava. */
export async function moveTorch(t: MapTorch, col: number, row: number): Promise<ActionResult> {
  const res = await act("maptorch:move", { id: t.id, col, row });
  if (res.ok) push({ scope: "torches", kind: "moved", id: t.id, col: t.col, row: t.row });
  return res;
}

export function recordTorchErase(before: MapTorch[], after: MapTorch[]) {
  const { removed } = diff(before, after);
  if (removed.length > 0) push({ scope: "torches", kind: "erased", removed: removed.map((t) => ({ ...t })) });
}

async function restoreTorch(t: MapTorch) {
  const res = await act("maptorch:add", { col: t.col, row: t.row, style: t.style });
  const id = res.ok ? res.ids?.[0] : undefined;
  if (id) renamed("torches", t.id, id);
}

// ---------- Desfazer ----------

/** Desfaz o último passo da ferramenta (ou o último de qualquer uma, sem `scope`). */
export async function undo(scope?: UndoScope) {
  let i = steps.length - 1;
  while (i >= 0 && scope && steps[i].scope !== scope) i--;
  if (i < 0) return;
  const [step] = steps.splice(i, 1);
  sync();
  const battle = useApp.getState().state?.battle;
  // O que já não está no mapa (apagado depois, por outra passada ou por outra pessoa) fica como está.
  const has = (list: { id: string }[] | undefined, id: string) => !!list?.some((x) => x.id === id);

  if (step.scope === "walls") {
    if (step.kind === "added") {
      if (has(battle?.walls, step.id)) await act("wall:remove", { id: step.id });
    } else if (step.kind === "removed") {
      await restoreWall(step.wall);
    } else {
      for (const id of step.added) if (has(battle?.walls, id)) await act("wall:remove", { id });
      for (const w of step.removed) await restoreWall(w);
    }
  } else if (step.scope === "drawings") {
    if (step.kind === "added") {
      if (has(battle?.drawings, step.id)) await act("draw:remove", { id: step.id });
    } else {
      for (const id of step.added) if (has(battle?.drawings, id)) await act("draw:remove", { id });
      for (const d of step.removed) await restoreDrawing(d);
    }
  } else if (step.kind === "added") {
    if (has(battle?.torches, step.id)) await act("maptorch:remove", { id: step.id });
  } else if (step.kind === "moved") {
    if (has(battle?.torches, step.id)) await act("maptorch:move", { id: step.id, col: step.col, row: step.row });
  } else {
    for (const t of step.removed) await restoreTorch(t);
  }
}
