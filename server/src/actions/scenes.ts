import { randomUUID } from "node:crypto";
import { emptyFog, LIMITS, type GridPos, type Scene, type StoredScene } from "@rpg/shared";
import { allCombatants, resetCombat } from "../combat";
import type { Store } from "../store";
import { fail } from "../validate";
import { defaultWeather } from "../weather";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

function sceneName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, LIMITS.sceneName) : "";
  return name || fail("Dê um nome à cena.");
}

function findScene(store: Store, id: unknown): Scene {
  return store.game.scenes.find((s) => s.id === id) ?? fail("Cena não encontrada.");
}

/** Cena vazia com o mesmo grid da atual (mapas da mesma campanha costumam ter a mesma escala). */
function emptyScene(store: Store): StoredScene {
  const { map } = store.game.battle;
  return {
    map: { ...map, image: null, imageVersion: 0, rotation: 0, imageScale: 1 },
    mobs: [],
    npcs: [],
    effects: [],
    drawings: [],
    walls: [],
    weather: defaultWeather(),
    fog: emptyFog(),
    allyPos: {},
  };
}

/** Tira o conteúdo da cena ativa de `battle` (com as posições dos aliados) para guardar. */
function storeActive(store: Store): StoredScene {
  const { battle, allies } = store.game;
  const allyPos: Record<string, GridPos> = {};
  for (const a of allies) if (a.pos) allyPos[a.id] = a.pos;
  const { map, mobs, npcs, effects, drawings, walls, weather, fog } = battle;
  return { map, mobs, npcs, effects, drawings, walls, weather, fog, allyPos };
}

export const sceneHandlers: HandlerMap = {
  "scene:add": (store, player, payload) => {
    requireGm(player);
    const { scenes } = store.game;
    if (scenes.length >= LIMITS.scenes) fail(`Limite de ${LIMITS.scenes} cenas.`);
    const scene: Scene = { id: randomUUID(), name: sceneName(payload?.name), stored: emptyScene(store) };
    scenes.push(scene);
    return [scene.id];
  },

  "scene:rename": (store, player, payload) => {
    requireGm(player);
    const scene = findScene(store, payload?.id);
    scene.name = sceneName(payload.name);
  },

  "scene:remove": (store, player, payload) => {
    requireGm(player);
    const scene = findScene(store, payload?.id);
    if (scene.id === store.game.sceneId) fail("Esta é a cena atual: troque de cena antes de apagar.");
    store.game.scenes = store.game.scenes.filter((s) => s !== scene);
  },

  "scene:switch": (store, player, payload) => {
    requireGm(player);
    const { game } = store;
    const target = findScene(store, payload?.id);
    if (target.id === game.sceneId) return;
    if (game.battle.combat.active) fail("Encerre o combate antes de trocar de cena.");
    const next = target.stored ?? fail("Cena não encontrada.");
    const current = findScene(store, game.sceneId);

    // A ordem de iniciativa é da cena que sai: zera tudo, como no fim do combate.
    resetCombat(store);
    for (const c of allCombatants(store)) c.initiative = c.initRoll = null;
    current.stored = storeActive(store);
    delete target.stored;
    game.sceneId = target.id;

    const { allyPos, ...content } = next;
    // Versão nova da imagem: o servidor reenvia o mapa a todos.
    const imageVersion = game.battle.map.imageVersion + 1;
    Object.assign(game.battle, content, { map: { ...content.map, imageVersion } });
    for (const a of game.allies) a.pos = allyPos[a.id] ?? null;
    // O "Desfazer" de remoção é da cena que saiu.
    store.removedMobs.clear();
  },
};
