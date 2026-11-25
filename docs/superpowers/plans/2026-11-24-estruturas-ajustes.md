# Ponte de pedra, escadas e margem dos rios (bloco 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar ao app as três escolhas aprovadas: cabeceira de pedra com pilares, escadas legíveis e margem suave dos rios.

**Architecture:** Ponte e escadas são mudanças nos shaders do app (`bridgeShader.ts`, `stairShader.ts`), portando o código das páginas aprovadas. A margem precisa da meia largura da água: um campo novo, calculado no Worker da água, vai como terceiro canal da textura de distância e é lido no assar do barranco (`waterShader.ts`).

**Tech Stack:** TypeScript, WebGL2/GLSL, Web Worker, node:test.

**Spec:** `docs/design/estruturas-ajustes.md`

## Global Constraints

- Sem commits do agente: sugestão de `git add`/`git commit` no fim de cada tarefa, parada até o "segue".
- Visual = o das páginas aprovadas: `docs/design/ponte-pedra-teste.html` (uEnd 1), `escadas-relevo-teste.html` (uStyle 1, força 0,6), `rios-teste.html` (uMargin 2).
- Sem `any` nem cast forçado; comentários em português.
- `npm run typecheck` e `npm test` verdes em cada tarefa; a skill `desempenho` antes e depois da Task 3.

## Review Focus

- **Ponte de pedra de largura 1, 2 e 3:** o pilar fica na linha da mureta nas três (`halfW - 0.15`). App na Task 1.
- **Escada descendo e escada solta (alçapão/borda cortada):** o "mais claro conforme sobe" usa a altura com limite em 0..2; descendo, a escada só escurece. App na Task 2.
- **Água funda e lago grande:** a meia largura satura (≥ 1,5 casa → margem cheia), então lago e rio largo ficam com a margem suave sem afinar. Teste na Task 3.
- **Rio que encosta na borda do campo do Worker:** o filtro de máximo não lê fora do campo. Teste na Task 3.
- **Água pintada fina demais (< 0,5 casa):** a margem tem 40% de algo pequeno e a água aparece. Teste na Task 3.

---

### Task 1: Cabeceira de pedra com pilares

**Files:**
- Modify: `client/src/map/ground/bridgeShader.ts` (`ends()`, ramo `kind == 1`; cor do caminho gasto para `KIND == 1`)

- [ ] **Step 1:** Trocar o ramo de pedra de `ends()` pelo da página (`uEnd == 1`), com os helpers do app (`stoneBlocks`/`cobbles`/`relativeShade` no lugar de `light`):
  - pilar quadrado de 0,24 de meio lado, centro em `(-0.02, halfW - 0.15)` (fora da ponta, na linha da mureta);
  - topo do pilar `× 1.12`, borda (rim > 0,78) `× 0.72`, junta escura;
  - sombra do pilar no chão para o lado oposto ao sol (0,35 de comprimento, alpha 0,28);
  - calçamento até 0,45 casa, com `keep = 1 - smoothstep(0.1, 0.45, out + ruído × 0,25)`.
- [ ] **Step 2:** Caminho gasto da ponte de pedra com a mesma terra batida das outras (`vec3(0.42, 0.33, 0.22)`).
- [ ] **Step 3: Conferir.** Run: `npm run typecheck && npm test`. Expected: verde. No app, ponte de pedra de largura 1, 2 e 3 sobre um rio, de dia e à noite: pilares nas pontas, sem "V" e sem mancha clara.
- [ ] **Step 4: Commit (sugestão).**

```bash
git add client/src/map/ground/bridgeShader.ts docs/design/ponte-pedra-teste.html docs/design/estruturas-ajustes.md docs/superpowers/plans/2026-11-24-estruturas-ajustes.md
git commit -m "Estruturas: ponte de pedra termina em pilares"
```

### Task 2: Escadas legíveis

**Files:**
- Modify: `client/src/map/ground/stairShader.ts` (mureta, degrau e patamar do caminho de escada)

- [ ] **Step 1:** Com `strong = 0.6` fixo (o "Legível" da página):
  - **mureta:** `col *= 1 - 0.22·strong` e contorno `col *= mix(1 - 0.6·strong, 1, smoothstep(0, 0.035, edge))`;
  - **degrau:** espelho `mix(col, col·0.42, riser·strong)`, base `× (1 - 0.4·base·strong)`, nariz `× (1 + 0.3·nose·strong)` e altura `× mix(1 - 0.2·strong, 1 + 0.12·strong, clamp(hs/2, 0, 1))`;
  - **patamar:** `× (1 - 0.16·strong) × (o mesmo fator da altura)`.
- [ ] **Step 2: Conferir.** Run: `npm run typecheck && npm test`. Expected: verde. No app, escada de pedra e de madeira subindo um penhasco de 2 níveis, uma descendo e uma solta: degraus marcados, clareando para cima.
- [ ] **Step 3: Commit (sugestão).**

```bash
git add client/src/map/ground/stairShader.ts docs/design/escadas-relevo-teste.html
git commit -m "Estruturas: escadas legíveis no relevo"
```

### Task 3: Margem suave dos rios

**Files:**
- Modify: `shared/src/water.ts` (função nova `waterHalfWidth`)
- Modify: `client/src/map/ground/waterWorker.ts` (terceiro canal), `waterTypes.ts` (doc do campo), `waterPass.ts` (`halfTexture` → RGBA16F)
- Modify: `client/src/map/ground/waterShader.ts` (`bankW`, `bankH`, contraste suave)
- Test: `server/test/water.test.ts`

**Interfaces:**
- Produces:
  - `waterHalfWidth(sdf: Float32Array, width: number, height: number, radiusPx: number): Float32Array`: para cada pixel, a maior distância positiva até a margem num quadrado de lado `2·radiusPx + 1` em volta (filtro de máximo separável, linhas e depois colunas, só dentro do campo); fora da água, 0. Em px do campo.
  - O campo da água em RGBA16F: R distância, G parte funda, B meia largura em casas (`waterHalfWidth / perCell`), A 0.

- [ ] **Step 1: Testes que falham** em `water.test.ts`:

```ts
it("meia largura: rio fino dá a meia largura dele; perto da margem de um largo, pelo menos o raio", () => {
  // sdf de uma faixa horizontal: rio fino com meia largura 4 px (linhas 10..18) e largo com 30 px; campo 80 × 120
  // waterHalfWidth(sdf, 80, 120, 16): no meio da margem do fino (sdf ≈ 1) → ≈ 4; na margem do largo → ≥ 16
});
it("meia largura: não lê fora do campo nem passa do máximo da água", () => { /* faixa encostada na borda de cima: sem erro, valores ≤ maior sdf */ });
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm test`. Expected: FAIL (função não existe).
- [ ] **Step 3: Implementar** `waterHalfWidth`. Raio no Worker: `2 * perCell` (2 casas).
- [ ] **Step 4: Worker e textura.** `sdfDeep` passa a ter 4 canais (B = meia largura em casas). `halfTexture` passa a usar `RGBA16F`/`RGBA`.
- [ ] **Step 5: Shader do barranco**, como na página (`uMargin 2`):
  - `bankW = min(bankWidth, hw·UNIT·0.4)` e `bankH = BANK × clamp(hw/1.5, 0.4, 1) × 0.65`, com `hw = texture(uSdfDeep, fieldUv(px)).b`;
  - em `heightAt`, `earthMaterial`, `main` (sombra, `outData`) no lugar de `bankWidth`/`BANK`;
  - contraste suave: `0.55 + 0.45·lambert × mix(0.7, 1, sh)`, base `0.08`, crista `0.1`.
- [ ] **Step 6: Medir.** Skill `desempenho` (`firstWater`, `water50`). Expected: sem piora acima de 10% em relação a `docs/desempenho/2026-11-24-fim.json`.
- [ ] **Step 7: Conferir no app.** Rio de pincel 0,5 e de 1,5, lago e água funda: a água aparece no fino, as margens mais rasas e suaves.
- [ ] **Step 8: Documentação.**
  - CHANGELOG (*Alterado*: ponte de pedra com pilares, escadas mais legíveis, margem dos rios mais suave; *Corrigido*: rio fino com mais margem que água);
  - SPEC: linha do bloco 3 junto das estruturas;
  - roteiro "Ponte, escadas e rios (bloco 3)" em `docs/pendencias.md`.
- [ ] **Step 9: Commit (sugestão).**

```bash
git add shared/src/water.ts server/test/water.test.ts client/src/map/ground/waterWorker.ts client/src/map/ground/waterTypes.ts client/src/map/ground/waterPass.ts client/src/map/ground/waterShader.ts docs/design/rios-teste.html CHANGELOG.md SPEC.md docs/pendencias.md docs/desempenho
git commit -m "Estruturas: margem dos rios proporcional e suave"
```
