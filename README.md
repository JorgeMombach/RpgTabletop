# Simulador de Encontros

Simulador de combates de RPG de mesa (base D&D 5e) para rodar localmente. Quem hospeda é o **mestre**; os jogadores entram pelo navegador. O app é um registro compartilhado (vida, iniciativa, slots, mapa e tokens): todo cálculo de dano, movimento e alcance fica com a mesa e as fichas. Nada é salvo: desligou o servidor, a sessão some.

**⬇️ Baixar:** [última versão](https://github.com/JorgeMombach/RpgTabletop/releases/latest) (executáveis para Windows, Linux e macOS) · [Changelog](CHANGELOG.md)

Especificação, ADRs e entregáveis em [SPEC.md](SPEC.md).

## Para quem vai mestrar (executável)

Não precisa instalar nada além do executável.

1. Baixe o arquivo do seu sistema na [página de releases](https://github.com/JorgeMombach/RpgTabletop/releases/latest), em **Assets** (ex.: `simulador-encontros-1.1.0-win-x64.exe`).
2. **Dois cliques** nele. Abre uma janela preta com os endereços e o navegador abre sozinho já como mestre.
   - **Windows — "O Windows protegeu o computador"** (SmartScreen): o executável não tem assinatura digital paga. Clique em **Mais informações → Executar assim mesmo**. Só acontece na primeira vez.
   - **Windows — "Permitir acesso à rede?"** (Firewall): marque **Redes privadas** e clique em **Permitir**. Sem isso os jogadores não conseguem entrar.
   - **macOS**: se aparecer "não pode ser aberto porque é de um desenvolvedor não identificado", clique com o botão direito no arquivo → **Abrir** → **Abrir**.
   - **Linux**: `chmod +x simulador-encontros-*-linux-x64` e execute.
3. Passe para os jogadores o endereço que aparece em **Jogadores** na janela (ou no painel *Convidar jogadores*). Se forem jogar pela internet, todos precisam estar no mesmo Tailscale (ver *Jogadores: conectando*).
4. **Deixe a janela aberta** durante o jogo. Fechar a janela encerra a sessão (e apaga tudo — não há salvamento).

As opções da tabela abaixo também valem para o executável: `simulador-encontros-1.1.0-win-x64.exe --port 4000`.

## Mestre: do zero até a sessão no ar (pelo código)

### 1. Instalar o Node.js (só na máquina do mestre)
Node.js 20 ou mais novo (testado no 24 LTS). No Windows:

```powershell
winget install OpenJS.NodeJS.LTS
```

Ou baixe em [nodejs.org](https://nodejs.org). Feche e abra o terminal depois de instalar.

### 2. Instalar e compilar (uma vez, ou depois de atualizar o código)

```bash
npm install
npm run build
```

### 3. Subir a sessão (toda vez que for jogar)

```bash
npm start
```

O `npm run build` gera `dist/server.cjs` (o servidor inteiro num arquivo) e `dist/public/` (o front). O `npm start` roda `node dist/server.cjs`: dá para copiar a pasta `dist/` para outra máquina com Node e rodar sem `npm install`.

O navegador abre em `http://localhost:3000`: quem acessa por **localhost** é o mestre. O console e o painel **Convidar jogadores** mostram os endereços para passar à mesa. Se a porta 3000 estiver ocupada, o app usa a próxima livre (3001, 3002…) e avisa. Para encerrar a sessão, `Ctrl+C` no terminal.

**Link de mestre:** o console também mostra `http://localhost:3000/?gm=<chave>`. Quem abre esse link entra como mestre de qualquer dispositivo (útil para mestrar pelo notebook enquanto o servidor roda em outro PC, ou no Docker). A chave muda a cada execução, a menos que você fixe uma com `GM_KEY`. **Não compartilhe esse link com os jogadores.** Ele também fica no painel *Convidar jogadores → Abrir como mestre em outro dispositivo*.

> Sem o link, o mestre precisa acessar por `localhost`: se abrir pelo IP da rede/VPN na própria máquina, entra como jogador.

Opções (variável de ambiente ou argumento; o argumento vence). Exemplo: `node dist/server.cjs --port 4000 --no-open`.

| Variável | Argumento | Padrão | Uso |
|---|---|---|---|
| `PORT` | `--port` | `3000` | Porta inicial (se ocupada, tenta as seguintes) |
| `MAX_PLAYERS` | `--max-players` | `6` | Limite de jogadores conectados (além do mestre) |
| `OPEN_BROWSER=0` | `--no-open` | abre | Não abre o navegador ao iniciar |
| `GM_KEY` | `--gm-key` | gerada | Chave de mestre fixa (mín. 8 caracteres) |
| `GM_LOOPBACK=0` | `--no-gm-loopback` | ligado | localhost deixa de ser mestre; só a chave vale (Docker) |
| `PUBLIC_URLS` | `--public-urls` | detectados | Endereços de convite, separados por vírgula |
| `DETECT_ADDRESSES=0` | `--no-detect-addresses` | ligado | Não lista os IPs da máquina como convite (Docker) |

`node dist/server.cjs --help` lista tudo. Há também `GET /healthz`, que responde `{"ok":true,"version":…}` (usado no healthcheck do Docker).

### Firewall do Windows
Na primeira execução o Windows pergunta se o Node pode aceitar conexões: permita em **redes privadas**. Se os jogadores não conseguirem conectar, libere a porta (PowerShell como administrador):

```powershell
New-NetFirewallRule -DisplayName "Simulador de Encontros" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## Alternativa: rodar com Docker

Para quem já usa Docker (ou tem um servidor em casa). Quem for só mestrar no próprio PC pode ignorar esta seção.

No container o mestre **não** é reconhecido por `localhost` (as conexões chegam pela rede interna do Docker): ele entra pelo **link com a chave**, mostrado nos logs. Os endereços de convite também não são detectados lá dentro: informe-os em `PUBLIC_URLS`.

**Com o `docker-compose.yml` do repositório** (edite `GM_KEY` e `PUBLIC_URLS` antes):

```bash
docker compose up -d --build
```

```bash
docker compose logs
```

O log mostra o *Link de mestre* e os endereços dos jogadores. Para encerrar: `docker compose down`.

**Só com `docker`:**

```bash
docker build -t simulador-encontros .
```

```bash
docker run -d --name simulador -p 3000:3000 -e GM_KEY=uma-chave-sua -e PUBLIC_URLS=http://192.168.0.10:3000 simulador-encontros
```

- `GM_KEY`: fixe uma chave (mín. 8 caracteres) para o link do mestre não mudar a cada reinício; sem ela, uma nova é gerada e aparece em `docker logs simulador`.
- `PUBLIC_URLS`: o(s) endereço(s) pelos quais os jogadores chegam nesta máquina (IP da LAN e/ou do Tailscale), separados por vírgula. Se publicar em outra porta (`-p 8080:3000`), use essa porta nos endereços.
- A imagem roda como usuário sem privilégios, tem healthcheck em `/healthz` e encerra limpo com `docker stop`.
- O build da imagem roda typecheck e testes: se algo quebrar, a imagem não é gerada.

## Jogadores: conectando

Só precisa de um navegador.

- **Mesma rede (LAN):** abra o endereço `http://192.168.x.x:3000` que o mestre passar.
- **Pela internet:** usem uma VPN mesh. Recomendado: [Tailscale](https://tailscale.com/download) (alternativas: ZeroTier, Radmin VPN).
  1. Todos (mestre e jogadores) instalam o Tailscale e entram na mesma rede: o mestre convida pelo painel do Tailscale ou compartilha a máquina dele.
  2. O mestre passa o endereço `http://100.x.x.x:3000` (aparece como "Tailscale" no console e no app).

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

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| App subiu em outra porta (3001…) | A 3000 estava ocupada (outro servidor aberto?). Use o endereço que o console mostrar, ou feche o outro servidor. |
| Jogador não conecta pela LAN | Libere o firewall (acima) e confira se estão na mesma rede. |
| Jogador não conecta pela internet | Todos precisam estar logados na mesma rede do Tailscale; use o endereço `100.x.x.x`. |
| Mestre entrou como "Jogador" | Abra `http://localhost:3000` na máquina do servidor, ou use o link de mestre (`?gm=`) mostrado no console. |
| "Sala cheia" | Limite de 6 jogadores; aumente com `MAX_PLAYERS`. |
| `Cannot find module …dist/server.cjs` ou `Cannot GET /` | Rode `npm run build` antes do `npm start`. |

## Desenvolvimento

```bash
npm run dev        # servidor (3000) + Vite (5173) com hot reload
npm run typecheck  # tsc em shared, server e client
npm test           # testes de integração do servidor
```

Em dev o mestre usa `http://localhost:5173` e os jogadores `http://<ip>:5173`; o Vite faz proxy do Socket.IO e repassa o IP real do cliente para o servidor decidir quem é mestre.

### Gerar o executável

```bash
npm run package
```

Gera `release/simulador-encontros-<versão>-<sistema>-<arquitetura>[.exe]` para o **sistema em que o comando roda** (o Node SEA usa o binário do Node da própria máquina; ver ADR-11). O executável leva o Node, o servidor e o client embutidos (~90 MB). No Windows, também grava o ícone (`assets/icon.ico`, gerado por `npm run icon`) e nome/versão nas propriedades do arquivo. Para Linux e macOS, rode o mesmo comando nesses sistemas — a CI do E11 faz isso automaticamente.

### Fluxo de trabalho e CI

- A `master` é sempre jogável. Cada mudança vai numa branch (`feat/…`, `fix/…`) e entra por Pull Request.
- Todo PR roda (aba **Checks**):
  - **CI / Testes** no Linux e no Windows: typecheck, testes e build.
  - **CI / Executáveis**: gera e testa o executável de Windows, Linux e macOS. Os arquivos ficam disponíveis por 7 dias na página da execução (**Artifacts**), bom para testar antes do merge.
  - **Docker / Build e teste de fumaça**: constrói e testa a imagem.

### Publicar uma versão

1. Numa branch, atualize `version` no `package.json` (SemVer: correção → `1.1.1`, novidade → `1.2.0`) e mova as notas de *Não lançado* para `## [X.Y.Z] - data` no [CHANGELOG.md](CHANGELOG.md). Merge na `master`.
2. Crie e envie a tag na `master` atualizada:

   ```bash
   git tag v1.2.0
   ```

   ```bash
   git push origin v1.2.0
   ```

3. O workflow **Release** confere se a tag bate com o `package.json` e se o CHANGELOG tem a seção, gera os 3 executáveis, publica a imagem `ghcr.io/jorgemombach/rpgtabletop` (tags `X.Y.Z`, `X.Y` e `latest`) e cria a GitHub Release com as notas, os executáveis e o `SHA256SUMS.txt`. Nenhum passo manual.

Se a tag não bater com a versão, a release falha antes de publicar qualquer coisa: apague a tag (`git push --delete origin vX.Y.Z` e `git tag -d vX.Y.Z`), corrija e crie de novo.

### Estrutura

```
shared/   tipos do estado, contrato dos eventos Socket.IO, limites, regra de distância e versão
server/   Express + Socket.IO; estado em memória, ações (src/actions), permissões e filtro por papel
client/   Vite + React + Zustand; mapa com react-konva (src/map)
scripts/  build (dist/), executável (release/, Node SEA), ícone e notas de release
assets/   ícone do executável
```

A versão do app é o campo `version` do `package.json` raiz: aparece na interface, no console e no `/healthz`.

## Status

| Entregável | Status |
|---|---|
| E1 — Fundação e sessão | ✅ |
| E2 — Combatentes e vida | ✅ |
| E3 — Dados | ✅ |
| E4 — Mapa e tokens | ✅ |
| E5 — Iniciativa e turnos | ✅ |
| E6 — Magias | ✅ |
| E7 — Ciclo da batalha e acabamento | ✅ |
| E8 — Preparação para distribuição | ✅ |
| E9 — Imagem Docker | ✅ |
| E10 — Executável | ✅ |
| E11 — CI/CD e releases | 🟡 workflows prontos; falta a primeira release (tag `v1.1.0`) |
