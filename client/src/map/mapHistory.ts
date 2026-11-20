import { cutUnder, paintFloor, type FloorChunks, type FloorStroke, paintRelief, paintTerrain, type ReliefChunks, type ReliefStroke, PROP_DEFAULTS, TERRAINS, type TerrainChunk, type TerrainChunks, type TerrainStroke, LIMITS, type ActionResult, type ChestStyle, type Drawing, type EffectPreset, type GridPos, type LootEntry, type MapProp, type WallStyle, type LootInput, type MapChest, type MapTorch, type MapTorchStyle, type Wall, type WaterCurrent, type Bridge, type Stair } from "@rpg/shared";
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
export type UndoScope = "walls" | "drawings" | "torches" | "chests" | "paint" | "props" | "terrain" | "relief" | "floor" | "bridge" | "stair";

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
  | { scope: "props"; kind: "added"; id: string }
  | { scope: "props"; kind: "addedMany"; ids: string[] }
  | { scope: "props"; kind: "changed"; id: string; before: Partial<MapProp> }
  | { scope: "props"; kind: "removed"; props: MapProp[] }
  | { scope: "bridge"; kind: "added"; id: string }
  | { scope: "bridge"; kind: "changed"; id: string; before: Partial<Omit<Bridge, "id">> }
  | { scope: "bridge"; kind: "removed"; bridges: Bridge[] }
  | { scope: "stair"; kind: "added"; id: string }
  | { scope: "stair"; kind: "changed"; id: string; before: Partial<Omit<Stair, "id">> }
  | { scope: "stair"; kind: "removed"; stairs: Stair[] }
  | { scope: "paint"; kind: "painted"; preset: EffectPreset; color: string; cells: number[] }
  | { scope: "paint"; kind: "erased"; groups: PaintGroup[] }
  | { scope: "terrain"; kind: "painted"; before: Record<string, TerrainChunk | null>; after: Record<string, TerrainChunk | null> }
  | { scope: "terrain"; kind: "currentAdded"; id: string }
  | { scope: "terrain"; kind: "currentChanged"; id: string; before: number[] }
  | { scope: "terrain"; kind: "currentsRemoved"; currents: WaterCurrent[] }
  | { scope: "relief"; kind: "painted"; before: Record<string, string | null>; after: Record<string, string | null> }
  | { scope: "floor"; kind: "painted"; before: Record<string, string | null>; after: Record<string, string | null> };

/** Casas tiradas de uma pintura (para pôr de volta no desfazer). */
interface PaintGroup {
  preset: EffectPreset;
  color: string;
  cells: number[];
}

const MAX_STEPS = 80;
const steps: Step[] = [];

/** Quantos passos de cada ferramenta dá para desfazer (para os botões saberem se ficam habilitados). */
export const useMapUndo = create<Record<UndoScope, number>>(() => ({ walls: 0, drawings: 0, torches: 0, chests: 0, paint: 0, props: 0, terrain: 0, relief: 0, floor: 0, bridge: 0, stair: 0 }));

function sync() {
  useMapUndo.setState({
    walls: steps.filter((s) => s.scope === "walls").length,
    drawings: steps.filter((s) => s.scope === "drawings").length,
    torches: steps.filter((s) => s.scope === "torches").length,
    chests: steps.filter((s) => s.scope === "chests").length,
    paint: steps.filter((s) => s.scope === "paint").length,
    props: steps.filter((s) => s.scope === "props").length,
    terrain: steps.filter((s) => s.scope === "terrain").length,
    relief: steps.filter((s) => s.scope === "relief").length,
    floor: steps.filter((s) => s.scope === "floor").length,
    bridge: steps.filter((s) => s.scope === "bridge").length,
    stair: steps.filter((s) => s.scope === "stair").length,
  });
}

function push(step: Step) {
  steps.push(step);
  if (steps.length > MAX_STEPS) steps.shift();
  sync();
}

// Outra cena, outros ids: o que estava na pilha não vale mais.
let scene = useApp.getState().state?.sceneId;
// Terreno inteiro novo (apagar tudo, Limpar campo, carregar arquivo): os passos de terreno não valem mais (senão o
// desfazer de uma borracha que esvaziou um pedaço traria o pedaço de volta num campo limpo).
let terrainEpoch = useApp.getState().terrainEpoch;
useApp.subscribe((s) => {
  const now = s.state?.sceneId;
  if (now !== scene) {
    scene = now;
    steps.length = 0;
    sync();
  }
  if (s.terrainEpoch !== terrainEpoch) {
    terrainEpoch = s.terrainEpoch;
    const kept = steps.filter((step) => step.scope !== "terrain");
    if (kept.length !== steps.length) {
      steps.splice(0, steps.length, ...kept);
      sync();
    }
  }
});

/** Algo voltou com id novo: os passos anteriores que apontavam para o antigo passam a apontar para o novo. */
function renamed(scope: UndoScope, from: string, to: string) {
  for (const s of steps) if (s.scope === scope && (s.kind === "added" || s.kind === "moved" || s.kind === "changed") && s.id === from) s.id = to;
}

/** Compara a lista de antes e a de depois de uma passada da borracha: o que sumiu e o que nasceu (pedaços). */
function diff<T extends { id: string }>(before: T[], after: T[]) {
  const now = new Set(after.map((x) => x.id));
  const was = new Set(before.map((x) => x.id));
  return { removed: before.filter((x) => !now.has(x.id)), added: after.filter((x) => !was.has(x.id)).map((x) => x.id) };
}

// ---------- Paredes ----------

/** `opening`: porta ou janela; por cima de paredes alinhadas, corta essas paredes (desfazer volta tudo num passo). */
export async function addWall(from: GridPos, to: GridPos, opening: "door" | "window" | null, thickness: number, style?: WallStyle): Promise<ActionResult> {
  // As paredes que o servidor vai cortar (a mesma conta dele), para o desfazer pôr de volta.
  const walls = useApp.getState().state?.battle.walls ?? [];
  const { cut } = opening ? cutUnder({ from, to }, walls) : { cut: [] };
  const res = await act("wall:add", { from, to, door: opening === "door", window: opening === "window", thickness, ...(style && { style }) });
  if (!res.ok || !res.ids?.[0]) return res;
  if (cut.length > 0) push({ scope: "walls", kind: "erased", removed: cut.map(copyWall), added: res.ids });
  else push({ scope: "walls", kind: "added", id: res.ids[0] });
  return res;
}

export async function removeWall(w: Wall): Promise<ActionResult> {
  const res = await act("wall:remove", { id: w.id });
  if (res.ok) push({ scope: "walls", kind: "removed", wall: copyWall(w) });
  return res;
}

const copyWall = (w: Wall): Wall => ({ ...w, from: { ...w.from }, to: { ...w.to }, door: w.door && { ...w.door }, window: w.window && { ...w.window } });

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
  const { from, to, door, window, thickness, style } = wall;
  const res = await act("wall:add", { from, to, door: !!door, window: !!window, thickness, ...(style && { style }) });
  const id = res.ok ? res.ids?.[0] : undefined;
  if (!id) return;
  renamed("walls", wall.id, id);
  if (door && (door.open || door.locked || door.secret)) {
    await act("door:set", { id, open: door.open, locked: !!door.locked, secret: !!door.secret });
  }
  if (window?.closed) await act("window:set", { id, closed: true });
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

/** Baú posto e cancelado sem salvar: sai do mapa e o passo "posto" sai da pilha (não há o que desfazer). */
export async function discardNewChest(id: string): Promise<void> {
  const i = steps.map((s) => s.scope === "chests" && s.kind === "added" && s.id === id).lastIndexOf(true);
  if (i >= 0) {
    steps.splice(i, 1);
    sync();
  }
  await act("chest:remove", { id });
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

// ---------- Objetos ----------

export async function addProp(input: Omit<MapProp, "id" | "seed" | "above" | "blocks"> & Partial<Pick<MapProp, "seed" | "above" | "blocks">>): Promise<ActionResult> {
  const res = await act("prop:add", input);
  if (res.ok && res.ids?.[0]) push({ scope: "props", kind: "added", id: res.ids[0] });
  return res;
}

/** Muda um objeto (lugar, tamanho, giro, variação, camada, bloqueio): desfazer volta só o que mudou. */
export async function updateProp(p: MapProp, changes: Partial<Omit<MapProp, "id" | "kind">>): Promise<ActionResult> {
  const before = Object.fromEntries(Object.keys(changes).map((k) => [k, p[k as keyof MapProp]])) as Partial<MapProp>;
  const res = await act("prop:update", { id: p.id, ...changes });
  if (res.ok) push({ scope: "props", kind: "changed", id: p.id, before });
  return res;
}

/** Pincelada do "Espalhar": todos num envio só; desfazer tira a pincelada inteira. */
export async function addProps(items: Omit<MapProp, "id" | "above" | "blocks">[]): Promise<ActionResult> {
  const res = await act("prop:addMany", { items });
  if (res.ok && res.ids?.length) push({ scope: "props", kind: "addedMany", ids: res.ids });
  return res;
}

/** Ponte nova (docs/design/pontes.md): desfazer apaga. */
export async function addBridge(bridge: Omit<Bridge, "id">): Promise<ActionResult> {
  const res = await act("bridge:add", bridge);
  if (res.ok && res.ids?.[0]) push({ scope: "bridge", kind: "added", id: res.ids[0] });
  return res;
}

/** Muda uma ponte (pontas, largura, tipo): desfazer volta só o que mudou. */
export async function updateBridge(before: Bridge, changes: Partial<Omit<Bridge, "id">>): Promise<ActionResult> {
  const previous: Partial<Omit<Bridge, "id">> = {};
  if (changes.from) previous.from = before.from;
  if (changes.to) previous.to = before.to;
  if (changes.width !== undefined) previous.width = before.width;
  if (changes.kind !== undefined) previous.kind = before.kind;
  const res = await act("bridge:update", { id: before.id, ...changes });
  if (res.ok) push({ scope: "bridge", kind: "changed", id: before.id, before: previous });
  return res;
}

/** Apaga pontes: desfazer põe de volta (com ids novos). */
export async function removeBridges(list: Bridge[]): Promise<ActionResult> {
  const res = await act("bridge:remove", { ids: list.map((bridge) => bridge.id) });
  if (res.ok) push({ scope: "bridge", kind: "removed", bridges: structuredClone(list) });
  return res;
}

/** Escada nova (docs/design/escadas.md): desfazer apaga. */
export async function addStair(stair: Omit<Stair, "id">): Promise<ActionResult> {
  const res = await act("stair:add", stair);
  if (res.ok && res.ids?.[0]) push({ scope: "stair", kind: "added", id: res.ids[0] });
  return res;
}

/** Muda uma escada (pontos, formato, material, largura, sentido): desfazer volta só o que mudou. */
export async function updateStair(before: Stair, changes: Partial<Omit<Stair, "id">>): Promise<ActionResult> {
  const previous: Partial<Omit<Stair, "id">> = {};
  if (changes.points) previous.points = before.points;
  if (changes.shape !== undefined) previous.shape = before.shape;
  if (changes.material !== undefined) previous.material = before.material;
  if (changes.width !== undefined) previous.width = before.width;
  if (changes.exit !== undefined) previous.exit = before.exit;
  const res = await act("stair:update", { id: before.id, ...changes });
  if (res.ok) push({ scope: "stair", kind: "changed", id: before.id, before: previous });
  return res;
}

/** Apaga escadas: desfazer põe de volta (com ids novos). */
export async function removeStairs(list: Stair[]): Promise<ActionResult> {
  const res = await act("stair:remove", { ids: list.map((stair) => stair.id) });
  if (res.ok) push({ scope: "stair", kind: "removed", stairs: structuredClone(list) });
  return res;
}

export async function removeProps(list: MapProp[]): Promise<ActionResult> {
  const res = await act("prop:remove", { ids: list.map((p) => p.id) });
  if (res.ok) push({ scope: "props", kind: "removed", props: structuredClone(list) });
  return res;
}

/** Põe de volta os apagados (num envio só), com camada e bloqueio de antes; os passos antigos passam aos ids novos. */
async function restoreProps(list: MapProp[]) {
  if (list.length === 0) return;
  const res = await act("prop:addMany", { items: list.map(({ id: _, above: _a, blocks: _b, ...rest }) => rest) });
  if (!res.ok || !res.ids) return;
  for (let i = 0; i < list.length; i++) {
    const id = res.ids[i];
    renamed("props", list[i].id, id);
    for (const s of steps) if (s.scope === "props" && s.kind === "addedMany") s.ids = s.ids.map((x) => (x === list[i].id ? id : x));
    const { above, blocks } = list[i];
    if (above !== PROP_DEFAULTS[list[i].kind].above || blocks !== PROP_DEFAULTS[list[i].kind].blocks) await act("prop:update", { id, above, blocks });
  }
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

// ---------- Piso ----------

/**
 * Uma passada de piso (cômodo, retângulo, ou o pincel do apertar ao soltar, em envios de até 2000 pontos), como o
 * relevo: o passo do desfazer guarda os pedaços de antes e de depois (a mesma conta do servidor, só com os envios
 * aceitos), e desfazer só repõe o que ainda está como a passada deixou.
 */
export async function paintFloorStroke(stroke: FloorStroke): Promise<ActionResult> {
  const app = useApp.getState();
  const base = app.floors;
  const walls = app.state?.battle.walls ?? [];
  const sceneStyle = app.state?.battle.map.wallStyle ?? "stone";
  const applied: FloorChunks = { ...base };
  const touched = new Set<string>();
  const slices: FloorStroke[] = [];
  if (stroke.shape.kind === "brush") {
    const { points, radius } = stroke.shape;
    for (let start = 0; start < points.length; start += LIMITS.terrainStrokePoints * 2) slices.push({ ...stroke, shape: { kind: "brush", radius, points: points.slice(start, start + LIMITS.terrainStrokePoints * 2) } });
  } else slices.push(stroke);
  let result: ActionResult = { ok: true };
  for (const slice of slices) {
    result = await act("floor:paint", slice);
    if (!result.ok) break;
    for (const key of paintFloor(applied, slice, walls, sceneStyle) ?? []) touched.add(key);
  }
  if (touched.size > 0) {
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    for (const key of touched) {
      before[key] = base[key] ?? null;
      after[key] = applied[key] ?? null;
    }
    push({ scope: "floor", kind: "painted", before, after });
  }
  return result;
}

// ---------- Terreno ----------

/**
 * Uma passada do pincel de relevo (do apertar ao soltar), em envios de até 2000 pontos, como o terreno: o passo do
 * desfazer guarda os pedaços de antes e de depois, e desfazer só repõe o que ainda está como a passada deixou.
 */
export async function paintReliefStroke(stroke: ReliefStroke): Promise<ActionResult> {
  const base = useApp.getState().relief;
  const applied: ReliefChunks = { ...base };
  const touched = new Set<string>();
  let result: ActionResult = { ok: true };
  for (let start = 0; start < stroke.points.length; start += LIMITS.terrainStrokePoints * 2) {
    const slice: ReliefStroke = { ...stroke, points: stroke.points.slice(start, start + LIMITS.terrainStrokePoints * 2) };
    result = await act("relief:paint", slice);
    if (!result.ok) break;
    for (const key of paintRelief(applied, slice)) touched.add(key);
  }
  if (touched.size > 0) {
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    for (const key of touched) {
      before[key] = base[key] ?? null;
      after[key] = applied[key] ?? null;
    }
    push({ scope: "relief", kind: "painted", before, after });
  }
  return result;
}

/**
 * Uma passada do pincel de terreno (do apertar ao soltar), em envios de até 2000 pontos. O passo do desfazer guarda
 * os pedaços de antes e os de depois (a mesma conta do servidor, só com os envios aceitos): desfazer só repõe o
 * pedaço que ainda está como a passada deixou (depois de *Limpar campo* ou de *Apagar todo o terreno*, não volta nada).
 */
export async function paintTerrainStroke(stroke: TerrainStroke): Promise<ActionResult> {
  const base = useApp.getState().terrain;
  const applied: TerrainChunks = { ...base };
  const touched = new Set<string>();
  let result: ActionResult = { ok: true };
  // O retângulo vai de uma vez (sem pontos); o pincel, em fatias do tamanho que o servidor aceita.
  const slices: TerrainStroke[] = [];
  if (stroke.rect) slices.push(stroke);
  else for (let start = 0; start < stroke.points.length; start += LIMITS.terrainStrokePoints * 2) slices.push({ ...stroke, points: stroke.points.slice(start, start + LIMITS.terrainStrokePoints * 2) });
  for (const slice of slices) {
    result = await act("terrain:paint", slice);
    if (!result.ok) break;
    for (const key of paintTerrain(applied, slice)) touched.add(key);
  }
  if (touched.size > 0) {
    const before: Record<string, TerrainChunk | null> = {};
    const after: Record<string, TerrainChunk | null> = {};
    for (const key of touched) {
      before[key] = base[key] ?? null;
      after[key] = applied[key] ?? null;
    }
    push({ scope: "terrain", kind: "painted", before, after });
  }
  return result;
}

/** Linha de correnteza riscada (água animada): desfazer apaga. */
export async function addCurrent(points: number[]): Promise<ActionResult> {
  const result = await act("current:add", { points });
  const id = result.ok ? result.ids?.[0] : undefined;
  if (id) push({ scope: "terrain", kind: "currentAdded", id });
  return result;
}

/** Linha de correnteza continuada pela ponta: desfazer volta aos pontos de antes. */
export async function updateCurrent(current: WaterCurrent, points: number[]): Promise<ActionResult> {
  const result = await act("current:update", { id: current.id, points });
  if (result.ok) push({ scope: "terrain", kind: "currentChanged", id: current.id, before: current.points });
  return result;
}

/** Linhas de correnteza apagadas pela borracha: desfazer risca de novo (com id novo). */
export async function removeCurrents(currents: WaterCurrent[]): Promise<ActionResult> {
  const result = await act("current:remove", { ids: currents.map((current) => current.id) });
  if (result.ok && currents.length > 0) push({ scope: "terrain", kind: "currentsRemoved", currents });
  return result;
}

const sameChunk = (a: TerrainChunk | null, b: TerrainChunk | null) => TERRAINS.every((terrain) => a?.[terrain] === b?.[terrain]);

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
  } else if (step.scope === "props") {
    if (step.kind === "added") {
      if (has(battle?.props, step.id)) await act("prop:remove", { ids: [step.id] });
    } else if (step.kind === "addedMany") {
      const ids = step.ids.filter((id) => has(battle?.props, id));
      if (ids.length) await act("prop:remove", { ids });
    } else if (step.kind === "changed") {
      if (has(battle?.props, step.id)) await act("prop:update", { id: step.id, ...step.before });
    } else await restoreProps(step.props);
  } else if (step.scope === "bridge") {
    if (step.kind === "added") {
      if (has(battle?.bridges, step.id)) await act("bridge:remove", { ids: [step.id] });
    } else if (step.kind === "changed") {
      if (has(battle?.bridges, step.id)) await act("bridge:update", { id: step.id, ...step.before });
    } else for (const { id: _, ...bridge } of step.bridges) await act("bridge:add", bridge);
  } else if (step.scope === "stair") {
    if (step.kind === "added") {
      if (has(battle?.stairs, step.id)) await act("stair:remove", { ids: [step.id] });
    } else if (step.kind === "changed") {
      if (has(battle?.stairs, step.id)) await act("stair:update", { id: step.id, ...step.before });
    } else for (const { id: _, ...stair } of step.stairs) await act("stair:add", stair);
  } else if (step.scope === "terrain" && step.kind === "currentAdded") {
    if (has(battle?.currents, step.id)) await act("current:remove", { ids: [step.id] });
  } else if (step.scope === "terrain" && step.kind === "currentChanged") {
    if (has(battle?.currents, step.id)) await act("current:update", { id: step.id, points: step.before });
  } else if (step.scope === "terrain" && step.kind === "currentsRemoved") {
    for (const current of step.currents) await act("current:add", { points: current.points });
  } else if (step.scope === "floor") {
    const now = useApp.getState().floors;
    const chunks: Record<string, string | null> = {};
    for (const [key, after] of Object.entries(step.after)) if ((now[key] ?? null) === after) chunks[key] = step.before[key] ?? null;
    if (Object.keys(chunks).length > 0) await act("floor:restore", { chunks });
  } else if (step.scope === "relief") {
    const now = useApp.getState().relief;
    const chunks: Record<string, string | null> = {};
    for (const [key, after] of Object.entries(step.after)) if ((now[key] ?? null) === after) chunks[key] = step.before[key] ?? null;
    if (Object.keys(chunks).length > 0) await act("relief:restore", { chunks });
  } else if (step.scope === "terrain") {
    const now = useApp.getState().terrain;
    const chunks: Record<string, TerrainChunk | null> = {};
    for (const [key, after] of Object.entries(step.after)) if (sameChunk(now[key] ?? null, after)) chunks[key] = step.before[key] ?? null;
    if (Object.keys(chunks).length > 0) await act("terrain:restore", { chunks });
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
