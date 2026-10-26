import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { ActionResult, ClientState, SoundSource } from "@rpg/shared";
import { refreshLibrary } from "../src/actions/sound";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// E25 — som da mesa: só o mestre controla; todos ouvem o mesmo.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jamal-sons-"));
const { ctx, client, url } = useServer();
const store = () => ctx.server.store;

beforeEach(() => {
  // O helper troca o Store a cada teste: a pasta volta a valer aqui.
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, "Taverna.mp3"), Buffer.from("ID3 fake"));
  fs.writeFileSync(path.join(dir, "notas.txt"), "não é áudio");
  store().soundsDir = dir;
  refreshLibrary(store());
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false);
  return res.ok ? "" : res.error;
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

let ipSeq = 1;
async function player(name: string): Promise<{ s: Client; token: string }> {
  const s = await client(`10.25.0.${ipSeq++}`);
  const res = await join(s, name);
  assert.ok(res.ok);
  return { s, token: res.sessionToken };
}

const upload = (s: Client, name: string, data: Buffer) =>
  s.timeout(3000).emitWithAck("sound:upload", { name, data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer });
const sfx = (s: Client, source: SoundSource) => s.timeout(2000).emitWithAck("sound:sfx", source);

describe("som da mesa", () => {
  it("mestre toca música e ambiente; todos recebem o mesmo; jogador não controla", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const seen = stateWhere(ana.s, (s) => s.sound.music?.source.kind === "file" && s.sound.ambient !== null);
    assert.ok((await act(g, "sound:play", { channel: "music", source: { kind: "file", name: "Taverna.mp3" } })).ok);
    assert.ok((await act(g, "sound:play", { channel: "ambient", source: { kind: "gen", id: "rain" } })).ok);
    const s: ClientState = await seen;
    assert.deepEqual(s.sound.music?.source, { kind: "file", name: "Taverna.mp3" });
    assert.ok(Math.abs(Date.now() - s.sound.music!.startedAt) < 5000, "hora de início para quem entra depois");
    assert.equal(s.soundLibrary, undefined, "a lista de arquivos é só do mestre");

    for (const [name, payload] of [
      ["sound:play", { channel: "music", source: { kind: "gen", id: "wind" } }],
      ["sound:stop", { channel: "music" }],
      ["sound:volume", { channel: "music", value: 0.1 }],
      ["sound:refresh", {}],
    ] as const) {
      assert.equal((await act(ana.s, name, payload as never)).ok, false, name);
    }
    assert.ok((await act(g, "sound:stop", { channel: "music" })).ok);
    assert.equal(store().sound.music, null);
  });

  it("valida a origem: arquivo fora da pasta, som gerado desconhecido, efeito em canal de loop", async () => {
    const g = await gm();
    assert.match(errorOf(await act(g, "sound:play", { channel: "music", source: { kind: "file", name: "notas.txt" } })), /não está na pasta/);
    assert.match(errorOf(await act(g, "sound:play", { channel: "music", source: { kind: "gen", id: "thunder" } })), /desconhecido/);
    assert.match(errorOf(await act(g, "sound:volume", { channel: "music", value: 2 })), /Volume/);
    assert.ok((await act(g, "sound:volume", { channel: "sfx", value: 0.333 })).ok);
    assert.equal(store().sound.volume.sfx, 0.33);
  });

  it("efeito de uma vez chega para todos; só o mestre dispara", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const heard = new Promise<SoundSource>((resolve) => ana.s.once("sound:sfx", resolve));
    assert.ok((await sfx(g, { kind: "gen", id: "thunder" })).ok);
    assert.deepEqual(await heard, { kind: "gen", id: "thunder" });
    assert.match(errorOf(await sfx(ana.s, { kind: "gen", id: "thunder" })), /Só o mestre/);
    assert.match(errorOf(await sfx(g, { kind: "gen", id: "rain" })), /desconhecido/);
  });
});

describe("pasta de sons", () => {
  it("mestre adiciona arquivo: nome seguro, sem sobrescrever, lista atualizada", async () => {
    const g = await gm();
    assert.ok((await upload(g, "../../Chuva forte.ogg", Buffer.from("OggS"))).ok);
    assert.ok(fs.existsSync(path.join(dir, "Chuva forte.ogg")), "grava só o nome, dentro da pasta");
    assert.ok((await upload(g, "Taverna.mp3", Buffer.from("ID3 outro"))).ok);
    assert.deepEqual(store().soundLibrary, ["Chuva forte.ogg", "Taverna (2).mp3", "Taverna.mp3"]);
    assert.equal(fs.readFileSync(path.join(dir, "Taverna.mp3"), "utf8"), "ID3 fake", "o existente não muda");
    assert.match(errorOf(await upload(g, "virus.exe", Buffer.from("MZ"))), /arquivo de áudio/);
    const ana = await player("Ana");
    assert.match(errorOf(await upload(ana.s, "x.mp3", Buffer.from("x"))), /Só o mestre/);
  });

  it("arquivo copiado direto na pasta aparece ao atualizar; o que sumiu para de tocar", async () => {
    const g = await gm();
    await act(g, "sound:play", { channel: "music", source: { kind: "file", name: "Taverna.mp3" } });
    fs.writeFileSync(path.join(dir, "Floresta.wav"), Buffer.from("RIFF"));
    fs.rmSync(path.join(dir, "Taverna.mp3"));
    assert.ok((await act(g, "sound:refresh", {})).ok);
    assert.deepEqual(store().soundLibrary, ["Floresta.wav"]);
    assert.equal(store().sound.music, null);
  });

  it("arquivos só para quem está na sessão; nada fora da pasta", async () => {
    await gm();
    const ana = await player("Ana");
    assert.equal((await fetch(`${url()}/sons/Taverna.mp3`)).status, 403);
    const ok = await fetch(`${url()}/sons/Taverna.mp3?t=${ana.token}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "audio/mpeg");
    assert.equal(await ok.text(), "ID3 fake");
    assert.equal((await fetch(`${url()}/sons/notas.txt?t=${ana.token}`)).status, 404);
    assert.equal((await fetch(`${url()}/sons/..%2Fpackage.json?t=${ana.token}`)).status, 404);
  });

  it("sem pasta configurada: só os sons gerados", async () => {
    const g = await gm();
    store().soundsDir = null;
    refreshLibrary(store());
    assert.match(errorOf(await act(g, "sound:refresh", {})), /não está configurada/);
    assert.match(errorOf(await upload(g, "a.mp3", Buffer.from("x"))), /não está configurada/);
    assert.ok((await act(g, "sound:play", { channel: "ambient", source: { kind: "gen", id: "cave" } })).ok);
  });
});
