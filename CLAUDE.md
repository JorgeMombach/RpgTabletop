# CLAUDE.md — Simulador de Encontros

Simulador de combates de RPG de mesa. O mestre roda o servidor (executável, Docker ou código) e os jogadores entram pelo navegador. Monorepo TypeScript: `shared/` (contrato), `server/` (Express + Socket.IO, estado em memória), `client/` (Vite + React + Zustand + react-konva).

**[SPEC.md](SPEC.md) é a fonte da verdade**: escopo, ADRs (decisões e porquês) e entregáveis com definição de pronto. Mudou uma decisão ou o escopo? Atualize a SPEC no mesmo PR.

## Comandos

```bash
npm install          # dependências (workspaces)
npm run dev          # servidor :3000 + Vite :5173 (mestre: localhost:5173)
npm run typecheck    # tsc em shared, server e client
npm test             # testes de integração do servidor (node:test + socket.io-client)
npm run build        # dist/server.cjs (esbuild) + dist/public (client)
npm run package      # executável do SO atual em release/ (Node SEA)
```

Antes de dizer que algo está pronto: `npm run typecheck` e `npm test` passando. Mexeu em build/empacotamento: rode também `npm run build` (e `npm run package` se tocou em `scripts/package.mjs` ou `server/src/static.ts`).

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
- Testes: `useServer()` em `server/test/helpers.ts` sobe um servidor por arquivo. Conexão local = mestre; `client("10.x.x.x")` simula jogador remoto via `X-Forwarded-For`.
- Executável: os nomes dos assets do client (`client-manifest.json`, prefixo `client/`) precisam casar entre `scripts/package.mjs` e `server/src/static.ts`.
- Textos de interface, mensagens de erro e comentários em **português**. Siga o estilo e a densidade de comentários do código ao redor.
- Quebras de linha **LF** (`.gitattributes`). No Windows o `core.autocrlf` está ligado; o `.gitattributes` garante LF no checkout.

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

- **Executável só para o SO atual**: o Node SEA usa o binário do Node da máquina. Linux/macOS saem da CI. Limite de tamanho na CI: 150 MB (Linux dá ~123 MB, quase tudo é o Node).
- **Docker**: dentro do container não há loopback de mestre nem detecção de IP útil (`DETECT_ADDRESSES=0`); convites vêm de `PUBLIC_URLS`.
- **Ambiente Windows do desenvolvedor**: PowerShell 5.1 (sem `&&`); Git Bash disponível. O Node foi instalado via winget — em shells abertos antes da instalação, recarregue o `PATH`.
- `npm` 11 avisa sobre `install-scripts` (esbuild): é aviso, o build funciona.
