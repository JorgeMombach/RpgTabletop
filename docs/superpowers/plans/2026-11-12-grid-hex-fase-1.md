# Grid hexagonal, Fase 1: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** uma cena pode usar grid hex (pontas para cima ou lado em cima) e o combate funciona: grid desenhado, tokens encaixando, criaturas grandes em formas de hex, régua em hexes e servidor conferindo ocupação; o que ainda não existe em hex fica desligado (tela e servidor).

**Architecture:** `shared/src/gridGeometry.ts` concentra a geometria das três grades atrás de uma interface única; posições continuam `{ col, row }` (offset "odd-r" / "odd-q"). O quadrado delega para as funções atuais de `shared/src/grid.ts`, então nada muda fora do hex. Servidor e cliente trocam as contas do quadrado pela geometria da cena.

**Tech Stack:** TypeScript, node:test, React + react-konva + Mantine.

**Spec:** [docs/design/grid-hex.md](../../design/grid-hex.md)

## Global Constraints

- `map.grid: "square" | "hexRows" | "hexCols"`; ausente = `"square"`; formato do arquivo continua 2.
- Offset: `hexRows` = odd-r (linhas ímpares meio hex à direita); `hexCols` = odd-q (colunas ímpares meio hex para baixo).
- `cellPx` = distância entre centros vizinhos (lado reto a lado reto). Unidades "de casa" = pixels do mapa ÷ `cellPx`, a partir de (`offsetX`, `offsetY`).
- Tamanhos no hex: Miúdo divide; Pequeno/Médio 1; Grande 3 (triângulo; `pos` = canto); Enorme 7 (`pos` = meio); Imenso 19 (`pos` = meio).
- Distância no hex = número de hexes × `feetPerCell`.
- Desligado na cena hex (botão apagado com a dica `map.hexSoon` **e** recusa no servidor): paredes/portas, névoa (pintar, cômodo, ligar, visão), pincel de efeitos, *Espalhar* objetos, áreas de magia e fixar efeito.
- O quadrado não pode mudar de comportamento: os testes atuais passam sem alteração.
- Sem commits do agente: no fim de cada tarefa, parar com a sugestão de commit (`Passo 16: …`) e esperar o Jorge.
- Textos novos em `pt-BR.ts`, `en.ts`, `es.ts`; recusas do servidor em `serverText.ts`; Mantine/tema; ícones Tabler.
- Fechar cada tarefa com `npm run typecheck` e `npm test` verdes.

## Review Focus

1. **Trocar para hex com névoa ligada:** sem desligar, os jogadores ficariam com o mapa todo coberto e sem ferramenta para revelar (Tarefa 3).
2. **Deslocamento normalizado por `cellPx`:** no hex o padrão repete a cada duas linhas/colunas; normalizar errado troca qual hex é qual e "move" os tokens (Tarefa 3).
3. **Arrastar um token Grande no hex:** o centro do desenho não é o centro do hex de `pos`; soltar tem que voltar à mesma forma, sem pular de hex (Tarefa 5).
4. **Linha ímpar/coluna ímpar:** vizinhos e formas mudam com a paridade no offset; testar formas em `pos` par e ímpar (Tarefa 2).
5. **Cena hex carregada de arquivo:** jogador que entra depois recebe `map.grid` e desenha o hex; arquivo antigo abre quadrado (Tarefa 3).

---

### Tarefa 1: protótipo visual (portão de aprovação)

**Files:** HTML no scratchpad, publicado como artifact.

- [ ] **Passo 1:** página com, sobre o couro e sobre um mapa: grid `hexRows` e `hexCols`; tokens Médio, Grande (3), Enorme (7) e Imenso (19) com a moldura atual (aliado círculo, mob quadrado, NPC hexágono) e os hexes ocupados realçados no selecionado; régua de 4 hexes ("4 hexes · 20 ft") realçando os hexes do caminho; barra do mapa e painel *Construir* com Paredes, Névoa, Área e Pincel apagados e a dica "Ainda não disponível no grid hexagonal".
- [ ] **Passo 2:** parar até o Jorge aprovar; registrar em `docs/design/grid-hex.md` §4.

### Tarefa 2: geometria (`shared`)

**Files:**
- Create: `shared/src/gridGeometry.ts`; Modify: `shared/src/index.ts` (export)
- Test: `server/test/grid-geometry.test.ts`

**Interfaces:**
- Produces:
  - `type GridKind = "square" | "hexRows" | "hexCols"`; `const GRID_KINDS: readonly GridKind[]` (em `shared/src/types.ts`, junto de `MapConfig`)
  - `interface CellPoint { x: number; y: number }` (unidades de casa)
  - `geometryOf(kind: GridKind | undefined): GridGeometry`, com:
    - `center(pos: GridPos): CellPoint`
    - `cellAt(p: CellPoint): GridPos`
    - `neighbors(pos: GridPos): GridPos[]`
    - `distance(a: GridPos, b: GridPos): number`
    - `footprint(pos: GridPos, size: Size | undefined): GridPos[]`
    - `shapeCenter(pos: GridPos, size: Size | undefined): CellPoint`
    - `drawSpan(size: Size | undefined): number` (diâmetro do token em casas)
    - `centeredOn(cell: GridPos, size: Size | undefined): GridPos`
    - `nearestCellOf(pos: GridPos, size: Size | undefined, target: GridPos): GridPos`
    - `polygon(pos: GridPos): CellPoint[]`
    - `period: CellPoint` (quanto o padrão leva para se repetir em x e y)
    - `columnStep: number` (distância horizontal entre centros de colunas vizinhas: 1, 1, √3/2)
  - `occupiedCells(list: { pos: GridPos | null; size?: Size }[], kind: GridKind | undefined): GridPos[]` (miúdo não bloqueia)
  - `freeSpotNear(start: GridPos, occupied: GridPos[], size: Size | undefined, kind: GridKind | undefined, maxRadius = 20): GridPos` (busca em anéis de distância da geometria; miúdo devolve `start`)
  - `shapesOverlap(a: GridPos, aSize, b: GridPos, bSize, kind): boolean`

- [ ] **Passo 1: testes que falham** (`describe` por geometria):
  - `"quadrado = grid.ts"`: para posições e tamanhos de amostra, `footprint`, `distance` (= `cellDistance`), `centeredOn`, `nearestCellOf`, `occupiedCells` (= `blockedCells`) e `freeSpotNear` (= `nearestFreeSpot`) iguais às funções atuais; `center({0,0})` = `{0.5, 0.5}`; `period` = `{1, 1}`.
  - `"hex: centro ↔ casa"` (`hexRows` e `hexCols`): para `col, row` de −3 a 3, `cellAt(center(p))` = `p`; `hexRows`: `center({0,0})` = `{0.5, 1/√3}`, `center({0,1}).x` = `1` (linha ímpar deslocada), `center({0,2}).y − center({0,0}).y` = `√3` ; `hexCols` simétrico (troca x↔y); `period` = `{1, √3}` / `{√3, 1}`.
  - `"hex: vizinhos e distância"`: 6 vizinhos distintos, todos a `distance` 1, em linha par e ímpar; `distance({0,0},{3,0})` = 3; distância simétrica.
  - `"hex: formas dos tamanhos"`: tamanhos `undefined/small/medium` → 1 casa; `large` → 3 casas mutuamente vizinhas, contendo `pos`; `huge` → 7 (= `pos` + vizinhos); `gargantuan` → 19 (todas a distância ≤ 2 de `pos`); testado com `pos` em linha (ou coluna) par e ímpar; `drawSpan`: 1, 2, 3, 5.
  - `"hex: lugar livre"`: Grande em `{0,0}` com um ocupado dentro da forma → `freeSpotNear` devolve uma forma sem nenhuma casa ocupada, a distância ≤ 2 de `{0,0}`; sem ocupados → `start`.
- [ ] **Passo 2:** `npm test` → falham.
- [ ] **Passo 3:** implementar. Quadrado delega para `grid.ts` (`sizeSpan` vira o lado). Hex pelas fórmulas da Red Blob Games (offset ↔ cubo, arredondamento cúbico, `pixel_to_hex`) com tamanho do hex `s = 1/√3`. Grande: `pos`, `pos+E`, `pos+SE` (pontas para cima) / `pos`, `pos+SE`, `pos+S` (lado em cima), direções cúbicas. `shapeCenter` = média dos centros da forma.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam. Parar com o commit `Passo 16: geometria do grid (quadrado e hex)`.

### Tarefa 3: a cena guarda o grid

**Files:**
- Modify: `shared/src/types.ts` (`MapConfig.grid?: GridKind`), `shared/src/events.ts` (`GridInput.grid?`)
- Modify: `server/src/actions/map.ts` (`battle:grid`, `map:importUvtt`), `server/src/session-file.ts`
- Modify: `client/src/i18n/serverText.ts`
- Test: `server/test/grid-hex.test.ts`, `server/test/save-guard.test.ts`

**Interfaces:**
- Consumes: `GridKind`, `GRID_KINDS`, `geometryOf(kind).period` (Tarefa 2)
- Produces: `map.grid` na cena (ausente = quadrado); `isHex(map: Pick<MapConfig, "grid">): boolean` em `gridGeometry.ts`

- [ ] **Passo 1: testes que falham:**
  - `"trocar para hex apaga paredes, névoa e pinturas e mantém tokens"`: com parede, névoa ligada com visão e área revelada, pintura de efeito e um mob em `{3,4}`; `battle:grid { grid: "hexRows" }` → `map.grid === "hexRows"`, `walls` vazio, `fog.enabled === false`, `fog.vision === false`, revelado/explorado vazios, sem efeito com `cells`, mob ainda em `{3,4}`; efeitos sem `cells` (área fixada) ficam.
  - `"voltar para quadrado apaga o grid do mapa"`: `grid: "square"` → `map.grid` ausente.
  - `"grid inválido é recusado"`: `grid: "triangulo"` → recusa, nada muda.
  - `"deslocamento no hex normaliza pelo período"`: `hexRows`, `cellPx` 100, `offsetY` 200 → `offsetY` = 200 − 173,21 (= 26,79, arredondado a centésimos); `offsetX` 130 → 30.
  - `"importar do Dungeondraft numa cena hex volta para quadrado"` (reaproveitar o arquivo de exemplo de `uvtt.test.ts`).
  - `save-guard`: `grid: "hexCols"` no mapa da cena ativa e da guardada; `session-file`: arquivo sem `grid` abre sem o campo.
  - `"quem entra recebe o grid"`: jogador que entra depois de trocar recebe `battle.map.grid === "hexRows"`.
- [ ] **Passo 2:** `npm test` → falham.
- [ ] **Passo 3:** `battle:grid` valida `grid` (recusa `"Grid desconhecido."`) antes de mexer; ao mudar de geometria apaga `walls`, pinturas (`effects` com `cells`), névoa (`emptyFog()` mantendo `range`) e `fog.enabled`/`vision` falsos; normaliza `offsetX`/`offsetY` por `geometryOf(grid).period × cellPx`. `map:importUvtt` remove `map.grid`. Arquivo de sessão: `grid` opcional validado contra `GRID_KINDS`.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam. Parar com o commit `Passo 16: a cena guarda o grid (quadrado ou hex)`.

### Tarefa 4: servidor confere ocupação e recusa o que é só do quadrado

**Files:**
- Modify: `server/src/actions/map.ts` (`token:move`, `allies:gather`), `server/src/actions/combatants.ts` (invocar ao lado, `moveOutIfGrown`), `server/src/actions/fog.ts` (`cellsOf` → `footprint`), handlers de `wall:add`, `wall:erase`, `fog:set`, `fog:paint`, `fog:room`, `fog:vision`, `effect:add`, `effect:paint`, `prop:addMany`; `server/src/app.ts` (`area:update`)
- Create: `requireSquareGrid(store: Store): void` em `server/src/actions/map.ts` (recusa `"Ainda não disponível no grid hexagonal."`)
- Test: `server/test/grid-hex.test.ts`

**Interfaces:**
- Consumes: `geometryOf`, `occupiedCells`, `freeSpotNear`, `shapesOverlap`, `isHex` (Tarefas 2 e 3)

- [ ] **Passo 1: testes que falham** (cena `hexRows`):
  - `"Grande no hex não pousa em cima de ninguém"`: ogro `large` em `{2,2}`; goblin em casa da forma do ogro → recusa "Essa casa já está ocupada por Ogro."; goblin em casa vizinha fora da forma → aceita; ogro movido para forma que inclui o goblin → recusa "Não cabe aí: Goblin…".
  - `"invocar, levar o grupo e crescer a ficha caem em lugar livre no hex"`: cada um termina com a forma sem sobreposição (`shapesOverlap` falso com todos) e perto da origem.
  - `"ações só do quadrado são recusadas no hex"`: `wall:add`, `wall:erase`, `fog:set`, `fog:paint`, `fog:room`, `fog:vision`, `effect:add`, `effect:paint`, `prop:addMany` → recusa com a mensagem acima; `prop:add` (objeto avulso) aceita; no quadrado, todas continuam aceitas.
  - `"área no hex não é repassada"`: `area:update` de um jogador numa cena hex não chega aos outros.
- [ ] **Passo 2:** `npm test` → falham.
- [ ] **Passo 3:** trocar `overlaps/footprint/blockedCells/nearestFreeSpot` pelas versões da geometria da cena nesses pontos; `requireSquareGrid` no começo dos handlers listados; `area:update` ignorado em cena hex. Recusa nova no `serverText.ts`.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam (os testes do quadrado sem alteração). Parar com o commit `Passo 16: servidor confere ocupação em hex e recusa o que ainda é só do quadrado`.

### Tarefa 5: cliente — grid, painel, tokens, régua e baús

**Files:**
- Modify: `client/src/map/geometry.ts` (`cellAt`, `cellCenter`, `placeFor` passam a receber o `MapConfig` com `grid` e usar `geometryOf`)
- Modify: `client/src/map/BattleMap.tsx` (`GridLines` desenha polígonos no hex; `RulerShape` usa `distance`, realça os hexes do caminho com `polygon` e o texto `map.hexes`; calibração usa `columnStep`)
- Modify: `client/src/map/Token.tsx` (centro = `shapeCenter`, diâmetro = `drawSpan × cellPx × TOKEN_FILL`; soltar: `pos` = `cellAt(ponto − (shapeCenter − center) de um pos de referência)`; hexes da forma realçados com o token selecionado ou arrastado)
- Modify: `client/src/map/MapChests.tsx` (centro do baú pela geometria)
- Modify: `client/src/components/MapPanel.tsx` (`SegmentedControl` *Quadrado* / *Hex ↕* / *Hex ↔* com `confirmAction` quando há paredes, névoa ou pinturas)
- Modify: i18n (`map.grid`, `map.gridSquare`, `map.gridHexRows`, `map.gridHexCols`, `map.gridSwitchTitle`, `map.gridSwitchMessage`, `map.hexes`)

**Interfaces:**
- Consumes: `geometryOf`, `isHex` (Tarefas 2 e 3)

- [ ] **Passo 1:** geometria do cliente: as três funções de `client/src/map/geometry.ts` com a geometria da cena (o quadrado dá os mesmos números de hoje).
- [ ] **Passo 2:** grid hex, régua e calibração em `BattleMap.tsx`; texto da régua no hex: `"20 ft · 4 hexes"`.
- [ ] **Passo 3:** tokens e baús; painel *Mapa* com a escolha do grid e a confirmação.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam. No navegador (mestre + jogador pelo IP da rede), nas duas orientações: grid alinhado; Médio, Grande, Enorme e Imenso encaixando e soltando na mesma forma em linha par e ímpar (Review Focus 3); régua; baú; cena quadrada idêntica a antes. Parar com o commit `Passo 16: grid hex no mapa, tokens e régua`.

### Tarefa 6: ferramentas desligadas no hex e documentação

**Files:**
- Modify: `client/src/map/MapToolbar.tsx` e `client/src/components/BuildPanel.tsx` (Paredes, Névoa, Área, Pincel e o modo *Espalhar* apagados com `Tooltip` `map.hexSoon`; os atalhos dessas ferramentas (Paredes G, Pincel E, Área Q e o da Névoa) não ativam no hex; trocar para hex com uma dessas ferramentas ativa volta para *Mover*)
- Modify: `CHANGELOG.md`, `README.md` (painel *Mapa*), `SPEC.md`, `docs/backlog.md` (Fase 1 feita)

- [ ] **Passo 1:** desligar na tela; i18n `map.hexSoon` = "Ainda não disponível no grid hexagonal".
- [ ] **Passo 2:** no navegador: cena hex com as ferramentas apagadas e dicas; cena quadrada com tudo como antes.
- [ ] **Passo 3:** documentação; `npm run typecheck`, `npm test` e `npm run build` → verdes; checagem de regressão (quem chama `cellAt`, `cellCenter`, `placeFor`, `nearestFreeSpot`, `blockedCells`, `overlaps`). Parar com o commit `Passo 16: fase 1 do grid hexagonal (ferramentas desligadas e documentação)`.
