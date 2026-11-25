import { fieldScale, riverField, toHalfFloat, waterBounds, waterField, waterHalfWidth } from "@rpg/shared";
import type { WaterGpuField, WaterJob, WaterResult } from "./waterTypes";

/**
 * Worker da água animada: as contas pesadas (grupos de água, distância exata, coordenadas do rio) longe da tela, só
 * quando a água pintada, as linhas de correnteza ou as pedras mudam. Distância e parte funda vão em meia precisão; as
 * coordenadas do rio, em precisão cheia (num rio longo, "ao longo" passa de 1000 px e a meia precisão dá degraus).
 */

/** Lado máximo de um campo (px): um grupo de água enorme fica com menos detalhe, sem estourar memória nem textura. */
const MAX_FIELD_SIDE = 2048;

/** Folga (casas) em volta de cada grupo de água: o barranco e a espuma cabem. */
const MARGIN = 2;

/** Até onde (casas) se procura a maior distância até a margem: a meia largura satura nisso (margem cheia). */
const HALF_WIDTH_REACH = 2;

self.onmessage = (event: MessageEvent<WaterJob>) => {
  const { id, chunks, currents, rocks, perCell: preferred } = event.data;
  const fields: WaterGpuField[] = [];
  const buffers: ArrayBuffer[] = [];
  for (const rect of waterBounds(chunks, MARGIN)) {
    const perCell = fieldScale(rect, preferred, MAX_FIELD_SIDE);
    const field = waterField(chunks, rect, perCell);
    const river = riverField(field, currents);
    // distância, parte funda e meia largura da água em volta (em casas: o barranco do rio fino fica proporcional)
    const halfWidth = waterHalfWidth(field.sdf, field.width, field.height, HALF_WIDTH_REACH * perCell);
    const sdfDeep = new Uint16Array(field.width * field.height * 4);
    for (let index = 0; index < field.sdf.length; index++) {
      sdfDeep[index * 4] = toHalfFloat(field.sdf[index]);
      sdfDeep[index * 4 + 1] = toHalfFloat(field.deep[index]);
      sdfDeep[index * 4 + 2] = toHalfFloat(halfWidth[index] / perCell);
    }
    // Pedra que conta: centro dentro deste grupo e na água (não no barranco seco).
    const inside = rocks.filter((rock) => {
      const px = Math.floor((rock.col - rect.col) * perCell);
      const py = Math.floor((rock.row - rect.row) * perCell);
      if (px < 0 || py < 0 || px >= field.width || py >= field.height) return false;
      return field.sdf[py * field.width + px] > perCell * 0.4;
    });
    fields.push({ rect, perCell, width: field.width, height: field.height, sdfDeep, river, rocks: inside });
    buffers.push(sdfDeep.buffer, river.buffer);
  }
  const result: WaterResult = { id, fields };
  self.postMessage(result, { transfer: buffers });
};
