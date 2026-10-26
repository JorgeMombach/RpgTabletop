import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Combatant, GameState, LogEntry, MapEffect, MobTemplate, Spell, WeatherState } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { useServer } from "./helpers";

/*
 * Proteção do arquivo de sessão: um jogo com TODOS os campos preenchidos tem que voltar igual depois de
 * salvar e carregar. Os exemplos são tipados com `Required<…>`: campo novo nos tipos do jogo e esquecido
 * aqui quebra o typecheck; esquecido no arquivo de sessão (session-file.ts) quebra este teste.
 */

const { ctx } = useServer();
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function fullGame(playerId: string, gmId: string): GameState {
  const spell: Required<Spell> = { id: "s1", name: "Escudo", level: 1, note: "+5 CA" };
  // Aliado não pode ser oculto (só mobs e NPCs): `hidden` é conferido no mob abaixo.
  const thorin: Required<Omit<Combatant, "hidden">> = {
    id: "thorin",
    name: "Thorin",
    type: "ally",
    ownerId: playerId,
    templateId: "t1",
    hp: 22,
    hpMax: 30,
    tempHp: 5,
    deathSaves: { successes: 2, failures: 1 },
    dexMod: 1,
    ac: 18,
    abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 13, cha: 10 },
    size: "small",
    avatar: PNG,
    color: "#5ba3e6",
    pos: { col: 2, row: 3 },
    initiative: 18,
    initRoll: 17,
    spellSlots: { 1: { max: 3, used: 1 }, 2: { max: 2, used: 0 }, 3: { max: 0, used: 0 }, 4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 }, 7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 } },
    spells: [spell],
    conditions: [
      { id: "c1", name: "Concentração", rounds: null },
      { id: "c2", name: "Abençoado", rounds: 3 },
    ],
    animal: true,
    summonerId: "lia",
    summonConcentration: true,
    summonRounds: 10,
  };
  const lia: Combatant = { id: "lia", name: "Lia", type: "ally", ownerId: playerId, hp: 15, hpMax: 15, dexMod: 3, color: "#c94a52", pos: null, initiative: 12, initRoll: 9, conditions: [] };
  const lich: Combatant = { id: "lich", name: "Lich", type: "mob", templateId: "t1", hp: 90, hpMax: 135, dexMod: 3, color: "#7a5ba3", pos: { col: 8, row: 8 }, initiative: 20, initRoll: 17, conditions: [] };
  const sombra: Required<Combatant> = { ...thorin, id: "sombra", name: "Sombra", type: "mob", ownerId: gmId, hidden: true, summonerId: "lich", size: "huge", pos: { col: 10, row: 8 }, initiative: null, initRoll: null };
  const guarda: Combatant = { id: "guarda", name: "Guarda", type: "npc", hp: 11, hpMax: 11, dexMod: 0, color: "#4fae8c", pos: { col: 1, row: 1 }, initiative: 5, initRoll: 5, conditions: [], hidden: true };
  const template: Required<MobTemplate> = { id: "t1", name: "Lich", hpMax: 135, dexMod: 3, ac: 17, abilities: { int: 20, wis: 14 }, size: "large", color: "#7a5ba3", avatar: PNG, notes: "Filactéria escondida", animal: true };
  const effect: Required<MapEffect> = {
    id: "e1",
    name: "Graxa em chamas",
    preset: "fire",
    color: "#ff6a1a",
    area: { kind: "cube", origin: { col: 1, row: 1 }, angle: 0, feet: 10 },
    ownerId: playerId,
    casterId: "thorin",
    rounds: 3,
    concentration: true,
    active: false,
    revertTo: { name: "Graxa", preset: "grease", color: "#3b3a2a", ownerId: playerId, casterId: "lia", rounds: null, concentration: false },
  };
  const roll: Required<LogEntry> = {
    id: "l1",
    ts: 1_790_000_000_000,
    authorId: playerId,
    author: "Ana",
    text: "Ataque: 1d20+5 = 22",
    hidden: true,
    system: true,
    label: "Ataque",
    roll: {
      expr: "1d20+5",
      mode: "adv",
      terms: [
        { kind: "dice", sign: 1, count: 2, faces: 20, rolls: [17, 4], keptIndex: 0 },
        { kind: "const", sign: 1, value: 5 },
      ],
      total: 22,
    },
    as: "Thorin",
    color: "#5ba3e6",
    kind: "attack",
    crit: true,
    turn: { seq: 4, round: 2, name: "Thorin" },
  };
  const weather: Required<WeatherState> = { kind: "storm", intensity: 0.8, wind: -20, light: "night", startedAt: 1_790_000_000_000 };
  const battle: Required<GameState["battle"]> = {
    map: { image: PNG, imageVersion: 3, showGrid: false, cellPx: 70, offsetX: 5, offsetY: -5, feetPerCell: 5, rotation: 90, imageScale: 1.5 },
    mobs: [lich, sombra],
    npcs: [guarda],
    combat: { active: true, round: 2, turnIndex: 1, order: ["lich", "thorin", "lia"], turn: 4 },
    // Pedido e reações valem só no turno: não vão no arquivo. O modo fora de combate vai.
    rolls: { request: null, reactions: [], outside: "locked" },
    effects: [effect],
    weather,
  };
  const game: Required<GameState> = { templates: [template], allies: [thorin, lia], battle, log: [roll] };
  return structuredClone(game);
}

describe("proteção do arquivo de sessão", () => {
  it("todos os campos do jogo voltam iguais depois de salvar e carregar", () => {
    const store = ctx.server.store;
    const gm = store.createPlayer("Mestre", "gm");
    const ana = store.createPlayer("Ana", "player");
    store.game = fullGame(ana.id, gm.id);
    store.mobCounters.set("t1", 7);
    const before = structuredClone(store.game);

    const file = JSON.parse(JSON.stringify(exportSession(store)));
    importSession(store, gm, file);

    // A versão da imagem sobe de propósito (o servidor reenvia o mapa a todos).
    assert.equal(store.game.battle.map.imageVersion, before.battle.map.imageVersion + 1);
    store.game.battle.map.imageVersion = before.battle.map.imageVersion;
    assert.deepEqual(store.game, before);
    assert.equal(store.mobCounters.get("t1"), 7);
  });

  it("donos são religados também no estado de antes de Transformar", () => {
    const store = ctx.server.store;
    const gm = store.createPlayer("Mestre", "gm");
    const ana = store.createPlayer("Ana", "player");
    store.game = fullGame(ana.id, gm.id);
    const file = JSON.parse(JSON.stringify(exportSession(store)));

    // Outra sessão: a Ana já está conectada com outro id.
    store.players.clear();
    const gm2 = store.createPlayer("Mestre", "gm");
    const ana2 = store.createPlayer("ana", "player");
    importSession(store, gm2, file);
    const e = store.game.battle.effects[0];
    assert.equal(e.ownerId, ana2.id);
    assert.equal(e.revertTo?.ownerId, ana2.id, "quando voltar a ser Graxa, continua da Ana");
  });
});
