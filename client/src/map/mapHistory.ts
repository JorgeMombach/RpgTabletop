import type { ActionResult, ChestStyle, Drawing, EffectPreset, GridPos, LootEntry, WallStyle, LootInput, MapChest, MapTorch, MapTorchStyle, Wall } from "@rpg/shared";
import { create } from "zustand";
import { act } from "../actions";
import { useApp } from "../store";

/**
 * Desfazer do mapa (L5, ampliado depois da 2.11): paredes e portas, desenhos (livre, seta, círculo…), tochas
 * fixas e baús. Volta o que esta pessoa colocou, apagou com a borracha ou arrastou (tocha), pelo botão de cada
 * ferramenta ou Ctrl+Z. Uma pilha só, mas cada ferramenta desfaz só o que é dela; fora delas, Ctrl+Z desfaz o
 * último de qualquer uma. O histórico é deste navegador e desta cena (trocar de cena zera); "Apagar todas"
 * não entra (já tem confirmação).
 */
export type UndoScope = "walls" | "drawings" | "torches" | "chests" | "paint";

type Step =
  | { scope: "walls"; kind: "added"; id: string }
  | { scope: "walls"; kind: "removed"; wall: Wall }
  | { scope: "walls"; kind: "erased"; removed: Wall[]; added: string[] }
  | { scope: "walls"; kind: "restyled"; before: { id: string; style?: WallStyle }[] }
  | { scope: "drawings"; kind: "added"; id: string }
  | { scope: "drawings"; kind: "erased"; removed: Drawing[]; added: string[] }
  | { scope: "torches"; kind: "added"; id: string }
  | { scope: "torches"; kind: "moved"; id: string; col: number; row: number }
  | { scope: "torches"; kind: "erased"; removed: MapTorch[] }
  | { scope: "chests"; kind: "added"; id: string }
  | { scope: "chests"; kind: "moved"; id: string; col: number; row: number }
  | { scope: "chests"; kind: "removed"; chest: MapChest }
  | { scope: "paint"; kind: "painted"; preset: EffectPreset; color: string; cells: number[] }
  | { scope: "paint"; kind: "erased"; groups: PaintGroup[] };

/** Casas tiradas de uma pintura (para pôr de volta no desfazer). */
interface PaintGroup {
  preset: EffectPreset;
  color: string;
  cells: number[];
}

const MAX_STEPS = 80;
const steps: Step[] = [];

/** Quantos passos de cada ferramenta dá para desfazer (para os botões saberem se ficam habilitados). */
export const useMapUndo = create<Record<UndoScope, number>>(() => ({ walls: 0, drawings: 0, torches: 0, chests: 0, paint: 0 }));

function sync() {
  useMapUndo.setState({
    walls: steps.filter((s) => s.scope === "walls").length,
    drawings: steps.filter((s) => s.scope === "drawings").length,
    torches: steps.filter((s) => s.scope === "torches").length,
    chests: steps.filter((s) => s.scope === "chests").length,
    paint: steps.filter((s) => s.scope === "paint").length,
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

export async function addWall(from: GridPos, to: GridPos, door: boolean, thickness: number, style?: WallStyle): Promise<ActionResult> {
  const res = await act("wall:add", { from, to, door, thickness, ...(style && { style }) });
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
  const { from, to, door, thickness, style } = wall;
  const res = await act("wall:add", { from, to, door: !!door, thickness, ...(style && { style }) });
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

// ---------- Baús ----------

export async function addChest(col: number, row: number, style: ChestStyle): Promise<ActionResult> {
  const res = await act("chest:add", { col, row, style });
  if (res.ok && res.ids?.[0]) push({ scope: "chests", kind: "added", id: res.ids[0] });
  return res;
}

/** Baú arrastado para outra casa: desfazer volta para onde estava. */
export async function moveChest(c: MapChest, col: number, row: number): Promise<ActionResult> {
  const res = await act("chest:move", { id: c.id, col, row });
  if (res.ok) push({ scope: "chests", kind: "moved", id: c.id, col: c.col, row: c.row });
  return res;
}

/** Apagar o baú (no editor): desfazer põe de volta com nome, desenho, trancas e loot. */
export async function removeChest(c: MapChest): Promise<ActionResult> {
  const res = await act("chest:remove", { id: c.id });
  if (res.ok) push({ scope: "chests", kind: "removed", chest: structuredClone(c) });
  return res;
}

const lootInput = (e: LootEntry): LootInput => {
  const { id: _, ...rest } = e;
  return rest as LootInput;
};

async function restoreChest(c: MapChest) {
  const res = await act("chest:add", { col: c.col, row: c.row, style: c.style });
  const id = res.ok ? res.ids?.[0] : undefined;
  if (!id) return;
  renamed("chests", c.id, id);
  await act("chest:update", { id, name: c.name, style: c.style, locked: !!c.locked, hidden: !!c.hidden, loot: c.loot.map(lootInput) });
}

/** Troca o desenho das paredes (`null` = o da cena). Desfazer devolve o desenho de antes de cada uma. */
export async function restyleWalls(ids: string[], style: WallStyle | null): Promise<ActionResult> {
  const walls = useApp.getState().state?.battle.walls ?? [];
  const before = walls.filter((w) => ids.includes(w.id)).map((w) => ({ id: w.id, ...(w.style && { style: w.style }) }));
  const res = await act("wall:style", { ids, style });
  if (res.ok && before.length > 0) push({ scope: "walls", kind: "restyled", before });
  return res;
}

// ---------- Pincel de efeitos ----------

const key = (c: number, r: number) => `${c},${r}`;
function cellKeys(flat: number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push(key(flat[i], flat[i + 1]));
  return out;
}
const unkey = (keys: string[]) => keys.flatMap((k) => k.split(",").map(Number));

/** Pinta casas (junta na pintura ligada do mesmo tipo e cor). Desfazer tira só as casas que eram novas. */
export async function paintCells(preset: EffectPreset, color: string, cells: number[], custom: boolean): Promise<ActionResult> {
  const before = useApp.getState().state?.battle.effects.find((e) => e.cells && e.active && e.preset === preset && e.color === color);
  const had = new Set(before ? cellKeys(before.cells!) : []);
  const fresh = cellKeys(cells).filter((k) => !had.has(k));
  const res = await act("effect:paint", { preset, cells, ...(custom && { color }) });
  if (res.ok && fresh.length > 0) push({ scope: "paint", kind: "painted", preset, color, cells: unkey(fresh) });
  return res;
}

/** Apaga casas de todas as pinturas. Desfazer pinta de volta, cada uma no seu tipo. */
export async function erasePaint(cells: number[]): Promise<ActionResult> {
  const out = new Set(cellKeys(cells));
  const groups: PaintGroup[] = [];
  for (const e of useApp.getState().state?.battle.effects ?? []) {
    if (!e.cells) continue;
    const hit = cellKeys(e.cells).filter((k) => out.has(k));
    if (hit.length > 0) groups.push({ preset: e.preset, color: e.color, cells: unkey(hit) });
  }
  const res = await act("effect:paint", { erase: true, cells });
  if (res.ok && groups.length > 0) push({ scope: "paint", kind: "erased", groups });
  return res;
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
    } else if (step.kind === "restyled") {
      // Agrupa por desenho de antes (um envio por desenho), só as paredes que ainda existem.
      const groups = new Map<WallStyle | null, string[]>();
      for (const b of step.before) if (has(battle?.walls, b.id)) groups.set(b.style ?? null, [...(groups.get(b.style ?? null) ?? []), b.id]);
      for (const [style, ids] of groups) await act("wall:style", { ids, style });
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
  } else if (step.scope === "paint") {
    if (step.kind === "painted") await act("effect:paint", { erase: true, preset: step.preset, color: step.color, cells: step.cells });
    else for (const g of step.groups) await act("effect:paint", { preset: g.preset, color: g.color, cells: g.cells });
  } else if (step.scope === "chests") {
    if (step.kind === "added") {
      if (has(battle?.chests, step.id)) await act("chest:remove", { id: step.id });
    } else if (step.kind === "moved") {
      if (has(battle?.chests, step.id)) await act("chest:move", { id: step.id, col: step.col, row: step.row });
    } else {
      await restoreChest(step.chest);
    }
  } else if (step.kind === "added") {
    if (has(battle?.torches, step.id)) await act("maptorch:remove", { id: step.id });
  } else if (step.kind === "moved") {
    if (has(battle?.torches, step.id)) await act("maptorch:move", { id: step.id, col: step.col, row: step.row });
  } else {
    for (const t of step.removed) await restoreTorch(t);
  }
}
