# Grid hexagonal, Fase 2: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** numa cena hex passam a funcionar as áreas de magia, fixar efeito, efeito que anda com o token, o pincel de efeitos (1, 7 e 19 hexes) e o pincel dos objetos (*Espalhar* e *Apagar*), que na Fase 1 ficaram apagados e recusados.

**Architecture:** três contas novas na geometria do `shared` (casas do pincel, ponto de encaixe da área, ponto sorteado dentro de uma casa); o servidor tira as recusas dessas ações, aceita origem de área fora da meia casa no hex e move a área que segue pelo centro da casa; o cliente troca as contas do quadrado (retângulo do pincel, arredondar a meia casa, `Math.floor`) pela geometria e desenha as pinturas em hex. Paredes, névoa e visão continuam desligadas no hex (Fase 3).

**Tech Stack:** TypeScript, node:test, React + react-konva + Mantine.

**Spec:** [docs/design/grid-hex.md](../../design/grid-hex.md) (§3, Fase 2). Fase 1: [2026-11-12-grid-hex-fase-1.md](2026-11-12-grid-hex-fase-1.md).

## Global Constraints

- Área: origem encaixa no centro ou num vértice do hex; tamanho em pés (o desenho já é geométrico). `MapEffect.cells` continua guardando `col, row`.
- Pincel de efeitos no hex: 1, 7 e 19 hexes (os tamanhos 1, 3 e 5 de hoje viram raio 0, 1 e 2). Pincel dos objetos: os tamanhos 3, 5 e 9 viram raio 1, 2 e 4.
- O quadrado não muda: as contas novas, no quadrado, dão exatamente o que o código faz hoje; os testes atuais passam sem alteração (fora a lista de recusas do hex, que encolhe).
- Continua desligado no hex (botão apagado, recusa no servidor): paredes e portas, névoa, visão (Fase 3).
- Trocar o grid continua soltando o efeito que segue (a área fica parada) e apagando pinturas.
- Textos novos em `pt-BR.ts`, `en.ts`, `es.ts`; Mantine; sem `any` nem cast forçado.
- Sem commits do agente: no fim de cada tarefa, parar com a sugestão de commit (`Passo 16: …`) e esperar o Jorge. Fechar cada tarefa com `npm run typecheck` e `npm test` verdes.

## Review Focus

1. **Efeito preso a um Grande no hex:** ao mover, a área acompanha o meio da forma, sem escorregar meio hex a cada passo (Tarefa 2).
2. **Origem de área vinda do jogador no hex:** número quebrado (centésimos), `NaN`, infinito ou fora do limite; no quadrado, a meia casa continua obrigatória (Tarefa 2).
3. **Pincel do hex em linha par e ímpar:** o pincel de raio 1 em linha ímpar pega os 7 hexes certos, não um losango torto (Tarefa 1).
4. **Objeto espalhado no hex cai dentro dos hexes pincelados**, e *Apagar* pega o objeto pelo hex em que ele está, não pelo quadrado (Tarefas 1 e 4).
5. **Passar o mouse numa pintura hex mostra o nome do efeito** (o acerto era pela casa quadrada) (Tarefa 3).

---

### Tarefa 1: geometria (`shared`)

**Files:**
- Modify: `shared/src/gridGeometry.ts`
- Test: `server/test/grid-geometry.test.ts`

**Interfaces:**
- Produces:
  - `brushCells(center: GridPos, size: number, kind: GridKind | undefined): GridPos[]` — quadrado: o retângulo de `brushRect` (`size × size` centrado, `half = floor(size/2)`); hex: todas as casas a distância ≤ `floor(size/2)` de `center`.
  - `areaAnchor(point: CellPoint, kind: GridKind | undefined): CellPoint` — quadrado: cada eixo arredondado à meia casa (`Math.round(v*2)/2`); hex: o mais perto de `point` entre o centro de `cellAt(point)` e os 6 vértices dele, com x e y arredondados a centésimos.
  - `randomPointIn(cell: GridPos, kind: GridKind | undefined, random: () => number): CellPoint` — quadrado: `{ x: col + random(), y: row + random() }` (o que o `scatter` faz hoje, nessa ordem de sorteio); hex: ponto sorteado na caixa do hex, aceito se `cellAt` dá a própria casa (até 8 tentativas; senão, o centro).

- [ ] **Passo 1: testes que falham** (no `describe` de cada geometria):
  - quadrado: `brushCells({5,5}, 3, "square")` = as 9 casas de `{4,4}` a `{6,6}`; `areaAnchor({x: 2.3, y: 0.74})` = `{2.5, 0.5}`; `randomPointIn({2,3}, "square", sequência 0.25, 0.75)` = `{2.25, 3.75}`.
  - `"hex: pincel"`: para `pos` em linha (ou coluna) par e ímpar: tamanho 1 → `[pos]`; 3 → 7 casas = `pos` + vizinhos; 5 → 19 casas, todas a distância ≤ 2; 9 → 61 casas.
  - `"hex: encaixe da área"`: para pontos sorteados perto de `center({1,1})` e de `center({4,3})`, o resultado é o centro ou um vértice da casa (`polygon`), a no máximo `1/√3 + 0.01` do ponto; um ponto em cima de um vértice devolve o vértice.
  - `"hex: ponto dentro da casa"`: com um gerador fixo, 200 pontos de `randomPointIn(pos, kind, …)` caem todos em `cellAt(...) === pos`, para `pos` par e ímpar.
- [ ] **Passo 2:** `npm test` → falham (funções não existem).
- [ ] **Passo 3:** implementar as três funções em `gridGeometry.ts`; `brushCells` no hex usa os anéis (`axialRing`) com a troca de eixos do `hexCols`, como o `freeSpotNear`.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam. Parar com o commit `Passo 16: geometria do pincel, do encaixe da área e do ponto na casa`.

### Tarefa 2: servidor aceita áreas, efeitos e pincéis no hex

**Files:**
- Modify: `server/src/validate.ts` (`validArea`), `server/src/app.ts` (`area:update`), `server/src/session-file.ts` (efeitos da cena), `server/src/actions/effects.ts` (`effect:add`, `effect:paint`, `effect:follow`, `moveFollowers`), `server/src/actions/props.ts` (`prop:addMany`)
- Test: `server/test/grid-hex.test.ts`

**Interfaces:**
- Consumes: `geometryOf`, `isHex`, `GridKind` (Fase 1).
- Produces: `validArea(raw: unknown, grid?: GridKind): Area | null` — sem `grid` ou no quadrado, igual a hoje (meia casa); no hex, origem com qualquer número finito dentro de `LIMITS.gridCoord`, guardado arredondado a centésimos.

- [ ] **Passo 1: testes que falham** (cena `hexRows`; ajustar o teste da Fase 1 `"ações só do quadrado são recusadas no hex"` para a lista `wall:add`, `wall:erase`, `fog:set`, `fog:paint`, `fog:room`, `fog:vision`, e trocar `"área no hex não é repassada"` pelo teste de repasse abaixo):
  - `"área no hex é repassada com a origem no hex"`: jogador manda `area:update` com origem `{ col: 1.5, row: 1.44 }` → o mestre recebe a mesma origem; com `col: 1.234` → recebe `1.23`; com `NaN` → recebe `area: null`.
  - `"fixar efeito e pintar no hex"`: `effect:add` com origem no centro de `{2,2}` (centésimos) → aceito, origem guardada igual; `effect:paint` com `cells: [1,1, 2,1]` → aceito; `prop:addMany` com um item → aceito.
  - `"efeito preso ao token anda pelo centro do hex"`: mob Grande em `{2,2}`; `effect:add` com `follow: true`, origem = meio da forma (`shapeCenter`, centésimos); `token:move` para `{3,5}` → origem = `shapeCenter({3,5}, "large")` (diferença ≤ 0.01 em cada eixo); `effect:follow` liga e desliga no hex.
  - `"efeito fixado no hex vai e volta no arquivo de sessão"`: efeito com origem em centésimos numa cena hex → `session:export` e `session:import` → a mesma origem (hoje o arquivo recusaria a origem fora da meia casa).
  - no quadrado: `validArea` com origem `0.3` continua `null` (já coberto em `map.test.ts`, que deve passar sem mudança).
- [ ] **Passo 2:** `npm test` → falham.
- [ ] **Passo 3:** tirar `requireSquareGrid` de `effect:add`, `effect:paint`, `effect:follow` e `prop:addMany`; `area:update` deixa de ignorar a cena hex e chama `validArea(area, map.grid)`; `effect:add` e a leitura dos efeitos no arquivo de sessão (`server/src/session-file.ts`, que já leu o `map.grid` da cena) passam o grid da cena para `validArea`; `moveFollowers(store, c, from, to)` desloca a origem por `geometry.center(to) − geometry.center(from)` em x e y (no quadrado dá o mesmo `dc`, `dr` de hoje), arredondando a centésimos no hex. `changeGrid` continua soltando os efeitos que seguem.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam. Parar com o commit `Passo 16: servidor aceita áreas, efeitos e pincéis no hex`.

### Tarefa 3: cliente — áreas, fixar efeito e pinturas em hex

**Files:**
- Modify: `client/src/map/AreaShape.tsx` (`areaOrigin` usa `areaAnchor`), `client/src/map/EffectShape.tsx` (pintura: um hex por casa, com `polygon`), `client/src/map/EffectTip.tsx` (`effectContains` acha a casa com `cellAt` da geometria), `client/src/store.ts` (`SQUARE_ONLY_TOOLS` sem `area` e `paint`)

**Interfaces:**
- Consumes: `areaAnchor` (Tarefa 1); `cellAt`, `toWorld`, `toCellUnits` (`client/src/map/geometry.ts`, Fase 1).

- [ ] **Passo 1:** `areaOrigin(p, g)` = `areaAnchor(toCellUnits(p, g), g.grid)` devolvido como `{ col: x, row: y }` (no quadrado, o mesmo arredondamento de hoje); a ferramenta *Área* (Q) e o *Fixar como efeito* liberados no hex.
- [ ] **Passo 2:** pintura no hex: `EffectShape` desenha cada casa de `cells` como o hexágono da geometria (o resto do desenho — borda esfumaçada, animação — continua); `effectContains` usa a casa da geometria.
- [ ] **Passo 3:** `npm run typecheck` e `npm test` → passam. No navegador, numa cena `hexRows` e numa `hexCols`: cone, esfera e linha saindo do centro e de um vértice; fixar como efeito; efeito preso a um token Grande andando junto; uma pintura (feita na Tarefa 4 ou pelo servidor) aparecendo em hexes com o nome ao passar o mouse; cena quadrada igual a antes. Parar com o commit `Passo 16: áreas de magia e efeitos no grid hex`.

### Tarefa 4: cliente — pincel de efeitos e pincel dos objetos em hex; documentação

**Files:**
- Modify: `client/src/map/BattleMap.tsx` (`paintAt`, `propBrushAt`, o acerto do *Apagar* objetos, o contorno do pincel e a prévia da passada), `client/src/map/scatter.ts` (`scatter` recebe o grid e sorteia com `randomPointIn`), `client/src/map/PaintOptions.tsx` e `client/src/map/MapProps.tsx` (rótulos dos tamanhos no hex; modos *Espalhar*/*Apagar* liberados), `client/src/store.ts` (sem a volta forçada a *Pôr* no hex), `client/src/session.ts`
- Modify: `CHANGELOG.md`, `README.md`, `SPEC.md`, `docs/backlog.md`

**Interfaces:**
- Consumes: `brushCells`, `randomPointIn` (Tarefa 1); `geometryOf(kind).cellAt`.
- Produces: `scatter(set, cells, density, taken, random, kind: GridKind | undefined, max = 300)`.

- [ ] **Passo 1:** pincéis: `paintAt` e `propBrushAt` juntam `brushCells(cell, tamanho, grid.grid)` (o limite de casas de hoje continua); a prévia da passada e o contorno do pincel desenham hexes no hex (no quadrado, os retângulos de hoje); *Apagar* objetos acerta pelo `cellAt` da geometria no ponto do objeto; `scatter` sorteia o ponto com `randomPointIn` (no quadrado, a mesma ordem de sorteio de hoje).
- [ ] **Passo 2:** rótulos do tamanho no hex: o número de hexes do pincel (`t("map.hexes", { n })`: 1, 7, 19 no de efeitos; 7, 19, 61 no dos objetos); no quadrado, `fog.brushSize` como hoje.
- [ ] **Passo 3:** documentação: linha da Fase 2 no CHANGELOG (*Adicionado*) e ajuste da linha da Fase 1 (o que segue desligado); README (painel *Mapa* e o que segue só no quadrado); SPEC (Fase 2 feita, o que fica para a 3); backlog (Fase 2 marcada).
- [ ] **Passo 4:** `npm run typecheck`, `npm test` e `npm run build` → verdes. No navegador, `hexRows` e `hexCols`: pincel de efeitos 1, 7 e 19 em linha par e ímpar, *Apagar* e *Desfazer*; *Espalhar* uma floresta (objetos só dentro dos hexes pincelados) e *Apagar* objetos; ferramentas de paredes e névoa ainda apagadas; cena quadrada igual a antes. Checagem de regressão: quem chama `brushRect`, `areaOrigin`, `scatter`, `validArea`, `moveFollowers`. Parar com o commit `Passo 16: fase 2 do grid hexagonal (pincéis e documentação)`.
