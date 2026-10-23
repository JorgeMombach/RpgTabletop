const argv = process.argv.slice(2);

export const config = {
  port: Number(process.env.PORT ?? 3000),
  maxPlayers: Number(process.env.MAX_PLAYERS ?? 6),
  /** Em dev o front roda no Vite (porta 5173) e o servidor não abre o navegador. */
  dev: argv.includes("--dev"),
  openBrowser: !argv.includes("--no-open") && process.env.OPEN_BROWSER !== "0",
};
