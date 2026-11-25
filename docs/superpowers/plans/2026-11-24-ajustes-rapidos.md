# Ajustes rápidos (bloco 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os seis ajustes rápidos do bloco 1: pincel do terreno, água sem retângulo, aba Construir centrada, água apagando plantas, tochas menores e nada (fora tokens) em cima de parede.

**Architecture:** Ajustes de interface no `BattleMap`/`TerrainOptions`/`BuildPanel`. A regra de parede é uma conta em `shared/` (`touchesWall`), usada pelos handlers de tocha, baú e objeto e pelo pincel de espalhar. As plantas afogadas são achadas no cliente ao soltar a passada (`drownedPlants`) e entram no mesmo passo do Desfazer da pintura.

**Tech Stack:** TypeScript, React + Konva, Mantine, Express + Socket.IO, node:test.

**Spec:** `docs/design/ajustes-rapidos.md`

## Global Constraints

- Sem commits do agente: no fim de cada tarefa, sugestão de `git add`/`git commit` e parada até o "segue".
- Textos em português; recusa do servidor como modelo em `fail(...)`, traduzida em `client/src/i18n/serverText.ts` (en e es).
- Tokens continuam livres: nenhuma conferência de parede em ações de combatente.
- Validar tudo antes de alterar o estado (handlers).
- `npm run typecheck` e `npm test` verdes ao fim de cada tarefa.

## Review Focus

- **Objeto antigo já em cima de parede:** editar giro, tamanho pequeno ou trava sem mover não pode ser recusado. Teste na Task 2 (`prop:update` só com `rotation`).
- **Porta e janela:** pôr uma tocha na linha de uma porta (aberta ou fechada) ou janela passa. Teste na Task 2.
- **Espalhar floresta perto de parede:** o lote não é recusado inteiro; só os itens na parede ficam de fora. Teste na Task 2 (`scatter` com paredes).
- **Passada de água que não cobre o pé:** planta com água só na borda (< metade) fica. Teste na Task 3.
- **Desfazer depois de mexer:** desfazer a água repõe só as plantas que não existem mais (sem duplicar). Conferido no app na Task 3.

---

### Task 1: Pincel, água sem retângulo, aba Construir e tochas menores

**Files:**
- Modify: `client/src/map/BattleMap.tsx` (`terrainAt`, `onPointerLeave` do `Stage`)
- Modify: `client/src/map/terrain/TerrainOptions.tsx` (o `SegmentedControl` de forma)
- Modify: `client/src/components/BuildPanel.tsx` (`styles` do `Button`)
- Modify: `client/src/map/MapTorches.tsx` (`TORCH_CELLS`)

**Interfaces:**
- Produces: `TORCH_CELLS = { stick: 0.5, iron: 0.5, brazier: 0.7 }` (a luz em `ground/lightSources.ts` já lê dele).

- [ ] **Step 1: Círculo só no pincel.** Em `terrainAt`, o círculo fica visível só com `terrainBrush.shape === "brush"`. No `onPointerLeave` do `Stage`, esconda os três círculos (`terrainCursor`, `reliefCursor`, `floorCursor`: `visible(false)` + `batchDraw`).
- [ ] **Step 2: Água sem retângulo.** Em `TerrainOptions`, `const noRect = brush.terrain === "water" || brush.terrain === "waterDark"`. Com `noRect`, o `SegmentedControl` de forma não aparece. Ao escolher água com `shape === "rect"`, `setBrush({ terrain, shape: "brush" })`. Em `BattleMap`, o início do retângulo confere `shape === "rect" && !noRect` (defesa caso o estado já venha assim).
- [ ] **Step 3: Aba Construir.** No `Button` do `BuildPanel`, `styles={{ inner: { height: "100%" }, label: { flexDirection: "column", gap: 4, justifyContent: "center", height: "100%" } }}`.
- [ ] **Step 4: Tochas menores.** `TORCH_CELLS` com os valores de Interfaces. A área de clique (`hitFunc`) já é proporcional a `s`.
- [ ] **Step 5: Conferir no app.** Run: `npm run typecheck`. Expected: sem erros. No app (`localhost:5173`), medir pelos retângulos do DOM: ícone e texto com a mesma folga em cima e embaixo (±1 px). Com terreno em retângulo, o círculo não aparece; mouse saindo do mapa esconde o círculo; com água, sem opção de retângulo; tocha menor.
- [ ] **Step 6: Commit (sugestão ao dono).**

```bash
git add client/src/map/BattleMap.tsx client/src/map/terrain/TerrainOptions.tsx client/src/components/BuildPanel.tsx client/src/map/MapTorches.tsx
git commit -m "Ajustes: pincel do terreno, água sem retângulo, aba Construir e tochas menores"
```

### Task 2: Nada em cima de parede (tocha, baú e objeto)

**Files:**
- Create: `shared/src/wallClearance.ts` (exportado em `shared/src/index.ts`)
- Modify: `server/src/actions/mapTorches.ts` (`maptorch:add`, `maptorch:move`)
- Modify: `server/src/actions/chests.ts` (`requireFree` → também a parede)
- Modify: `server/src/actions/props.ts` (`prop:add`, `prop:addMany`, `prop:update` só com `col`/`row`/`size`)
- Modify: `client/src/map/scatter.ts` (`scatter` recebe as paredes e pula quem encosta)
- Modify: `client/src/map/BattleMap.tsx` (passa `state.battle.walls` para `scatter`)
- Modify: `client/src/i18n/serverText.ts` (en, es)
- Test: `server/test/wall-clearance.test.ts`

**Interfaces:**
- Produces:
  - `touchesWall(point: { x: number; y: number }, radius: number, walls: Wall[]): boolean`: distância do ponto ao trecho `from`→`to` (mesmas coordenadas da luz, `lightBlockers`) menor que `radius`, ignorando paredes com `door` ou `window`;
  - `WALL_CLEARANCE = { torch: 0.2, chest: 0.3 }`;
  - `propClearance(kind: PropKind, size: number): number` = `PROP_DEFAULTS[kind].foot * size * 0.5`;
  - recusa `fail("Aí tem uma parede.")`.
- `scatter(set, seen, density, all, random, kind, walls: Wall[] = [])`: o último parâmetro é novo.

- [ ] **Step 1: Testes que falham** em `server/test/wall-clearance.test.ts`:

```ts
it("touchesWall: perto da linha encosta; porta e janela não contam", () => {
  const wall = { id: "w", from: { col: 0, row: 0 }, to: { col: 4, row: 0 } };
  assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [wall]), true);
  assert.equal(touchesWall({ x: 2, y: 0.5 }, 0.2, [wall]), false);
  assert.equal(touchesWall({ x: 4.15, y: 0 }, 0.2, [wall]), true); // na ponta
  assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [{ ...wall, door: { open: false } }]), false);
  assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [{ ...wall, window: { closed: true } }]), false);
});
it("tocha, baú e objeto: pôr e mover em cima de parede é recusado", async () => { /* parede de (0,0) a (4,0) via ação de paredes;
  maptorch:add em {col: 2, row: 0.1} → "Aí tem uma parede."; em {col: 2, row: 1} → ok; maptorch:move para {2, 0.05} → recusa;
  chest:add em {col: 1, row: 0} com parede (0,0.5)→(4,0.5) passando no centro da casa → recusa;
  prop:add tree em {col: 2, row: 0.05} → recusa; estante (shelf, size 1) em {col: 2, row: 0.5} → ok */ });
it("objeto antigo em cima de parede pode girar sem mover", async () => { /* prop posto antes da parede; prop:update { rotation: 90 } → ok;
  prop:update { col: 2.01 } ainda em cima → recusa */ });
it("espalhar pula só quem cairia na parede", () => { /* scatter("forest", ...) com uma parede cruzando a área: nenhum item
  com touchesWall verdadeiro; o resto vem (length > 0) */ });
```

Os tipos de `door`/`window` seguem `shared/src/types.ts`; complete os campos obrigatórios deles.

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm test -- --test-name-pattern="parede"` (ou o arquivo). Expected: FAIL (`touchesWall` não existe).
- [ ] **Step 3: Implementar** `shared/src/wallClearance.ts` e as conferências:
  - baú: centro `geometryOf(battle.map.grid).center(cell)`;
  - objeto: centro `{x: col, y: row}`;
  - tocha: `{x: col, y: row}`;
  - `prop:addMany` confere todos antes de pôr (um na parede recusa o lote: o pincel de espalhar já não manda esses).
- [ ] **Step 4: Tradução** de "Aí tem uma parede." em `serverText.ts`: en "There's a wall there.", es "Ahí hay una pared.".
- [ ] **Step 5: Rodar os testes.** Run: `npm run typecheck && npm test`. Expected: tudo verde, incluindo `server-text.test.ts`.
- [ ] **Step 6: Commit (sugestão ao dono).**

```bash
git add shared/src/wallClearance.ts shared/src/index.ts server/src/actions/mapTorches.ts server/src/actions/chests.ts server/src/actions/props.ts client/src/map/scatter.ts client/src/map/BattleMap.tsx client/src/i18n/serverText.ts server/test/wall-clearance.test.ts
git commit -m "Ajustes: tocha, baú e objeto não ficam em cima de parede"
```

### Task 3: A água apaga as plantas

**Files:**
- Create: `client/src/map/terrain/drownedPlants.ts` (sem DOM)
- Modify: `client/src/map/mapHistory.ts` (`paintTerrainNow` e o desfazer de `scope: "terrain", kind: "painted"`)
- Test: `server/test/drowned-plants.test.ts`

**Interfaces:**
- Produces:
  - `PLANT_KINDS: ReadonlySet<PropKind>` = tree, pine, palm, bush, stump, log, mushrooms, flowers, tallGrass;
  - `drownedPlants(props: MapProp[], before: TerrainChunks, after: TerrainChunks): MapProp[]`: plantas com `water + waterDark` (de `terrainAt`) ≥ 0,5 no ponto `(col, row)` depois e < 0,5 antes;
  - o passo `{ scope: "terrain"; kind: "painted"; before; after; plants?: MapProp[] }`.

- [ ] **Step 1: Testes que falham** em `server/test/drowned-plants.test.ts`:

```ts
it("só plantas com o pé na água somem", () => {
  // before: grama; after: paintTerrain com água num círculo raio 2 em (5,5), força 1
  // props: tree em (5,5), boulder em (5,5.2), bush em (6.9,5) (borda, água < 0,5), flowers em (12,12)
  const gone = drownedPlants(props, before, after).map((p) => p.kind);
  assert.deepEqual(gone, ["tree"]);
});
it("planta que já estava na água não conta de novo", () => { /* before já com água em (5,5): drownedPlants → [] */ });
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm test`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `drownedPlants`. Em `paintTerrainNow`, só para `stroke.terrain` água ou água profunda e com `touched.size > 0`:
  1. `const plants = drownedPlants(battle.props, base, applied)`;
  2. se houver plantas, `act("prop:remove", { ids })`;
  3. o passo do Desfazer leva `plants` (só se a remoção deu certo).

  No desfazer, depois de repor o terreno, recoloca as plantas que não existem mais pelo mesmo caminho de `removeProps` (`prop:addMany` e a volta de `above`/`blocks`). O refazer, se existir para esse passo, tira de novo.
- [ ] **Step 4: Rodar os testes.** Run: `npm run typecheck && npm test`. Expected: verde.
- [ ] **Step 5: Conferir no app.** Pintar uma floresta, passar água no meio: as árvores dentro somem ao soltar. Ctrl+Z: a água sai e as árvores voltam. Pedregulho dentro da água fica.
- [ ] **Step 6: Documentação.**
  - CHANGELOG em *[Não lançado]*: *Alterado* (tochas menores; a água apaga as plantas; nada em cima de parede, exceto portas e janelas) e *Corrigido* (círculo do pincel; água sem retângulo; aba Construir).
  - `docs/pendencias.md`: seção "Ajustes rápidos (bloco 1)" no roteiro de teste.
- [ ] **Step 7: Commit (sugestão ao dono).**

```bash
git add client/src/map/terrain/drownedPlants.ts client/src/map/mapHistory.ts server/test/drowned-plants.test.ts CHANGELOG.md docs/pendencias.md docs/design/ajustes-rapidos.md docs/superpowers/plans/2026-11-24-ajustes-rapidos.md
git commit -m "Ajustes: a água apaga as plantas"
```
