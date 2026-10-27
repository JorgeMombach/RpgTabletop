// App do mestre (ADR-18): o servidor da sessão roda aqui dentro e a janela mostra a mesa em localhost.
// Jogadores continuam entrando pelo navegador. `--server-only` sobe sem janela (teste de fumaça da CI).
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { APP_VERSION } from "@rpg/shared";
import { ConfigError, HELP, parseConfig, type Config } from "../../server/src/config";
import { startServer, type RunningServer } from "../../server/src/start";

const args = process.argv.slice(app.isPackaged ? 1 : 2);
const serverOnly = args.includes("--server-only");

let server: RunningServer | null = null;
let win: BrowserWindow | null = null;
/** A mesa (não a tela de abertura) registrou quem decide o fechamento: ver `close` abaixo. */
let rendererGuardsClose = false;
let allowClose = false;

/** O front compilado: dentro do pacote fica em `app.asar/public` (ver scripts/package.mjs); em dev, em `dist/public` da raiz. */
function clientDir(): string {
  return app.isPackaged ? path.join(app.getAppPath(), "public") : path.resolve(__dirname, "../../dist/public");
}

function readConfig(): Config {
  const config = parseConfig(args, process.env);
  // Só o servidor desta máquina: o mestre já está na janela, não abre navegador.
  // Sons do mestre (E25): por padrão, uma pasta ao lado das sessões salvas.
  return { ...config, openBrowser: false, dev: false, soundsDir: config.soundsDir ?? soundsDir() };
}

function soundsDir(): string {
  return path.join(sessionsDir(), "Sons");
}

async function bootServer(): Promise<RunningServer> {
  server ??= await startServer(readConfig(), clientDir());
  return server;
}

function splash(error?: string) {
  void win?.loadFile(path.join(__dirname, "splash.html"), { query: error ? { error } : {} });
}

async function openTable() {
  rendererGuardsClose = false;
  splash();
  try {
    const running = await bootServer();
    await win?.loadURL(running.local);
  } catch (err) {
    splash(err instanceof ConfigError ? `${err.message}\n${HELP}` : (err as Error).message);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    // Mesmo tamanho mínimo da tela do app (LAYOUT em client/src/components/ColumnResizer.tsx).
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#141218",
    title: "Jamal's Tabletop",
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.once("ready-to-show", () => win?.show());

  // Links externos (ex.: ajuda) abrem no navegador; a janela só navega dentro da mesa.
  // Exceção: o log de rolagens em janela própria (para arrastar a outro monitor), que é a própria mesa.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (server && url.startsWith(server.local) && new URL(url).searchParams.get("janela") === "log") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { minWidth: 280, minHeight: 240, backgroundColor: "#141218", autoHideMenuBar: true },
      };
    }
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("did-create-window", (child) => {
    // A janela do log não abre outras nem navega para fora da mesa.
    child.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    child.webContents.on("will-navigate", (event) => event.preventDefault());
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (server && !url.startsWith(server.local)) event.preventDefault();
  });
  win.webContents.on("did-start-navigation", (_e, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) rendererGuardsClose = false;
  });

  // Botão "Salvar" do painel Sessão: sugere a pasta de sessões salvas.
  win.webContents.session.on("will-download", (_e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(sessionsDir(), item.getFilename()) });
  });

  // Fechar: quem decide é a mesa (alterações não salvas → modal "Salvar e sair"). Na tela de abertura, fecha direto.
  win.on("close", (event) => {
    if (allowClose || !rendererGuardsClose) return;
    event.preventDefault();
    win?.webContents.send("close-requested");
  });
  win.on("closed", () => {
    win = null;
    // Fechou a mesa: a janela do log vai junto (senão o app ficaria aberto só com ela).
    for (const other of BrowserWindow.getAllWindows()) other.close();
  });

  void openTable();
}

function sessionsDir(): string {
  return path.join(app.getPath("documents"), "Jamal's Tabletop");
}

ipcMain.on("close-guard", () => (rendererGuardsClose = true));
ipcMain.on("close-confirmed", () => {
  allowClose = true;
  win?.close();
});
ipcMain.on("retry", () => void openTable());
// Abre a pasta de sons no explorador de arquivos (criando, se ainda não existir).
ipcMain.on("open-sounds-folder", () => {
  const dir = readConfig().soundsDir ?? soundsDir();
  fs.mkdirSync(dir, { recursive: true });
  void shell.openPath(dir);
});
ipcMain.handle("save-session", async (_e, json: unknown, fileName: unknown) => {
  if (typeof json !== "string" || typeof fileName !== "string" || !win) return { ok: false };
  const dir = sessionsDir();
  fs.mkdirSync(dir, { recursive: true });
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Salvar sessão",
    defaultPath: path.join(dir, path.basename(fileName)),
    filters: [{ name: "Sessão do Jamal's Tabletop", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, json, "utf8");
  return { ok: true };
});

async function runServerOnly() {
  try {
    const running = await bootServer();
    console.log(running.banner);
  } catch (err) {
    console.error(`\n  ${(err as Error).message}\n`);
    app.exit(1);
  }
}

// Uma janela só: abrir o app de novo traz a que já está aberta para a frente.
if (!serverOnly && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.setName("Jamal's Tabletop");
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    if (serverOnly) return void runServerOnly();
    console.log(`Jamal's Tabletop v${APP_VERSION}`);
    createWindow();
  });

  // Sem janela não há mesa: encerra a sessão junto.
  app.on("window-all-closed", () => {
    if (!serverOnly) app.quit();
  });
  app.on("before-quit", () => {
    void server?.close();
  });
}
