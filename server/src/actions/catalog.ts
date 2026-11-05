// Catálogo de monstros (Passo 12, docs/design/catalogo-srd.md): copiar para o bestiário, pôr no mapa e restaurar.
import { randomUUID } from "node:crypto";
import { catalogStats, CREATURE_COLOR, NAME_MAX_LENGTH, type CatalogLang, type MobTemplate } from "@rpg/shared";
import { catalogEntry } from "../catalog/srd51";
import { fail, requireInt, requireString } from "../validate";
import { combatantHandlers, requireGm } from "./combatants";
import type { HandlerMap } from "./types";

const LANGS: readonly CatalogLang[] = ["pt-BR", "en", "es"];
const langOf = (raw: unknown): CatalogLang => (LANGS.includes(raw as CatalogLang) ? (raw as CatalogLang) : "pt-BR");

export const catalogHandlers: HandlerMap = {
  "catalog:add": (store, player, payload) => {
    requireGm(player);
    const entry = catalogEntry(requireString(payload?.entryId, "Monstro")) ?? fail("Esse monstro não está no catálogo.");
    const lang = langOf(payload.lang);
    const place = payload.place === undefined ? 0 : requireInt(payload.place, "Quantidade", 1, 50);
    const { templates } = store.game;
    const existing = templates.find((t) => t.source === entry.id);
    // Já está no bestiário: pôr no mapa usa o modelo do mestre (com as edições dele); só adicionar pede "outra cópia".
    if (existing && !place && !payload.copy) fail("{name} já está no bestiário.", { name: existing.name });
    let tpl = existing && !payload.copy ? existing : undefined;
    if (!tpl) {
      const first = !templates.some((t) => t.id === entry.id);
      const name = entry.name[lang];
      tpl = {
        id: first ? entry.id : randomUUID(),
        name: first ? name : `${name.slice(0, NAME_MAX_LENGTH - 4)} (2)`,
        color: CREATURE_COLOR[entry.type],
        ...catalogStats(entry, lang),
        source: entry.id,
      } satisfies MobTemplate;
      templates.push(tpl);
    }
    const ids = [tpl.id];
    if (place) ids.push(...(combatantHandlers["mob:addFromTemplate"]!(store, player, { templateId: tpl.id, qty: place }) ?? []));
    return ids;
  },

  "template:restore": (store, player, payload) => {
    requireGm(player);
    const tpl = store.game.templates.find((t) => t.id === payload?.id) ?? fail("Template não encontrado.");
    const entry = (tpl.source && catalogEntry(tpl.source)) || fail("Esse modelo não veio do catálogo.");
    // Os números voltam; nome, cor e imagem são do mestre.
    for (const k of ["ac", "abilities", "size", "attacks", "notes"] as const) delete tpl[k];
    Object.assign(tpl, catalogStats(entry, langOf(payload.lang)));
    return [tpl.id];
  },
};
