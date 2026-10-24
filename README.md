# Simulador de Encontros

Simulador de combates de RPG de mesa (base D&D 5e). Quem hospeda é o **mestre**: abre o executável e os jogadores entram pelo navegador. O app é um registro compartilhado (vida, iniciativa, slots de magia, mapa e tokens): todo cálculo de dano, movimento e alcance fica com a mesa e as fichas. Nada é salvo: fechou a sessão, tudo some.

**⬇️ Baixar:** [última versão](https://github.com/JorgeMombach/RpgTabletop/releases/latest) (Windows, Linux e macOS) · [Changelog](CHANGELOG.md) · [Especificação e decisões](SPEC.md)

## Para quem vai mestrar

Não precisa instalar nada além do executável.

1. Na [página da última versão](https://github.com/JorgeMombach/RpgTabletop/releases/latest), em **Assets**, baixe o arquivo do seu sistema:

   | Sistema | Arquivo |
   |---|---|
   | Windows | `simulador-encontros-<versão>-win-x64.exe` |
   | Linux | `simulador-encontros-<versão>-linux-x64` |
   | macOS (Apple Silicon) | `simulador-encontros-<versão>-macos-arm64` |

2. **Dois cliques** no arquivo. Abre uma janela preta com os endereços e o navegador abre sozinho, já como mestre.
   - **Windows — "O Windows protegeu o computador"** (SmartScreen): o executável não tem assinatura digital paga. Clique em **Mais informações → Executar assim mesmo**. Só na primeira vez.
   - **Windows — "Permitir acesso à rede?"** (Firewall): marque **Redes privadas** e clique em **Permitir**. Sem isso os jogadores não conseguem entrar.
   - **macOS:** se aparecer "desenvolvedor não identificado", botão direito no arquivo → **Abrir** → **Abrir**.
   - **Linux:** `chmod +x simulador-encontros-*-linux-x64` e execute.
3. Passe para os jogadores o endereço que aparece em **Jogadores** na janela (também no painel *Convidar jogadores* do app). Jogando pela internet, todos precisam estar no mesmo Tailscale (veja abaixo).
4. **Deixe a janela aberta** durante o jogo. Fechar a janela encerra a sessão.

**Link de mestre:** a janela também mostra um link `…/?gm=<chave>`. Quem abre esse link entra como mestre de qualquer dispositivo (ex.: mestrar pelo notebook enquanto o executável roda no PC da sala). **Não compartilhe com os jogadores.** A chave muda a cada execução, a menos que você fixe uma com `--gm-key` (veja *Opções*). Sem o link, o mestre é quem abre `http://localhost:3000` na própria máquina — pelo IP da rede, mesmo na própria máquina, entra como jogador.

## Jogadores: conectando

Só precisa de um navegador.

- **Mesma rede (LAN):** abra o endereço `http://192.168.x.x:3000` que o mestre passar.
- **Pela internet:** usem uma VPN mesh. Recomendado: [Tailscale](https://tailscale.com/download) (alternativas: ZeroTier, Radmin VPN).
  1. Todos (mestre e jogadores) instalam o Tailscale e entram na mesma rede: o mestre convida pelo painel do Tailscale ou compartilha a máquina dele.
  2. O mestre passa o endereço `http://100.x.x.x:3000` (aparece como "Tailscale" na janela e no app).

Recarregar a página ou cair a conexão devolve o jogador com a mesma identidade e o mesmo personagem.

## Roteiro de uma sessão

1. **Jogadores** criam o próprio personagem em *Aliados* (nome, vida máx., mod. DES, cor, avatar).
2. **Mestre** monta o campo:
   - *Mapa*: envia a imagem e clica em *Calibrar pelo mapa* — arrasta um retângulo sobre um ou mais quadrados do desenho e informa quantos cabem na largura. Sliders fazem o ajuste fino. 1 quadrado = 5 ft.
   - *Bestiário*: cria templates (ex.: Goblin) e adiciona N mobs de uma vez ("Goblin 1"…"Goblin N"), ou um mob avulso.
   - Arrasta mobs e aliados da lista para o mapa (ou *Colocar no mapa* no painel *Selecionado*).
3. **Iniciativa**: o mestre clica *Rolar mobs* (opção de uma rolagem por template); cada jogador rola a sua ou digita o valor do dado físico. *Iniciar combate* → *Próximo turno*. O token e a linha de quem está na vez ficam destacados; o jogador vê "Sua vez!".
4. **Combate**: a vida só soma/subtrai o que for digitado (− Dano / + Cura; Enter = dano, Shift+Enter = cura). O mestre controla a vida dos mobs (jogadores não a veem); cada jogador controla a própria. Mob com 0 de vida fica marcado ✕ e sai quando o mestre remove (com *Desfazer*).
5. **Magias**: no painel *Selecionado*, cada jogador ajusta quantos slots tem por nível, clica nas bolinhas para gastar/recuperar e anota magias para referência. *Recuperar slots* e *Restaurar tudo* (vida cheia + slots) ficam a critério do jogador.
6. **Fim da luta**: *Encerrar* (no painel Iniciativa) zera rounds e iniciativas. **🧹 Limpar campo** (barra do topo) tira mapa, mobs, iniciativa e posições para montar a próxima batalha — jogadores continuam conectados e personagens mantêm vida, slots e magias. O bestiário pode ser mantido.

**Dados**: botões d4–d100 com quantidade e modificador, expressão livre (`2d6+1d4+3`), vantagem/desvantagem; o log é compartilhado e o mestre pode rolar oculto.

**Mapa**: roda do mouse = zoom; arrastar o fundo = mover a visão; *Ajustar* enquadra o mapa; *Régua* (ou **Shift** + arrastar) mede em pés, visível para todos. Painéis laterais recolhem clicando no título.

## Opções

Para quem quer ajustar algo. Passe como argumento ao executável (ex.: `simulador-encontros-1.1.0-win-x64.exe --port 4000`) ou como variável de ambiente; o argumento vence. `--help` lista tudo.

| Argumento | Variável | Padrão | Uso |
|---|---|---|---|
| `--port` | `PORT` | `3000` | Porta inicial (se ocupada, usa a próxima livre e avisa) |
| `--max-players` | `MAX_PLAYERS` | `6` | Limite de jogadores conectados (além do mestre) |
| `--no-open` | `OPEN_BROWSER=0` | abre | Não abre o navegador ao iniciar |
| `--gm-key` | `GM_KEY` | gerada | Chave de mestre fixa (mín. 8 caracteres) |
| `--no-gm-loopback` | `GM_LOOPBACK=0` | ligado | localhost deixa de ser mestre; só a chave vale (Docker) |
| `--public-urls` | `PUBLIC_URLS` | detectados | Endereços de convite, separados por vírgula |
| `--no-detect-addresses` | `DETECT_ADDRESSES=0` | ligado | Não lista os IPs da máquina como convite (Docker) |

`GET /healthz` responde `{"ok":true,"version":…}` (usado no healthcheck do Docker).

## Alternativa: Docker

Para quem já usa Docker ou tem um servidor em casa. A imagem oficial é publicada a cada versão em `ghcr.io/jorgemombach/rpgtabletop` (tags `latest`, `X.Y` e `X.Y.Z`).

No container o mestre **não** é reconhecido por `localhost` (as conexões chegam pela rede interna do Docker): ele entra pelo **link com a chave**, mostrado nos logs. Os endereços de convite também não são detectados lá dentro: informe-os em `PUBLIC_URLS`.

```bash
docker run -d --name simulador -p 3000:3000 -e GM_KEY=uma-chave-sua -e PUBLIC_URLS=http://192.168.0.10:3000 ghcr.io/jorgemombach/rpgtabletop:latest
```

```bash
docker logs simulador
```

O log mostra o *Link de mestre* e os endereços dos jogadores. Para encerrar: `docker stop simulador`.

Com o [`docker-compose.yml`](docker-compose.yml) do repositório (edite `GM_KEY` e `PUBLIC_URLS` antes): `docker compose up -d`, `docker compose logs`, `docker compose down`.

- `GM_KEY`: fixe uma chave (mín. 8 caracteres) para o link do mestre não mudar a cada reinício; sem ela, uma nova é gerada a cada início.
- `PUBLIC_URLS`: o(s) endereço(s) pelos quais os jogadores chegam nesta máquina (IP da LAN e/ou do Tailscale). Se publicar em outra porta (`-p 8080:3000`), use essa porta nos endereços.
- A imagem roda como usuário sem privilégios, tem healthcheck em `/healthz` e encerra limpo com `docker stop`.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "O Windows protegeu o computador" | Normal para executável sem assinatura paga: **Mais informações → Executar assim mesmo**. |
| A janela abre e fecha na hora | Rode pelo terminal (`.\simulador-encontros-…-win-x64.exe`) para ver a mensagem. Erros de inicialização também pedem Enter antes de fechar. |
| App subiu em outra porta (3001…) | A 3000 estava ocupada (outra sessão aberta?). Use o endereço que a janela mostrar, ou feche a outra sessão. |
| Jogador não conecta pela LAN | Confira se estão na mesma rede e se o Firewall do Windows permitiu o app em **Redes privadas**. Se negou sem querer, libere a porta (PowerShell como administrador): `New-NetFirewallRule -DisplayName "Simulador de Encontros" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow` |
| Jogador não conecta pela internet | Todos precisam estar logados na mesma rede do Tailscale; use o endereço `100.x.x.x`. |
| Mestre entrou como "Jogador" | Abra `http://localhost:3000` na máquina do mestre, ou use o link de mestre (`?gm=`) da janela. |
| "Sala cheia" | Limite de 6 jogadores; aumente com `--max-players`. |

## Desenvolvimento

Para quem mexe no código. Requer **Node.js 20.12 ou mais novo** (testado no 24 LTS); no Windows: `winget install OpenJS.NodeJS.LTS`.

```bash
npm install
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor (3000) + Vite (5173) com hot reload. Mestre em `http://localhost:5173`, jogadores em `http://<ip>:5173` |
| `npm run typecheck` | `tsc` em shared, server e client |
| `npm test` | Testes de integração do servidor |
| `npm run build` | Gera `dist/server.cjs` (servidor num arquivo, via esbuild) e `dist/public/` (client) |
| `npm start` | Roda `node dist/server.cjs` (precisa do `build` antes). A pasta `dist/` roda em qualquer máquina com Node, sem `npm install` |
| `npm run package` | Gera o executável do **sistema atual** em `release/` (Node SEA, ADR-11), com ícone e versão no Windows |
| `npm run icon` | Regera `assets/icon.ico` |

Regras do projeto (fluxo, testes, changelog, release) estão no [CLAUDE.md](CLAUDE.md).

### Fluxo de trabalho e CI

- A `master` é protegida: toda mudança vai numa branch (`feat/…`, `fix/…`, `docs/…`) e entra por Pull Request com os checks verdes.
- Checks de todo PR (aba **Checks**):
  - **Testes** no Linux e no Windows: typecheck, testes e build.
  - **Executáveis** de Windows, Linux e macOS, com teste de fumaça. Ficam 7 dias em **Artifacts** na página da execução — bom para testar antes do merge.
  - **Build e teste de fumaça** da imagem Docker.

### Publicar uma versão

O `CHANGELOG.md` e a versão **não são atualizados sozinhos**: a CI só confere.

1. Numa branch: atualize `version` no `package.json` (SemVer: correção → `1.1.1`, novidade → `1.2.0`), rode `npm install --package-lock-only` e mova as notas de *Não lançado* para `## [X.Y.Z] - AAAA-MM-DD` no [CHANGELOG.md](CHANGELOG.md) (e os links do rodapé). PR e merge.
2. Na `master` atualizada, crie e envie a tag:

   ```bash
   git tag v1.2.0
   ```

   ```bash
   git push origin v1.2.0
   ```

3. O workflow **Release** confere se a tag bate com o `package.json` e se o CHANGELOG tem a seção, gera os 3 executáveis, publica a imagem no GHCR e cria a GitHub Release com as notas, os executáveis e o `SHA256SUMS.txt`.

Se a tag não bater com a versão, a release falha antes de publicar qualquer coisa: apague a tag (`git push --delete origin vX.Y.Z` e `git tag -d vX.Y.Z`), corrija e crie de novo.

### Estrutura

```
shared/   tipos do estado, contrato dos eventos Socket.IO, limites, regra de distância e versão
server/   Express + Socket.IO; estado em memória, ações (src/actions), permissões e filtro por papel
client/   Vite + React + Zustand; mapa com react-konva (src/map)
scripts/  build (dist/), executável (release/), ícone e notas de release
assets/   ícone do executável
.github/  CI (testes, executáveis, Docker) e release
```

A versão do app é o campo `version` do `package.json` raiz: aparece na interface, no console e no `/healthz`.

## Status

| Entregável | Status |
|---|---|
| E1–E7 — Simulador jogável (sessão, combatentes, dados, mapa, iniciativa, magias, ciclo da batalha) | ✅ v1.0.0 |
| E8 — Preparação para distribuição | ✅ v1.1.0 |
| E9 — Imagem Docker | ✅ v1.1.0 |
| E10 — Executável | ✅ v1.1.0 |
| E11 — CI/CD e releases | ✅ v1.1.0 |
| E12 — Launcher com janela própria | Opcional, a decidir após sessões reais |
