import { randomBytes } from "node:crypto";

export interface Config {
  port: number;
  maxPlayers: number;
  /** Em dev o front roda no Vite (porta 5173) e o servidor não abre o navegador. */
  dev: boolean;
  openBrowser: boolean;
  /** Chave de mestre (ADR-12): do ambiente/argumento ou gerada a cada execução. */
  gmKey: string;
  gmKeyGenerated: boolean;
  /** Conexão local (localhost) vira mestre. Desligado no Docker. */
  gmLoopback: boolean;
  /** Endereços de convite fixos (ex.: dentro do Docker), no lugar dos detectados. */
  publicUrls: string[];
  /** Detectar endereços pelas interfaces de rede. No Docker só se vê o IP interno do container. */
  detectAddresses: boolean;
  /** Pasta de sons do mestre (E25); `null` = só os sons gerados pelo app (o app do mestre usa Documentos). */
  soundsDir: string | null;
  help: boolean;
}

export class ConfigError extends Error {}

export const HELP = `
Jamal's Tabletop

Uso: jamals-tabletop [opções]

  --port <n>           Porta (padrão 3000; se ocupada, tenta as seguintes)   [PORT]
  --max-players <n>    Limite de jogadores conectados (padrão 6)             [MAX_PLAYERS]
  --no-open            Não abre o navegador ao iniciar                       [OPEN_BROWSER=0]
  --gm-key <chave>     Chave de mestre fixa (padrão: gerada a cada execução)  [GM_KEY]
  --no-gm-loopback     localhost não vira mestre; só a chave vale            [GM_LOOPBACK=0]
  --public-urls <a,b>  Endereços de convite para os jogadores                [PUBLIC_URLS]
  --no-detect-addresses  Não lista os IPs desta máquina como convite         [DETECT_ADDRESSES=0]
  --sounds-dir <pasta> Pasta com músicas e sons do mestre                    [SOUNDS_DIR]
  --help               Mostra esta ajuda
`;

/** Lê `--nome valor` ou `--nome=valor`. */
function argValue(argv: string[], name: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === `--${name}`) return argv[i + 1];
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
}

function intIn(raw: string | undefined, label: string, min: number, max: number, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`Valor inválido para ${label.toLowerCase()}: "${raw}" (use ${min}–${max}).`);
  return n;
}

function off(raw: string | undefined): boolean {
  return raw !== undefined && ["0", "false", "no", "off"].includes(raw.toLowerCase());
}

/** Argumentos têm prioridade sobre variáveis de ambiente. */
export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): Config {
  const has = (flag: string) => argv.includes(`--${flag}`);
  const gmKeyRaw = (argValue(argv, "gm-key") ?? env.GM_KEY ?? "").trim();
  if (gmKeyRaw && gmKeyRaw.length < 8) throw new ConfigError("A chave de mestre precisa de pelo menos 8 caracteres.");

  const urls = argValue(argv, "public-urls") ?? env.PUBLIC_URLS ?? "";
  return {
    port: intIn(argValue(argv, "port") ?? env.PORT, "Porta", 0, 65535, 3000),
    maxPlayers: intIn(argValue(argv, "max-players") ?? env.MAX_PLAYERS, "Limite de jogadores", 1, 50, 6),
    dev: has("dev"),
    openBrowser: !has("no-open") && !off(env.OPEN_BROWSER),
    gmKey: gmKeyRaw || randomBytes(12).toString("base64url"),
    gmKeyGenerated: !gmKeyRaw,
    gmLoopback: !has("no-gm-loopback") && !off(env.GM_LOOPBACK),
    publicUrls: urls
      .split(",")
      .map((u) => u.trim().replace(/\/+$/, ""))
      .filter(Boolean),
    detectAddresses: !has("no-detect-addresses") && !off(env.DETECT_ADDRESSES),
    soundsDir: (argValue(argv, "sounds-dir") ?? env.SOUNDS_DIR ?? "").trim() || null,
    help: has("help") || has("h"),
  };
}
