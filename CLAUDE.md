# CLAUDE.md — Jamal's Tabletop

Simulador de combates de RPG de mesa. O mestre roda o servidor (app do mestre, Docker ou código) e os jogadores entram pelo navegador. Monorepo TypeScript: `shared/` (contrato), `server/` (Express + Socket.IO, estado em memória), `client/` (Vite + React + Zustand + react-konva), `desktop/` (app do mestre em Electron, ADR-18).

**[SPEC.md](SPEC.md) é a fonte da verdade**: escopo, ADRs (decisões e porquês) e entregáveis com definição de pronto. Mudou uma decisão ou o escopo? Atualize a SPEC no mesmo PR.

## Comandos

```bash
npm install          # dependências (workspaces)
npm run dev          # servidor :3999 + Vite :5173 (mestre: localhost:5173)
npm run typecheck    # tsc em shared, server, client e desktop
npm test             # testes de integração do servidor (node:test + socket.io-client)
npm run build        # dist/server.cjs (esbuild) + dist/public (client)
npm run app          # compila e abre o app do mestre (Electron) sem empacotar
npm run package      # app do SO atual em release/ (electron-builder)
```

Antes de dizer que algo está pronto: `npm run typecheck` e `npm test` passando. Mexeu em build/empacotamento: rode também `npm run build` (e `npm run package` se tocou em `scripts/package.mjs`, `desktop/` ou `server/src/start.ts`).

## Regras de produto (não quebrar)

- **O app é um registro, não um motor de regras (ADR-06).** Não calcula dano, movimento, alcance nem morte; só soma/subtrai o que a pessoa digita. Movimento é livre.
- **Permissões são validadas no servidor**, nunca só escondidas na UI. Mestre edita tudo; jogador só os próprios aliados.
- **Filtro por papel em `server/src/view.ts`**: jogador nunca recebe vida (`hp`/`hpMax`) de mob, nem a lista de magias de outro jogador, nem `host` (que tem a chave de mestre). Todo dado novo sensível passa por esse filtro, com teste.
- **Quem é mestre (ADR-09/12):** conexão loopback (`localhost`) **ou** a chave de mestre (`?gm=`). No Docker o loopback fica desligado (`GM_LOOPBACK=0`).
- **Links "para outro dispositivo" nunca usam `localhost`**: use o primeiro endereço de convite (`host.addresses[0]`). Esse bug já apareceu duas vezes.
- Nada é persistido em disco (ADR-04).

## Como o código é organizado

- Contrato em `shared/src/events.ts` (`ActionPayloads`, `LIMITS`) e `shared/src/types.ts`.
- **Ação nova** = tipo em `ActionPayloads` → handler em `server/src/actions/*.ts` (registrado em `actions/index.ts`; validar entrada com `server/src/validate.ts`; recusar com `fail()`, mensagem em pt-BR pronta para o usuário) → chamada no client via `act()` (`client/src/actions.ts`) → teste em `server/test/`.
- Handlers devem **validar tudo antes de alterar o estado** (não aplicar edição pela metade).
- **Campo novo no jogo** (combatente, template, efeito, log, clima…) tem que ir no arquivo de sessão (`server/src/session-file.ts`, ida e volta). O `server/test/save-guard.test.ts` usa exemplos `Required<…>`: campo novo esquecido nele quebra o typecheck; esquecido no arquivo de sessão quebra o teste.
- Testes: `useServer()` em `server/test/helpers.ts` sobe um servidor por arquivo. Conexão local = mestre; `client("10.x.x.x")` simula jogador remoto via `X-Forwarded-For`.
- **Subir o servidor** é sempre `startServer()` (`server/src/start.ts`): linha de comando (`index.ts`), Docker e o app Electron (`desktop/src/main.ts`) usam a mesma função.
- **App do mestre (Electron):** a página conversa com o app só pela ponte `window.desktop` (`desktop/src/preload.ts`; no client, `desktop` em `client/src/sessionFile.ts`, `undefined` no navegador). O preload roda em sandbox: só `require("electron")`.
- Textos de interface, mensagens de erro e comentários em **português**. Siga o estilo e a densidade de comentários do código ao redor.
- **Tradução (i18n):** texto novo de interface vai no catálogo `client/src/i18n/pt-BR.ts` (chave agrupada pela tela, ex.: `"dice.rollAttack"`) e entra com `useT()` em componentes ou `t()` fora deles; traduza a mesma chave em `en.ts` e `es.ts` (o que faltar aparece em português). **Recusas do servidor** continuam escritas em português, mas como modelo: `fail("Essa casa já está ocupada por {name}.", { name })` (nada de interpolar com crase); os **avisos automáticos do log** também: `logSystem(store, "{who} passou a vez.", { who })`, e os pedaços do rótulo das rolagens (`label: [{ key: "Iniciativa" }]`). A tradução dos modelos vai em `client/src/i18n/serverText.ts` (rótulos passados como parâmetro, como `requireInt(x, "Vida", …)`, também). O `server/test/server-text.test.ts` falha se um texto novo do servidor ficar sem tradução.
- Quebras de linha **LF** (`.gitattributes`). No Windows o `core.autocrlf` está ligado; o `.gitattributes` garante LF no checkout.

## Padrões de interface (Mantine, ADR-15)

Toda tela nova usa os componentes do **Mantine** e o tema em `client/src/theme.ts`, seguindo a identidade **Grimório sombrio** do [guia visual](docs/design/guia-visual.md) (E20). Não crie botões, campos ou caixas com HTML/CSS próprio.

- **Tema:** cores (`bronze` = destaque e ação principal, `copper` = secundária/sucesso, `red` = sangue/perigo, `player` = aliados, `dark.*` = tinta, couro e pergaminho — tabela no guia visual), fontes (**Alegreya Sans** na interface; **Cinzel só em títulos**, via `ff="heading"` ou `Title`), tamanhos 12/14/16/20/24 e espaçamentos em múltiplos de 4 px. Componentes já vêm em tamanho pequeno por padrão (densidade de painel). Cores fixas (Konva, SVG) usam os mesmos valores do guia.
- **Painel lateral:** sempre `Panel` (`components/Panel.tsx`): a "placa" com cantoneiras de bronze, título em Cinzel recolhível, `aside` para ações à direita, conteúdo empilhado.
- **Ícones:** só **Tabler** (`@tabler/icons-react`, versão de contorno), na cor do texto ao redor (tabela de usos no guia visual). **Nada de emoji** na interface. Exceção: **ornamentos e ícones de jogo** desenhados no mapa (moldura de chefe, e depois condições) vêm do **game-icons.net** (CC BY 3.0): copie só o caminho SVG do que usar para `client/src/map/gameIcons.ts`, com o autor, e acrescente o crédito na tela *Sobre* se for de um autor novo.
- **Ações:** `Button` (`variant="default"` para secundárias; padrão = primária em bronze, uma por painel; `color="red"` para destrutivas). Ícone sozinho: `ActionIcon` **com `Tooltip` e `aria-label`**.
- **Campos:** `TextInput`, `NumberInput` (sem setas por padrão; use `allowDecimal={false}` para inteiros), `Select`, `Checkbox`, `SegmentedControl`, `Slider`, `ColorInput`, `FileButton`.
- **Abreviação** (DES, ft, Qtd.…): `Abbr` (tooltip). **Texto que pode ser longo:** `Text truncate` + `title` com o texto completo.
- **Confirmação:** `confirmAction()` (`client/src/confirm.tsx`) — nunca `window.confirm`. **Aviso rápido:** `toast()` (`client/src/notify.tsx`): `kind` `info`, `success` (deu certo) ou `error`, com `action` para "Desfazer".
- **Painel ou lista vazia:** `EmptyState` (`components/EmptyState.tsx`) com ícone do assunto; `compact` em listas pequenas.
- **Combatente:** `CombatantAvatar` (anel na cor do token; círculo = aliado, quadrado = mob, hexágono = NPC) e `CombatantRow` nas listas.
- **CSS próprio** (`styles.css`) só para layout da tela, mapa e peças sem equivalente no Mantine (placa, linhas das listas, bolinhas de slot, alças de redimensionar). Use as variáveis `--mantine-*`.
- **Tamanho mínimo:** a tela do app tem no mínimo **1024 × 640 px** (`LAYOUT` em `components/ColumnResizer.tsx`); numa janela menor a página rola em vez de encolher. O mapa nunca fica com menos de 480 px: as colunas laterais (260–520 px, arrastáveis) é que cedem. Verifique telas novas com as colunas na largura mínima — nada pode vazar.
- **Celular e tablet (E23):** jogador em tela pequena usa `MobileShell` (abas; decisão em `client/src/layout.ts`). Painel novo de jogador precisa caber em 375 px de largura; teste também em `MobileShell` (no navegador, entre como jogador pelo IP da rede, não por `localhost`, que vira mestre).

## Fluxo de git

- `master` é **protegida**: só entra por Pull Request com os checks verdes. Nunca commitar direto nela.
- Branches: `feat/…`, `fix/…`, `docs/…`, `chore/…`. Entregáveis da SPEC: `feat/eN-nome`.
- Checks obrigatórios: `Testes (ubuntu-latest)`, `Testes (windows-latest)`, `Executáveis / win-x64`, `Executáveis / linux-x64`, `Executáveis / macos-arm64`, `Build e teste de fumaça` (Docker).
- Mensagens de commit curtas, em português, no imperativo ou com o entregável (`E10: executável com Node SEA`).
- Não commitar `dist/`, `release/` nem `node_modules/` (já no `.gitignore`).

## Documentação junto com o código (manual — nada disso é automático)

Em **todo PR**:
- Mudança que o usuário percebe (feature, correção, mudança de comportamento ou opção): adicionar uma linha em `## [Não lançado]` no [CHANGELOG.md](CHANGELOG.md), na subseção certa (*Adicionado*, *Alterado*, *Corrigido*, *Removido*).
- Mudou como se usa, instala ou configura: atualizar o [README.md](README.md) (seções para mestre/jogador ficam sem `npm`; detalhes de código vão em *Desenvolvimento*).
- Nova opção de configuração: `server/src/config.ts` (+ `HELP`), tabela *Opções* do README e teste em `server/test/distribution.test.ts`.
- Mudou decisão, escopo ou entregável: atualizar a SPEC (e a tabela *Status* do README).

## Publicar uma versão (checklist)

A versão e o CHANGELOG **não sobem sozinhos**; o workflow de release só confere e publica.

1. Branch `chore/release-X.Y.Z`:
   - `version` no `package.json` raiz (SemVer: correção → PATCH, novidade compatível → MINOR, quebra → MAJOR).
   - `npm install --package-lock-only` (sincroniza o lock).
   - CHANGELOG: mover o conteúdo de `[Não lançado]` para `## [X.Y.Z] - AAAA-MM-DD`, deixar `[Não lançado]` vazio e atualizar os links de comparação no rodapé.
2. PR, checks verdes, merge.
3. Na `master` atualizada: `git tag vX.Y.Z` e `git push origin vX.Y.Z`.
4. O workflow **Release** falha antes de publicar se a tag ≠ `package.json` ou se o CHANGELOG não tiver a seção. Conferir no fim: Release com 3 executáveis + `SHA256SUMS.txt`, imagem em `ghcr.io/jorgemombach/rpgtabletop`.

## Armadilhas conhecidas

- **App do mestre só para o SO atual**: `npm run package` gera o pacote do sistema em que roda; Linux/macOS saem da CI. Limite de tamanho na CI: 200 MB (Windows dá ~106 MB, quase tudo é o Electron). Teste de fumaça com `--server-only` (sobe sem janela).
- **`.exe` portátil do Windows:** a cada abertura o lançador apaga e reextrai o app numa pasta **fixa** de `%TEMP%`; aberto de novo com o app rodando, ele apaga tudo que não está travado. Por isso o front vai **dentro do `app.asar`** (travado em uso) e não em `extraResources`; não ponha arquivos que o app lê depois de aberto soltos em `resources/`. `unpackDirName: false` não resolve (o electron-builder 26 ignora o `false`).
- **Nome do app no Mac:** `executableName` renomeia também o `.app`; por isso ele fica só em `win`/`linux` em `scripts/package.mjs`.
- **Electron no npm 11:** o npm bloqueia o script que baixa o binário do Electron; para `npm run app` local, rode uma vez `node node_modules/electron/install.js`. O empacotamento não precisa disso (o electron-builder baixa o Electron). Versões de `electron`/`electron-builder` fixas (sem `^`) em `desktop/package.json`: o electron-builder exige.
- **Porta do dev:** o servidor de dev fica na **3999** (fixa, sem pular para a seguinte) e o proxy do Vite aponta para ela. Assim o app do mestre pode ficar aberto na 3000 enquanto se testa o código. Se a 3999 estiver ocupada, o dev para com aviso.
- **Rota HTTP nova no servidor** (ex.: `/sons/…` do E25): acrescente ao `proxy` de `client/vite.config.ts`, senão no `npm run dev` o Vite responde com a página (HTML) em vez de repassar ao servidor. No app e no Docker o próprio servidor serve tudo.
- **Docker**: dentro do container não há loopback de mestre nem detecção de IP útil (`DETECT_ADDRESSES=0`); convites vêm de `PUBLIC_URLS`.
- **Ambiente Windows do desenvolvedor**: PowerShell 5.1 (sem `&&`); Git Bash disponível. O Node foi instalado via winget — em shells abertos antes da instalação, recarregue o `PATH`.
- `npm` 11 avisa sobre `install-scripts` (esbuild): é aviso, o build funciona.
