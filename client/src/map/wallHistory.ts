import type { ActionResult, GridPos, Wall } from "@rpg/shared";
import { create } from "zustand";
import { act } from "../actions";

/**
 * Desfazer da ferramenta Paredes (L5): o mestre volta a última parede ou porta que colocou ou apagou com a
 * borracha (botão ou Ctrl+Z). O histórico é deste navegador e desta sessão; "Apagar todas" não entra
 * (já tem confirmação).
 */
type Step = { kind: "added"; id: string } | { kind: "removed"; wall: Wall };

const MAX_STEPS = 50;
const steps: Step[] = [];

/** Quantos passos dá para desfazer (para o botão saber se fica habilitado). */
export const useWallUndo = create<{ count: number }>(() => ({ count: 0 }));

function push(step: Step) {
  steps.push(step);
  if (steps.length > MAX_STEPS) steps.shift();
  useWallUndo.setState({ count: steps.length });
}

export async function addWall(from: GridPos, to: GridPos, door: boolean): Promise<ActionResult> {
  const res = await act("wall:add", { from, to, door });
  if (res.ok && res.ids?.[0]) push({ kind: "added", id: res.ids[0] });
  return res;
}

export async function removeWall(w: Wall): Promise<ActionResult> {
  const res = await act("wall:remove", { id: w.id });
  if (res.ok) push({ kind: "removed", wall: { ...w, door: w.door && { ...w.door } } });
  return res;
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
  const { from, to, door } = step.wall;
  const res = await act("wall:add", { from, to, door: !!door });
  const id = res.ok ? res.ids?.[0] : undefined;
  // A parede volta com outro id: os passos anteriores que apontavam para ela passam a apontar para o novo.
  if (id) for (const s of steps) if (s.kind === "added" && s.id === step.wall.id) s.id = id;
  if (id && door && (door.open || door.locked || door.secret)) {
    await act("door:set", { id, open: door.open, locked: !!door.locked, secret: !!door.secret });
  }
}
