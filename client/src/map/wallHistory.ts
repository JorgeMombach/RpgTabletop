import type { ActionResult, GridPos, Wall } from "@rpg/shared";
import { create } from "zustand";
import { act } from "../actions";
import { useApp } from "../store";

/**
 * Desfazer da ferramenta Paredes (L5): o mestre volta a última parede ou porta que colocou ou apagou com a
 * borracha (botão ou Ctrl+Z). O histórico é deste navegador e desta sessão; "Apagar todas" não entra
 * (já tem confirmação).
 */
type Step = { kind: "added"; id: string } | { kind: "removed"; wall: Wall } | { kind: "erased"; removed: Wall[]; added: string[] };

const MAX_STEPS = 50;
const steps: Step[] = [];

/** Quantos passos dá para desfazer (para o botão saber se fica habilitado). */
export const useWallUndo = create<{ count: number }>(() => ({ count: 0 }));

function push(step: Step) {
  steps.push(step);
  if (steps.length > MAX_STEPS) steps.shift();
  useWallUndo.setState({ count: steps.length });
}

export async function addWall(from: GridPos, to: GridPos, door: boolean, thickness: number): Promise<ActionResult> {
  const res = await act("wall:add", { from, to, door, thickness });
  if (res.ok && res.ids?.[0]) push({ kind: "added", id: res.ids[0] });
  return res;
}

export async function removeWall(w: Wall): Promise<ActionResult> {
  const res = await act("wall:remove", { id: w.id });
  if (res.ok) push({ kind: "removed", wall: { ...w, door: w.door && { ...w.door } } });
  return res;
}

const copy = (w: Wall): Wall => ({ ...w, from: { ...w.from }, to: { ...w.to }, door: w.door && { ...w.door } });

/**
 * Uma passada da borracha (do apertar ao soltar) é um passo só: compara as paredes de antes e de depois.
 * Desfazer tira os pedaços que sobraram e põe de volta as paredes inteiras.
 */
export function recordErase(before: Wall[], after: Wall[]) {
  const now = new Set(after.map((w) => w.id));
  const was = new Set(before.map((w) => w.id));
  const removed = before.filter((w) => !now.has(w.id)).map(copy);
  if (removed.length === 0) return;
  push({ kind: "erased", removed, added: after.filter((w) => !was.has(w.id)).map((w) => w.id) });
}

/** Põe de volta uma parede apagada (com o estado da porta); devolve o id novo. */
async function restore(wall: Wall): Promise<string | undefined> {
  const { from, to, door, thickness } = wall;
  const res = await act("wall:add", { from, to, door: !!door, thickness });
  const id = res.ok ? res.ids?.[0] : undefined;
  // A parede volta com outro id: os passos anteriores que apontavam para ela passam a apontar para o novo.
  if (id) for (const s of steps) if (s.kind === "added" && s.id === wall.id) s.id = id;
  if (id && door && (door.open || door.locked || door.secret)) {
    await act("door:set", { id, open: door.open, locked: !!door.locked, secret: !!door.secret });
  }
  return id;
}

/** Desfaz o último passo: tira a parede colocada ou põe de volta a apagada (com o estado da porta). */
export async function undoWall() {
  const step = steps.pop();
  useWallUndo.setState({ count: steps.length });
  if (!step) return;
  if (step.kind === "added") {
    await act("wall:remove", { id: step.id });
    return;
  }
  if (step.kind === "erased") {
    // Pedaço que já foi apagado depois (outra passada) não está mais lá.
    const exists = new Set(useApp.getState().state?.battle.walls.map((w) => w.id));
    for (const id of step.added) if (exists.has(id)) await act("wall:remove", { id });
    for (const w of step.removed) await restore(w);
    return;
  }
  await restore(step.wall);
}
