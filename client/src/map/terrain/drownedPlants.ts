import { terrainAt, type MapProp, type PropKind, type TerrainChunks } from "@rpg/shared";

/**
 * A água apaga as plantas (docs/design/ajustes-rapidos.md): ao soltar uma passada de água, as plantas cujo pé ficou
 * na água somem. Pedras e objetos construídos ficam. Sem DOM (testado no servidor).
 */

/** O que é planta (some na água). */
export const PLANT_KINDS: ReadonlySet<PropKind> = new Set<PropKind>(["tree", "pine", "palm", "bush", "stump", "log", "mushrooms", "flowers", "tallGrass"]);

/** Parte da água (água + água profunda) no ponto, de 0 a 1. */
function waterShare(chunks: TerrainChunks, col: number, row: number): number {
  const values = terrainAt(chunks, col, row);
  const total = Object.values(values).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return total > 0 ? ((values.water ?? 0) + (values.waterDark ?? 0)) / total : 0;
}

/** Plantas com o pé na água depois da passada (pelo menos metade) e que antes não estavam. */
export function drownedPlants(props: MapProp[], before: TerrainChunks, after: TerrainChunks): MapProp[] {
  return props.filter((prop) => PLANT_KINDS.has(prop.kind) && waterShare(after, prop.col, prop.row) >= 0.5 && waterShare(before, prop.col, prop.row) < 0.5);
}
