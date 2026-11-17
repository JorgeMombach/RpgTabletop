import { riverField, waterBounds, waterField } from "@rpg/shared";
import type { WaterGpuField, WaterJob, WaterResult } from "./waterTypes";

/**
 * Worker da água animada: as contas pesadas (grupos de água, distância exata, coordenadas do rio) longe da tela, só
 * quando a água pintada, as linhas de correnteza ou as pedras mudam. Devolve tudo em meia precisão, transferido.
 */

const floatView = new Float32Array(1);
const bitsView = new Uint32Array(floatView.buffer);

/** Float32 para meia precisão (IEEE 754 binary16), com arredondamento para baixo. */
function toHalf(value: number): number {
  floatView[0] = value;
  const bits = bitsView[0];
  const sign = (bits >>> 16) & 0x8000;
  const exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  const mantissa = bits & 0x7fffff;
  if (exponent <= 0) return sign;
  if (exponent >= 31) return sign | 0x7bff;
  return sign | (exponent << 10) | (mantissa >>> 13);
}

/** Folga (casas) em volta de cada grupo de água: o barranco e a espuma cabem. */
const MARGIN = 2;

self.onmessage = (event: MessageEvent<WaterJob>) => {
  const { id, chunks, currents, rocks, perCell } = event.data;
  const fields: WaterGpuField[] = [];
  const buffers: ArrayBuffer[] = [];
  for (const rect of waterBounds(chunks, MARGIN)) {
    const field = waterField(chunks, rect, perCell);
    const river = riverField(field, currents);
    const sdfDeep = new Uint16Array(field.width * field.height * 2);
    for (let index = 0; index < field.sdf.length; index++) {
      sdfDeep[index * 2] = toHalf(field.sdf[index]);
      sdfDeep[index * 2 + 1] = toHalf(field.deep[index]);
    }
    const riverHalf = new Uint16Array(river.length);
    for (let index = 0; index < river.length; index++) riverHalf[index] = toHalf(river[index]);
    // Pedra que conta: centro dentro deste grupo e na água (não no barranco seco).
    const inside = rocks.filter((rock) => {
      const px = Math.floor((rock.col - rect.col) * perCell);
      const py = Math.floor((rock.row - rect.row) * perCell);
      if (px < 0 || py < 0 || px >= field.width || py >= field.height) return false;
      return field.sdf[py * field.width + px] > perCell * 0.4;
    });
    fields.push({ rect, perCell, width: field.width, height: field.height, sdfDeep, river: riverHalf, rocks: inside });
    buffers.push(sdfDeep.buffer, riverHalf.buffer);
  }
  const result: WaterResult = { id, fields };
  self.postMessage(result, { transfer: buffers });
};
