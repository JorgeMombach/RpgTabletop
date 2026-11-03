import { Label, Layer, Tag, Text } from "react-konva";
import { create } from "zustand";
import type { MapConfig, MapEffect } from "@rpg/shared";
import { useT } from "../i18n";
import { effectLabel } from "../labels";
import { areaPolygon } from "./AreaShape";
import type { Point } from "./geometry";

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY" | "feetPerCell">;

/** Ponto dentro do polígono (pontos achatados x0, y0, x1, y1…). */
function inPolygon(pts: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** O ponto do mapa está dentro do efeito? Pintura: numa casa pintada; esfera e cilindro: no círculo; o resto: no polígono. */
export function effectContains(e: MapEffect, grid: Grid, p: Point): boolean {
  if (e.cells) {
    const col = Math.floor((p.x - grid.offsetX) / grid.cellPx);
    const row = Math.floor((p.y - grid.offsetY) / grid.cellPx);
    for (let i = 0; i + 1 < e.cells.length; i += 2) if (e.cells[i] === col && e.cells[i + 1] === row) return true;
    return false;
  }
  const { area } = e;
  if (area.kind === "sphere" || area.kind === "cylinder") {
    const o = { x: grid.offsetX + area.origin.col * grid.cellPx, y: grid.offsetY + area.origin.row * grid.cellPx };
    const r = (area.feet / grid.feetPerCell) * grid.cellPx;
    return (p.x - o.x) ** 2 + (p.y - o.y) ** 2 <= r * r;
  }
  return inPolygon(areaPolygon(area, grid), p.x, p.y);
}

/** Efeito sob o mouse (ou o dedo) e onde o rótulo aparece, em pontos do mapa. Fora do estado do mapa: só o rótulo redesenha. */
export const useEffectTip = create<{ id: string | null; x: number; y: number }>(() => ({ id: null, x: 0, y: 0 }));

let hideTimer = 0;

/** Mostra o nome do efeito em `p` (o de cima, se houver vários); `touch` some sozinho depois de um tempo. */
export function showEffectTip(effects: MapEffect[], grid: Grid, p: Point, touch = false) {
  let hit: MapEffect | undefined;
  for (let i = effects.length - 1; i >= 0 && !hit; i--) if (effectContains(effects[i], grid, p)) hit = effects[i];
  const cur = useEffectTip.getState();
  if (!hit) {
    if (cur.id) useEffectTip.setState({ id: null });
    return;
  }
  useEffectTip.setState({ id: hit.id, x: p.x, y: p.y });
  window.clearTimeout(hideTimer);
  if (touch) hideTimer = window.setTimeout(() => useEffectTip.setState({ id: null }), 2500);
}

export function hideEffectTip() {
  if (useEffectTip.getState().id) useEffectTip.setState({ id: null });
}

/**
 * Nome do efeito ao passar o mouse (ou tocar, no celular), em pergaminho como as dicas do app: o mapa não fica
 * coberto de texto. Com duração, concentração, quem conjurou e, para o mestre, se está desligado.
 */
export function EffectTipLayer({ effects, view, width, casterName }: { effects: MapEffect[]; view: { x: number; scale: number }; width: number; casterName: (id: string) => string | undefined }) {
  const t = useT();
  const { id, x, y } = useEffectTip();
  const e = id ? effects.find((o) => o.id === id) : undefined;
  if (!e) return null;
  const caster = e.casterId ? casterName(e.casterId) : undefined;
  const text =
    effectLabel(e) +
    (e.rounds !== null ? ` · ${t("common.rounds", { n: e.rounds })}` : "") +
    (e.concentration ? ` · ${t("effects.concentration")}` : "") +
    (caster ? ` · ${caster}` : "") +
    (e.active ? "" : ` (${t("effects.off")})`);
  const k = 1 / view.scale;
  // Perto da borda direita do mapa (a coluna cobre), o rótulo vira para a esquerda do mouse.
  const left = x * view.scale + view.x > width - 260;
  return (
    <Layer listening={false}>
      <Label x={x + (left ? -10 : 10) * k} y={y + 18 * k}>
        <Tag pointerDirection={left ? "right" : "left"} pointerWidth={6 * k} pointerHeight={8 * k} fill="#f1e6d0" stroke="#8a6a3e" strokeWidth={k} cornerRadius={4 * k} shadowColor="#000000" shadowBlur={8 * k} shadowOpacity={0.45} shadowOffsetY={2 * k} />
        <Text text={text} fontSize={13 * k} fontFamily="Alegreya Sans, sans-serif" fontStyle="bold" fill="#2b1f12" padding={6 * k} />
      </Label>
    </Layer>
  );
}
