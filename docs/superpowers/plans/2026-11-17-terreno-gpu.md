# Terreno na placa de vídeo — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O terreno pintado passa a ser desenhado por pixel num shader WebGL 2, no mesmo renderizador e na mesma camada da água, com a aparência de hoje, nítido em qualquer zoom e com o pincel em resolução cheia.

**Architecture:** Um renderizador do chão (`client/src/map/ground/`, sem Konva nem React) com um contexto WebGL 2 e dois passos: terreno (pesos dos 8 terrenos em duas texturas RGBA8, aquarelas e detalhe como texturas, mistura e borda no shader, guardado numa textura do tamanho da tela até a visão ou o terreno mudarem) e água (o renderizador da água atual, que vira um passo dele). Uma peça de integração (`GroundLayer.tsx`) põe o canvas numa `Layer` do Konva entre a mesa/imagem e o grid. Sem WebGL 2 ou com o contexto perdido, o `TerrainLayer` de hoje (CPU) e a aquarela da água voltam.

**Tech Stack:** TypeScript, WebGL 2 (GLSL ES 3.0), React + react-konva, node:test.

**Spec:** [docs/design/renderizador-chao.md](../../design/renderizador-chao.md) (água: [docs/design/agua.md](../../design/agua.md); terreno: [docs/design/terreno.md](../../design/terreno.md))

## Global Constraints

- A mesma aparência de hoje: as mesmas aquarelas e ajustes de cor (`TERRAIN_ART`), o mesmo detalhe de `drawDetail`, a mistura de `renderChunk.ts` (`EDGE_LOW` 0,32, `EDGE_HIGH` 0,6, ruído de borda até ±0,21, borda escurecida até 32%); diferença só de nitidez e da repetição do detalhe.
- Aquarela repete a cada 8 casas; detalhe a cada 16 casas; lajes de pedra 16/17 × 16/22 casa.
- Um contexto WebGL só para terreno e água; uma `Layer` só para o chão; ordem: mesa e imagem; chão; borda e grid; o resto.
- Sem WebGL 2 ou contexto perdido: `TerrainLayer` (CPU, `renderChunk.ts`) e a aquarela da água. *Reduzir efeitos*: terreno igual, água parada.
- Durante a passada do pincel: prévia em resolução cheia; a água pintada aparece como aquarela até soltar; a água animada antiga fica até soltar.
- Nada muda no servidor, no contrato nem no arquivo de sessão.
- Sem `any` nem cast forçado; comentários em português; formatação só nas linhas tocadas.
- Prova do cliente: `npm run typecheck`, `npm run build` e medições/comparações no navegador pelo console (o dono vê tudo no teste antes de lançar, `docs/pendencias.md`). Contas puras: `npm test`.
- Nada de commit pelo agente: no fim de cada tarefa, sugerir o commit (`Chão: …`) e seguir quando o dono disser "segue".

## Review Focus

1. Terreno longe da origem ou espalhado (pintura em cantos opostos de um mapa 200 × 200): a textura de pesos cabe no limite do aparelho ou o renderizador cai na reserva (CPU) sem quebrar (Task 3, console: forçar `MAX_TEXTURE_SIZE` baixo).
2. Pincel de água arrastando e pintando grama por cima de água: prévia como decidido, sem piscar ao soltar (Task 3, console).
3. Contexto perdido no meio do uso: volta a CPU e a aquarela; contexto devolvido: volta o chão WebGL (Task 3, console com `WEBGL_lose_context`).
4. Trocar de cena e carregar arquivo (`terrainEpoch`): pesos refeitos do zero, nada da cena anterior (Task 3, console).
5. Hex, celular (16 px por casa hoje) e zoom bem perto/longe: o terreno acompanha o grid e fica nítido (Task 3, comparação no console).

---

### Task 1: Pesos e área do terreno (contas puras)

**Files:**
- Modify: `shared/src/terrain.ts`
- Test: `server/test/terrain.test.ts`

**Interfaces:**
- Produces:
  - `terrainBounds(chunks: TerrainChunks): { cx: number; cy: number; cols: number; rows: number } | null` — retângulo em pedaços que cobre todos os pedaços pintados.
  - `terrainWeights(chunks: TerrainChunks, bounds: { cx: number; cy: number; cols: number; rows: number }, keys?: string[]): { width: number; height: number; first: Uint8Array; second: Uint8Array }` — um texel por ponto fino (`width = cols × 32`), RGBA8: `first` = grass, grassDry, dirt, dirtDark; `second` = stone, stoneLight, water, waterDark (a ordem de `TERRAINS`). Com `keys`, só esses pedaços (para subir só o que mudou): devolve um bloco de 32 × 32 por chave, na ordem de `keys` (`width = 32`, `height = 32 × keys.length`).

- [ ] **Step 1: Testes**

```ts
it("área do terreno: cobre os pedaços pintados; vazio = null", () => {
  // pedaços "0,0" e "2,-1" → { cx: 0, cy: -1, cols: 3, rows: 2 }; {} → null
});
it("pesos: um texel por ponto fino, na ordem de TERRAINS", () => {
  // pedaço "0,0" com grass 200 e water 55 no ponto (3, 2): first[(2*W+3)*4] = 200; second[(2*W+3)*4 + 2] = 55; resto 0
});
it("pesos de só alguns pedaços: um bloco 32 × 32 por chave", () => {
  // keys ["0,0"] → width 32, height 32, mesmos valores
});
```

- [ ] **Step 2: `npm test` → FAIL** (`terrainBounds` não existe).
- [ ] **Step 3: Implementar em `shared/src/terrain.ts`.**
- [ ] **Step 4: `npm test` e `npm run typecheck` → PASS.**
- [ ] **Step 5: Sugerir o commit** (`git add shared/src/terrain.ts server/test/terrain.test.ts docs/design/renderizador-chao.md docs/superpowers/plans/2026-11-17-terreno-gpu.md` / `Chão: pesos do terreno para a placa de vídeo e desenho`).

### Task 2: Texturas do terreno (aquarelas com cor e detalhe que emenda)

**Files:**
- Modify: `client/src/map/terrain/terrainArt.ts`

**Interfaces:**
- Produces (em `terrainArt.ts`):
  - `const DETAIL_PERIOD = 16` (casas).
  - `detailTile(kind: DetailKind, pixelsPerCell: number): HTMLCanvasElement` — o detalhe de `drawDetail` num ladrilho de `DETAIL_PERIOD` casas que emenda consigo mesmo (sorteio pela casa módulo 16; o que passa da borda é desenhado também do outro lado).
  - `filteredWatercolor(terrain: TerrainId, image: HTMLImageElement): HTMLCanvasElement` — a aquarela com o filtro de `TERRAIN_ART` aplicado.
  - Lajes: largura `16 / 17`, altura `16 / 22`.

- [ ] **Step 1: Implementar `detailTile` e `filteredWatercolor`; trocar as medidas das lajes.** `drawDetail` (usado pela reserva CPU) continua desenhando igual, com as lajes novas.
- [ ] **Step 2: `npm run typecheck` → sem erros.**
- [ ] **Step 3: Conferir no console** (`npm run dev`): para cada `kind`, desenhar o ladrilho 2 × 2 num canvas e comparar a coluna de pixels da emenda (x = lado − 1 e x = lado) e a linha da emenda: diferença média por canal abaixo de 12 (sem corte visível). Ladrilho a 40 px por casa: 640 × 640.
- [ ] **Step 4: Sugerir o commit** (`Chão: aquarelas com cor e detalhe que emenda`).

### Task 3: Renderizador do chão (terreno + água) no mapa

**Files:**
- Create: `client/src/map/ground/GroundRenderer.ts`, `client/src/map/ground/terrainShader.ts`, `client/src/map/ground/GroundLayer.tsx`
- Move: `client/src/map/water/WaterRenderer.ts` → `client/src/map/ground/waterPass.ts` (classe `WaterPass`, recebe o `WebGL2RenderingContext` do chão em vez de criar o seu); `waterShader.ts`, `waterWorker.ts`, `waterTypes.ts` → `client/src/map/ground/`; `WaterLayer.tsx` sai (vira `GroundLayer.tsx`)
- Modify: `client/src/map/BattleMap.tsx`, `client/src/store.ts` (`waterFailed` → `groundFailed`)

**Interfaces:**
- Consumes: `terrainBounds`, `terrainWeights` (Task 1); `detailTile`, `filteredWatercolor`, `DETAIL_PERIOD` (Task 2); a água de hoje (`WaterGpuField`, Worker, shader).
- Produces:
  - `class GroundRenderer` (sem Konva/React): `static supported(): boolean`; `constructor(canvas: HTMLCanvasElement)`; `setArt(watercolors: HTMLCanvasElement[], details: Record<DetailKind, HTMLCanvasElement>): void`; `setTerrain(chunks: TerrainChunks, changed: string[] | "all"): void`; `setWaterFields(fields: WaterGpuField[]): void`; `render(view: WaterView, time: number, options: { waterDraft: boolean }): void`; `visibleWater(view: WaterView): boolean`; `dispose(): void`.
  - `GroundLayer` (React): props `{ chunks: TerrainChunks; draft: boolean; currents: WaterCurrent[]; props: MapProp[]; grid; view; size }`.

- [ ] **Step 1: Shader do terreno** (`terrainShader.ts`) — por pixel: posição em casas; pesos dos 8 terrenos (duas texturas, filtro linear); para cada terreno presente, na ordem de `TERRAINS`: cor = aquarela (repete a cada 8 casas) com o detalhe do tipo dele por cima (repete a cada 16 casas); mistura com `smooth(valor + ruído)` e borda escurecida exatamente como `renderChunk.ts`; ruído de borda (`edgeNoise`, 4 oitavas, frequência 1,82, × 0,42) calculado no shader pela posição em casas; água (`water`, `waterDark`) só entra com `waterDraft`. Saída pré-multiplicada; fora do pintado, transparente.
- [ ] **Step 2: `GroundRenderer`** — um contexto (`premultipliedAlpha`, `preserveDrawingBuffer`); texturas de pesos do tamanho de `terrainBounds` (realoca só quando a área muda; senão `texSubImage2D` dos pedaços de `changed`); se a área passar de `MAX_TEXTURE_SIZE`, `render` lança erro tratado na integração (cai na reserva). O terreno é desenhado numa textura do tamanho da tela quando a visão, o terreno ou `waterDraft` mudam; cada quadro desenha essa textura e depois o `WaterPass` por cima.
- [ ] **Step 3: `GroundLayer` e `BattleMap`** — uma `Layer` com o canvas do chão (como o `WaterLayer` de hoje: imagem presa à tela, relógio da água a 30 quadros por segundo, detector `FrameWatch`, Worker da água, contexto perdido/devolvido); `chunks` = `terrainPreview ?? terrain` e `draft = terrainPreview !== null` (pincel na hora, pedaços mudados por comparação de objeto como o `TerrainLayer` faz); o Worker da água só recebe o terreno sem prévia. `BattleMap`: com `WEBGL && !groundFailed`, `GroundLayer` no lugar de `TerrainLayer` + `WaterLayer`; senão `TerrainLayer` sem esconder a água.
- [ ] **Step 4: `npm run typecheck` e `npm run build` → sem erros.**
- [ ] **Step 5: Conferir no console** (`npm run dev`), cada um com o resultado anotado:
  - mesmo trecho pintado (grama, terra, pedra, água) pelo `renderChunk` (CPU) e pelo chão (GPU): cor média por casa com diferença abaixo de 6% (o detalhe muda de lugar, a cor não);
  - custo do terreno numa tela 1920 × 1080: abaixo de 5 ms por desenho (com `readPixels` para esperar a placa);
  - Review Focus 1 a 5 (cada um com o teste descrito lá).
- [ ] **Step 6: Sugerir o commit** (`Chão: terreno e água num renderizador WebGL só`).

### Task 4: Documentação e pendências

**Files:**
- Modify: `CHANGELOG.md` (*Alterado*: terreno nítido em qualquer zoom, pincel em resolução cheia, abre de uma vez), `SPEC.md` (item na próxima versão, apontando para `docs/design/renderizador-chao.md`), `docs/pendencias.md` ("Para testar antes de lançar": terreno na placa de vídeo — aparência igual, pincel, zoom, hex, celular, reserva sem WebGL; e os minors adiados da revisão final, se houver)

- [ ] **Step 1: Escrever.**
- [ ] **Step 2: `npm run typecheck` e `npm test` → sem erros.**
- [ ] **Step 3: Sugerir o commit** (`Chão: documentação do terreno na placa de vídeo`).
