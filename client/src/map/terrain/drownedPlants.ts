import { chunkKey, openSeaAt, SEA_OPEN_REACH, TERRAIN_CHUNK_SIDE, TERRAIN_FINE, terrainAt, type MapProp, type PropKind, type TerrainChunks } from "@rpg/shared";

/**
 * A água apaga as plantas (docs/design/ajustes-rapidos.md): ao soltar uma passada de água, as plantas cujo pé ficou
 * na água somem. Pedras e objetos construídos ficam. Sem DOM (testado no servidor).
 */

/** O que é planta (some na água). */
export const PLANT_KINDS: ReadonlySet<PropKind> = new Set<PropKind>(["tree", "pine", "palm", "bush", "stump", "log", "mushrooms", "flowers", "tallGrass"]);

/** Parte da água (água + água profunda + mar) no ponto, de 0 a 1; no mar da borda aberta (sem pintura), 1. */
function waterShare(chunks: TerrainChunks, col: number, row: number, hasSea: boolean): number {
  const values = terrainAt(chunks, col, row);
  const total = Object.values(values).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (total === 0) return hasSea && openSeaAt(chunks, col, row) ? 1 : 0;
  return ((values.water ?? 0) + (values.waterDark ?? 0) + (values.sea ?? 0)) / total;
}

/** O pedaço em que cai o ponto (a mesma conta de `terrainAt`). */
function chunkOf(col: number, row: number): string {
  return chunkKey(Math.floor(Math.round(col * TERRAIN_FINE) / TERRAIN_CHUNK_SIDE), Math.floor(Math.round(row * TERRAIN_FINE) / TERRAIN_CHUNK_SIDE));
}

/**
 * Plantas com o pé na água depois da passada (pelo menos metade) e que antes não estavam. Só as perto dos pedaços que
 * a passada trocou são lidas (o pedaço igual nos dois é o mesmo objeto): numa floresta grande, ler todas pesaria. "Perto"
 * inclui a folga do mar da borda aberta (o mar pintado ao lado afoga a planta em chão sem pintura).
 */
export function drownedPlants(props: MapProp[], before: TerrainChunks, after: TerrainChunks): MapProp[] {
  // sem mar na cena, ninguém precisa procurar a borda aberta
  const seaBefore = Object.values(before).some((chunk) => chunk.sea !== undefined);
  const seaAfter = Object.values(after).some((chunk) => chunk.sea !== undefined);
  return props.filter((prop) => {
    if (!PLANT_KINDS.has(prop.kind)) return false;
    const reach = SEA_OPEN_REACH;
    const changed = [-reach, 0, reach].some((dx) => [-reach, 0, reach].some((dy) => {
      const key = chunkOf(prop.col + dx, prop.row + dy);
      return before[key] !== after[key];
    }));
    if (!changed) return false;
    return waterShare(after, prop.col, prop.row, seaAfter) >= 0.5 && waterShare(before, prop.col, prop.row, seaBefore) < 0.5;
  });
}
