// Notas da GitHub Release: a seção da versão no CHANGELOG.md + como baixar e rodar.
// Uso: node scripts/release-notes.mjs <versão> [dono/repo]
// Sai com erro se o CHANGELOG não tiver a seção da versão (a release não é publicada).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [version, repo = "jorgemombach/rpgtabletop"] = process.argv.slice(2);
if (!version) {
  console.error("Uso: node scripts/release-notes.mjs <versão> [dono/repo]");
  process.exit(1);
}

const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const escaped = version.replace(/\./g, "\\.");
const match = changelog.match(new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, "m"));
if (!match || !match[1].trim()) {
  console.error(`CHANGELOG.md não tem a seção "## [${version}]" (ou ela está vazia).`);
  process.exit(1);
}

// Tira as definições de link do rodapé do CHANGELOG ("[1.0.0]: https://…").
const section = match[1]
  .split("\n")
  .filter((line) => !/^\[[^\]]+\]:\s*https?:\/\//.test(line))
  .join("\n")
  .trim();

const exe = (os) => `jamals-tabletop-${version}-${os}`;
console.log(`${section}

## Para quem vai mestrar

Baixe o app do seu sistema em **Assets** (abaixo) e abra com dois cliques: a mesa abre numa janela própria, já como mestre. Os jogadores não instalam nada: entram pelo navegador (endereço ou QR code do painel *Convidar jogadores*).

| Sistema | Arquivo |
|---|---|
| Windows | \`${exe("win-x64")}.exe\` (portátil: não instala) |
| Linux | \`${exe("linux-x64")}.AppImage\` (rode \`chmod +x\` antes) |
| macOS (Apple Silicon) | \`${exe("macos-arm64")}.dmg\` |

- **Windows:** na primeira vez, o SmartScreen avisa "O Windows protegeu o computador" (o app não tem assinatura paga): clique em **Mais informações → Executar assim mesmo**. No aviso do Firewall, permita em **Redes privadas**.
- **macOS:** abra o \`.dmg\` e arraste o app para *Aplicativos*. Sem assinatura da Apple, a primeira abertura é bloqueada: rode \`xattr -cr "/Applications/Jamal's Tabletop.app"\` no Terminal (ou *Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim*).
- Deixe o app aberto durante o jogo; fechar encerra a sessão (com alterações não salvas, ele oferece **Salvar e sair**).
- Jogando pela internet: todos no mesmo Tailscale. Guia completo no [README](https://github.com/${repo}#readme).

Para conferir a integridade do download, compare com \`SHA256SUMS.txt\`.

## Docker

\`\`\`bash
docker run -d -p 3000:3000 -e GM_KEY=uma-chave-sua -e PUBLIC_URLS=http://SEU-IP:3000 ghcr.io/${repo}:${version}
\`\`\``);
