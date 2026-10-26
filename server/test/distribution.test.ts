import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer, type AddressInfo, type Server as NetServer } from "node:net";
import { describe, it } from "node:test";
import { APP_VERSION, type ClientState } from "@rpg/shared";
import { ConfigError, parseConfig } from "../src/config";
import { listenWithFallback } from "../src/listen";
import { hostInfo } from "../src/net";
import { join, nextState, useServer } from "./helpers";

const KEY = "chave-de-teste-123";

describe("chave de mestre com loopback desligado (modo Docker)", () => {
  const { client } = useServer({ gmKey: KEY, gmLoopback: false });

  it("localhost sem chave entra como jogador", async () => {
    const s = await client();
    assert.deepEqual(await s.emitWithAck("session:probe", {}), { role: "player" });
    const res = await join(s, "Alguém");
    assert.ok(res.ok && res.self.role === "player");
  });

  it("qualquer máquina com a chave certa entra como mestre", async () => {
    const s = await client("10.7.0.1");
    assert.deepEqual(await s.emitWithAck("session:probe", { gmKey: KEY }), { role: "gm" });
    const res = await join(s, "Mestre", undefined, KEY);
    assert.ok(res.ok && res.self.role === "gm");
  });

  it("chave errada entra como jogador", async () => {
    const s = await client("10.7.0.2");
    for (const wrong of ["chave-de-teste-124", "curta", ""]) {
      assert.deepEqual(await s.emitWithAck("session:probe", { gmKey: wrong }), { role: "player" }, wrong);
    }
    const res = await join(s, "Espertinho", undefined, "chave-errada-qualquer");
    assert.ok(res.ok && res.self.role === "player");
  });

  it("a chave e o link só chegam para o mestre", async () => {
    const g = await client("10.7.0.3");
    const gs = nextState(g);
    await join(g, "Mestre", undefined, KEY);
    assert.equal((await gs).host?.gmKey, KEY);

    const p = await client("10.7.0.4");
    const ps = nextState(p);
    await join(p, "Ana");
    const st: ClientState = await ps;
    assert.equal(st.host, undefined);
    assert.ok(!JSON.stringify(st).includes(KEY));
  });
});

describe("chave de mestre com loopback ligado (executável)", () => {
  const { client } = useServer({ gmKey: KEY });

  it("localhost continua mestre sem chave; outra máquina com a chave também", async () => {
    assert.deepEqual(await (await client()).emitWithAck("session:probe", {}), { role: "gm" });
    assert.deepEqual(await (await client("10.7.1.1")).emitWithAck("session:probe", { gmKey: KEY }), { role: "gm" });
    assert.deepEqual(await (await client("10.7.1.2")).emitWithAck("session:probe", {}), { role: "player" });
  });
});

describe("healthz", () => {
  const { url } = useServer();

  it("responde ok com a versão", async () => {
    const res = await fetch(`${url()}/healthz`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; version: string };
    assert.deepEqual([body.ok, body.version], [true, APP_VERSION]);
  });
});

describe("porta ocupada", () => {
  function occupy(): Promise<{ server: NetServer; port: number }> {
    return new Promise((resolve) => {
      const server = createNetServer().listen(0, () => resolve({ server, port: (server.address() as AddressInfo).port }));
    });
  }

  it("usa a próxima porta livre", async () => {
    const busy = await occupy();
    const http = createHttpServer();
    try {
      const port = await listenWithFallback(http, busy.port);
      assert.ok(port > busy.port && port <= busy.port + 20, `porta ${port}`);
    } finally {
      http.close();
      busy.server.close();
    }
  });

  it("desiste depois das tentativas e devolve o erro", async () => {
    const busy = await occupy();
    const http = createHttpServer();
    try {
      await assert.rejects(listenWithFallback(http, busy.port, 1), { code: "EADDRINUSE" });
    } finally {
      busy.server.close();
    }
  });
});

describe("configuração", () => {
  it("padrões: porta 3000, 6 jogadores, abre navegador, loopback ligado, chave gerada", () => {
    const c = parseConfig([], {});
    assert.deepEqual(
      [c.port, c.maxPlayers, c.openBrowser, c.gmLoopback, c.gmKeyGenerated, c.publicUrls],
      [3000, 6, true, true, true, []],
    );
    assert.ok(c.gmKey.length >= 16);
    assert.notEqual(parseConfig([], {}).gmKey, c.gmKey, "chave nova a cada execução");
  });

  it("variáveis de ambiente", () => {
    const c = parseConfig([], {
      PORT: "4000",
      MAX_PLAYERS: "4",
      OPEN_BROWSER: "0",
      GM_KEY: KEY,
      GM_LOOPBACK: "false",
      PUBLIC_URLS: "http://100.64.0.5:4000/, http://192.168.0.10:4000",
    });
    assert.deepEqual(
      [c.port, c.maxPlayers, c.openBrowser, c.gmKey, c.gmKeyGenerated, c.gmLoopback, c.publicUrls],
      [4000, 4, false, KEY, false, false, ["http://100.64.0.5:4000", "http://192.168.0.10:4000"]],
    );
  });

  it("argumentos vencem o ambiente e aceitam --nome valor e --nome=valor", () => {
    const c = parseConfig(["--port", "5000", "--max-players=8", "--no-open", "--no-gm-loopback"], { PORT: "4000" });
    assert.deepEqual([c.port, c.maxPlayers, c.openBrowser, c.gmLoopback], [5000, 8, false, false]);
  });

  it("pasta de sons (E25): sem padrão na linha de comando; --sounds-dir vence SOUNDS_DIR", () => {
    assert.equal(parseConfig([], {}).soundsDir, null);
    assert.equal(parseConfig([], { SOUNDS_DIR: "/sons" }).soundsDir, "/sons");
    assert.equal(parseConfig(["--sounds-dir", "C:/Sons"], { SOUNDS_DIR: "/sons" }).soundsDir, "C:/Sons");
  });

  it("valores inválidos dão erro legível", () => {
    assert.throws(() => parseConfig(["--port", "abc"], {}), ConfigError);
    assert.throws(() => parseConfig(["--port", "70000"], {}), ConfigError);
    assert.throws(() => parseConfig([], { MAX_PLAYERS: "0" }), ConfigError);
    assert.throws(() => parseConfig(["--gm-key", "curta"], {}), ConfigError);
  });
});

describe("endereços de convite", () => {
  it("PUBLIC_URLS substitui os detectados", () => {
    const h = hostInfo(3000, KEY, ["http://100.64.0.5:3000"]);
    assert.deepEqual(h.addresses, [{ label: "Configurado", url: "http://100.64.0.5:3000" }]);
  });

  it("no modo container (sem detecção) e sem PUBLIC_URLS, não inventa endereços", () => {
    assert.deepEqual(hostInfo(3000, KEY, [], false).addresses, []);
    assert.equal(hostInfo(3000, KEY, ["http://10.0.0.5:8080"], false).addresses.length, 1, "PUBLIC_URLS continua valendo");
  });

  it("DETECT_ADDRESSES=0 / --no-detect-addresses desligam a detecção", () => {
    assert.equal(parseConfig([], {}).detectAddresses, true);
    assert.equal(parseConfig([], { DETECT_ADDRESSES: "0" }).detectAddresses, false);
    assert.equal(parseConfig(["--no-detect-addresses"], {}).detectAddresses, false);
  });

  it("sem PUBLIC_URLS, usa as interfaces de rede com a porta real", () => {
    const h = hostInfo(3007, KEY);
    assert.ok(h.addresses.every((a) => a.url.endsWith(":3007")));
  });
});
