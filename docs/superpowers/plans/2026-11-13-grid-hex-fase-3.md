# Grid hexagonal, Fase 3: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** numa cena hex passam a funcionar paredes e portas, a névoa (pincel, retângulo, *Cômodo*, *Revelar o mapa*, *Cobrir tudo*) e a visão dos personagens (explorado, "visto por último", NPC encontrado); depois disso nada fica desligado no hex.

**Architecture:** as paredes já guardam pontas livres em unidades de casa e a visão já é uma conta de linhas: o que muda é onde ficam os centros das casas, quais são os vizinhos e quais casas entram na conta. As funções da névoa em `shared/src/fog.ts` ganham o grid (`kind`) e usam a geometria; no quadrado continuam exatamente iguais. A névoa continua guardada em linhas com intervalos de colunas (coordenadas offset cabem no mesmo formato). O servidor tira as recusas, passa o grid para as contas da visão e do filtro do jogador; o cliente encaixa as paredes nos vértices e lados do hex, pinta a névoa em hexes e desenha a máscara em hexágonos.

**Tech Stack:** TypeScript, node:test, React + react-konva + Mantine.

**Spec:** [docs/design/grid-hex.md](../../design/grid-hex.md) (§3, Fase 3). Fases anteriores: [fase 1](2026-11-12-grid-hex-fase-1.md), [fase 2](2026-11-13-grid-hex-fase-2.md).

## Global Constraints

- Paredes e portas encaixam nos vértices e nos meios dos lados do hex; traço livre e borracha iguais aos de hoje. O servidor já aceita qualquer ponta em centésimos: o formato da parede não muda.
- Névoa: pincel em hexes (`brushCells`); o retângulo revela os hexes cujo centro cai dentro dele; *Revelar o mapa*, *Cobrir tudo*; *Cômodo* cresce hex a hex (6 vizinhos) até as paredes, com a passagem por cruzamento de parede como hoje.
- Visão: linha de visão do centro de cada hex (com o empurrãozinho de hoje), do meio da forma de quem vê; explorado e "visto por último" iguais.
- Filtro por papel (`server/src/view.ts`): no hex, o jogador continua sem receber mob, efeito, desenho, parede, tocha, baú ou objeto que esteja na parte coberta. É a regra de segurança da névoa: teste obrigatório.
- O quadrado não muda: com `kind` ausente ou `"square"`, cada função dá exatamente o que dá hoje; os testes atuais de névoa, visão e paredes passam sem alteração.
- Trocar o grid continua apagando paredes e névoa (só valem na geometria em que foram feitas).
- Textos novos em `pt-BR.ts`, `en.ts`, `es.ts`; Mantine; sem `any` nem cast forçado.
- Sem commits do agente: no fim de cada tarefa, parar com a sugestão de commit (`Passo 16: …`) e esperar o Jorge. Fechar cada tarefa com `npm run typecheck` e `npm test` verdes.

## Review Focus

1. **Jogador recebendo o que está atrás de uma parede no hex** (mob, efeito, desenho, tocha): a regra de segurança da névoa vale igual (Tarefa 2).
2. **Parede traçada exatamente sobre o lado de um hex:** a linha entre os centros de dois vizinhos cruza o lado no meio; a visão e o *Cômodo* têm que parar ali, sem vazar pela ponta (Tarefa 1).
3. **Quem vê é Grande ou Enorme:** a visão sai do meio da forma e as casas da própria forma contam como vistas (Tarefa 1).
4. **"Visto por último" de um Grande no hex:** a marca some quando alguém volta a ver qualquer hex da forma, não um 2×2 do quadrado (Tarefa 2).
5. **Máscara da névoa num mapa grande em hex:** refazer a máscara não pode travar a tela; tem o mesmo teto de tamanho de hoje (Tarefa 3).

---

### Tarefa 1: névoa, visão e encaixe na geometria (`shared`)

**Files:**
- Modify: `shared/src/fog.ts`, `shared/src/gridGeometry.ts`
- Test: `server/test/fog-hex.test.ts` (novo)

**Interfaces:**
- Consumes: `geometryOf`, `brushCells` (fases 1 e 2).
- Produces:
  - `canPass(a: GridPos, b: GridPos, walls: Wall[], kind?: GridKind): boolean` — no hex, os pontos são `center(pos) + NUDGE_HEX` com `NUDGE_HEX = { x: 0.0013, y: 0.0071 }`.
  - `roomCells(start: GridPos, walls: Wall[], max: number, kind?: GridKind): GridPos[] | null` — vizinhos por `geometryOf(kind).neighbors` (no quadrado são os 4 lados de hoje, na mesma ordem).
  - `interface Viewer { pos: GridPos; span: number; feet: number; size?: Size; point?: CellPoint }` — `size` e `point` só são lidos no hex: o centro de quem vê é `point` (tocha fixa) ou `shapeCenter(pos, size)`; as casas próprias são `footprint(pos, size)`; o raio soma `drawSpan(size) / 2`.
  - `sightCells(viewers, walls, feetPerCell, lights = [], lightReachFeet = VISION_FEET.day, kind?: GridKind): GridPos[]` — no hex, candidatas = casas da caixa (`cellAt` dos cantos, uma de folga) com o centro dentro do raio; alvo = `center + NUDGE_HEX`.
  - `cellsAroundPointIn(point: CellPoint, kind?: GridKind): GridPos[]` — quadrado: `cellsAroundPoint(point.x, point.y)` (o de hoje); hex: a casa do ponto e as vizinhas cujo centro fica a até `1/√3 + 0.01` do ponto (num vértice: 3 hexes).
  - `cellsWithCenterIn(a: CellPoint, b: CellPoint, kind: GridKind): GridPos[]` — casas cujo centro cai no retângulo entre os dois pontos (retângulo da névoa e *Revelar o mapa* no hex).
  - `wallAnchor(point: CellPoint, kind?: GridKind): CellPoint` em `gridGeometry.ts` — quadrado: o canto mais perto (`Math.round` em cada eixo, o `cornerAt` de hoje); hex: o mais perto entre os 6 vértices e os 6 meios de lado da casa do ponto, em centésimos.
  - `sizeOfSpan(span: number): Size | undefined` em `gridGeometry.ts` — 1 → `undefined`, 2 → `large`, 3 → `huge`, 4 → `gargantuan` (para a marca de "visto por último", que guarda só `span`).

- [ ] **Passo 1: testes que falham** (`server/test/fog-hex.test.ts`, um `describe` por `hexRows` e `hexCols`):
  - `"quadrado igual a antes"`: para uma sala com paredes de amostra, `roomCells`, `canPass` e `sightCells` sem `kind` e com `"square"` dão o mesmo resultado; `wallAnchor({2.4, 3.6})` = `{2, 4}`; `cellsAroundPointIn({2, 3})` = `cellsAroundPoint(2, 3)`.
  - `"parede no lado do hex bloqueia"`: parede do vértice ao vértice do lado entre `pos` e um vizinho → `canPass(pos, vizinho, [parede], kind)` falso, e verdadeiro para os outros 5 vizinhos; vale em linha (ou coluna) par e ímpar.
  - `"cômodo hex fecha nas paredes"`: anel de paredes sobre todos os lados de fora de uma forma de 7 hexes (a de `huge` em volta de `pos`) → `roomCells(pos, paredes, 100, kind)` devolve exatamente esses 7; sem paredes e `max` 50 → `null`.
  - `"visão hex"`: um aliado Médio em `pos` com 30 ft (`feetPerCell` 5) vê `pos` e as casas a distância ≤ 6 em campo aberto, e nenhuma a distância ≥ 8; com uma parede comprida entre ele e um hex a distância 3, esse hex fica de fora; um aliado Grande vê as 3 casas da própria forma.
  - `"encaixe da parede"`: `wallAnchor` de pontos perto de um vértice devolve o vértice; perto do meio de um lado, o meio do lado (centésimos).
  - `"casas em volta de um ponto"`: no centro de um hex → só ele; num vértice → 3 hexes vizinhos entre si.
  - `"retângulo da névoa"`: `cellsWithCenterIn` devolve só casas com centro dentro, e todas elas.
- [ ] **Passo 2:** `npm test` → falham.
- [ ] **Passo 3:** implementar. Com `kind` ausente ou `"square"`, cada função segue pelo caminho de hoje sem tocar nele.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam. Parar com o commit `Passo 16: plano da fase 3 do hex e névoa e visão na geometria`.

### Tarefa 2: servidor — paredes, névoa e visão no hex

**Files:**
- Modify: `server/src/actions/walls.ts`, `server/src/actions/fog.ts` (`fog:room`, `covered`), `server/src/actions/map.ts` (`requireSquareGrid` sai), `server/src/sight.ts` (`updateSight`, `trackLastSeen`), `server/src/view.ts` (`inSight`), `client/src/i18n/serverText.ts` (sai a recusa)
- Test: `server/test/grid-hex.test.ts`

**Interfaces:**
- Consumes: tudo o que a Tarefa 1 produz.

- [ ] **Passo 1: testes que falham** (cena `hexRows`; o teste da Fase 1 `"ações só do quadrado são recusadas no hex"` sai, junto com `requireSquareGrid`):
  - `"paredes e névoa valem no hex"`: `wall:add`, `wall:erase`, `fog:set`, `fog:paint` (um retângulo de uma linha), `fog:vision` e `fog:room` aceitos.
  - `"cômodo no hex"`: paredes fechando a forma de 7 hexes em volta de `{5,5}` → `fog:room { cell: {5,5}, reveal: true }` revela exatamente esses 7 (conferir `isRevealed`).
  - `"jogador não recebe o que está atrás da parede no hex"`: névoa e visão ligadas, aliado da Ana em `{2,2}`, goblin em `{2,8}` com parede comprida no meio → o estado da Ana não tem o goblin; tirando a parede → tem. Um efeito fixado atrás da parede segue a mesma regra.
  - `"visto por último no hex"`: goblin Grande visto e depois atrás da parede → marca em `fog.lastSeen`; a Ana volta a ver um hex qualquer da forma (não o 2×2 do quadrado) → a marca some.
  - `"NPC encontrado no hex"`: NPC visto uma vez entra em `fog.foundNpcs`.
- [ ] **Passo 2:** `npm test` → falham.
- [ ] **Passo 3:** tirar `requireSquareGrid` (função, chamadas em `walls.ts` e `fog.ts`, recusa em `serverText.ts`); `fog:room` chama `roomCells(…, map.grid)`; `covered` acha as casas da marca por `footprint(pos, sizeOfSpan(span))` e as do NPC por `footprint(pos, size)` da geometria; `updateSight` monta os `Viewer` com `size` (aliados e quem leva tocha) e `point` (tocha fixa, no ponto exato), e passa `map.grid` para `sightCells`; `trackLastSeen` troca `cellsOf` pela forma da geometria (marca: `sizeOfSpan`); `inSight` (`view.ts`): forma do combatente pela geometria, origem de área e objetos por `cellsAroundPointIn`, pontos de desenho, tochas e o resto pelo `cellAt` da geometria. No quadrado, cada conta dá o mesmo de hoje.
- [ ] **Passo 4:** `npm run typecheck` e `npm test` → passam (os testes de névoa e visão do quadrado sem alteração). Parar com o commit `Passo 16: servidor libera paredes, névoa e visão no hex`.

### Tarefa 3: cliente — paredes, ferramentas da névoa e máscara em hex

**Files:**
- Modify: `client/src/map/WallShape.tsx` (`cornerAt` → `wallAnchor`), `client/src/map/BattleMap.tsx` (pincel e retângulo da névoa, *Revelar o mapa*), `client/src/map/Fog.tsx` (`FogLayer` passa o grid), `client/src/map/fogRender.ts` (`buildMask` em hex), `client/src/map/LastSeen.tsx` (marca no meio da forma), `client/src/store.ts`, `client/src/session.ts`, `client/src/components/BuildPanel.tsx`, `client/src/map/BattleMap.tsx` (barra), i18n (sai `map.hexSoon`)

**Interfaces:**
- Consumes: `wallAnchor`, `brushCells`, `cellsWithCenterIn`, `sizeOfSpan` (Tarefa 1); `shapeCenterAt`, `toCellUnits`, `toWorld` (`client/src/map/geometry.ts`).
- Produces: `buildMask(areas: MaskArea[], cover: FogRect[], kind?: GridKind): FogMask | null`.

- [ ] **Passo 1:** paredes: a ponta encaixa em `wallAnchor` (com o encaixe ligado); traço livre e borracha como hoje.
- [ ] **Passo 2:** névoa no hex: o pincel junta `brushCells(casa, tamanho, grid)` e manda como retângulos de uma linha (`cellsToRects`); o retângulo e *Revelar o mapa* mandam `cellsToRects(cellsWithCenterIn(...))`; a prévia da pincelada em hexes (como os pincéis da Fase 2); rótulos do tamanho do pincel em hexes.
- [ ] **Passo 3:** máscara no hex: `buildMask` com `kind` hex desenha cada casa como o hexágono dela num canvas auxiliar (preenchimento com a intensidade da área, composição `lighten`; casas sendo cobertas por cima, em preto), lê os pixels para o mesmo vetor de hoje e segue com o desfoque e os fiapos de hoje; mesmo teto `MAX_SIDE` e `ppc`. No quadrado, o caminho de hoje.
- [ ] **Passo 4:** "visto por último" desenhado no meio da forma (`shapeCenterAt` com `sizeOfSpan`); nada mais apagado no hex: saem `SQUARE_ONLY_TOOLS`, `isSquareOnly`, `offOnHex`, a volta forçada a *Mover* em `session.ts`, os botões apagados e a chave `map.hexSoon` nas três línguas.
- [ ] **Passo 5:** `npm run typecheck`, `npm test` e `npm run build` → verdes. No navegador, `hexRows` e `hexCols`, como mestre e como jogador pelo IP da rede: traçar paredes e uma porta nos lados dos hexes; ligar névoa e visão; pincel, retângulo, *Cômodo*, *Revelar o mapa*, *Cobrir tudo*; aliado andando revela hexes, parede bloqueia, porta aberta deixa ver; mob que sai da vista deixa "?" no lugar; a máscara com borda esfumaçada em hexágonos; cena quadrada igual a antes. Parar com o commit `Passo 16: paredes, névoa e visão no grid hex`.

### Tarefa 4: documentação

**Files:**
- Modify: `CHANGELOG.md` (linha *Grid hexagonal*: nada mais fica só no quadrado), `README.md` (painel *Mapa*, névoa e paredes), `SPEC.md` (Fase 3 feita: o que mudou na névoa e na visão), `docs/backlog.md` (Fase 3 e o Passo 16 marcados), `docs/design/grid-hex.md` (§3: as três fases feitas)

- [ ] **Passo 1:** escrever as mudanças acima; conferir que nenhum texto ainda diga que paredes, névoa ou visão são "só do quadrado".
- [ ] **Passo 2:** checagem de regressão: quem chama `canPass`, `roomCells`, `sightCells`, `cellsAroundPoint`, `buildMask`, `cornerAt`; `npm run typecheck`, `npm test` e `npm run build` → verdes. Parar com o commit `Passo 16: fase 3 do grid hexagonal (documentação)`.
