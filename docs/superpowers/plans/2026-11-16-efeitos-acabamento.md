# Acabamento de fogo, raízes e eletrificado — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a animação de três efeitos do mapa (fogo, raízes, eletrificado) para parecerem desenhados, redondos e orgânicos.

**Architecture:** Só `client/src/map/effectFx.ts` (os `Painter` `fire`, `roots` e `electric`, mais sprites e ajudantes novos no mesmo arquivo). O contrato `drawFx(ctx, preset, color, st, area, cell, now)` não muda; `FxState` ganha um campo opcional para as raízes.

**Tech Stack:** Canvas 2D (dentro do Konva), TypeScript.

**Spec:** [docs/design/efeitos-acabamento.md](../../design/efeitos-acabamento.md)

## Global Constraints

- Nada de movimento contínuo numa direção da tela; nada que pule a cada quadro.
- Tetos de partículas por área iguais ou menores que hoje (`budget(...)`).
- A textura parada do E19 (`effectTextures.ts`, *Reduzir efeitos*) não muda.
- Sem `any` nem cast forçado; nomes de variável com significado no código novo; comentários em português, na densidade do arquivo.
- O cliente não tem testes automáticos: a prova é `npm run typecheck` e o efeito visto no navegador (galeria no mapa, `npm run dev`), aprovado pelo dono.

## Review Focus

1. Área que segue um token (o `box` anda a cada quadro): as raízes não podem sumir nem ser refeitas a cada quadro; ficam presas à área.
2. Área fina (linha) ou pequena (1 casa): todo efeito aparece, sem partículas fora da área.
3. Aba que volta do segundo plano (`dt` limitado a 0,1 s): nada de rajada nem clarão preso.
4. Zoom bem perto e bem longe: espessuras proporcionais a `cell`, com mínimo de 1 px.
5. Raízes com cor personalizada (`color` do efeito): a cor escolhida continua valendo.

---

### Task 1: Fogo

**Files:**
- Modify: `client/src/map/effectFx.ts` (`fire`, sprite novo `flameTongue(r, g, b)` ao lado de `glow`)

- [ ] **Step 1:** Sprite `flameTongue(r, g, b): HTMLCanvasElement` em cache como `glow`: gota com base redonda e ponta fina para cima, centro claro e borda transparente.
- [ ] **Step 2:** `fire`: calor de fundo sem deslizar (deslocamento `sin`/`cos` lento de no máximo ~0,3 casa); brasas = textura de rachaduras (`ridge`) em laranja, alpha pulsando devagar; chamas com `flameTongue`, vida 0,3–0,7 s, subida de no máximo ~0,3 casa/s, inclinadas pelo vento (`ctx.rotate` com `sin(t)` pequeno), crescem e encolhem no lugar; fagulhas e fumaça mantidas.
- [ ] **Step 3:** `npm run typecheck` → sem erros.
- [ ] **Step 4:** Ver no navegador (galeria) e ajustar com o dono até aprovar.
- [ ] **Step 5:** Sugerir o commit `Efeitos: fogo tremulando no lugar, em línguas de chama` e esperar.

### Task 2: Raízes

**Files:**
- Modify: `client/src/map/effectFx.ts` (`roots`, `FxState`, `newFxState`)

**Interfaces:**
- Produces: `FxState.roots?: { w: number; h: number; paths: RootPath[] }`, com `RootPath` = pontos relativos ao canto do `box`, espessura na base e semente da ponta.

- [ ] **Step 1:** `growRoots(area: FxArea, cell: number): RootPath[]`: raízes saindo de pontos de `spawnPoint` (quantidade por `budget`, teto 24), cada uma ramificando 2–3 níveis, curvas suaves, só dentro da área (`inside`). Guardada em `st.roots`, refeita só quando `box.w`/`box.h` mudam; posição relativa ao `box.x`/`box.y` (acompanha token).
- [ ] **Step 2:** Desenho: terra revolvida mantida (sem escala que pulsa); cada raiz com sombra deslocada, corpo na `color` do efeito, risco de luz fino por cima, afinando até a ponta; as pontas (último segmento) ondulam com `sin(t + semente)` de no máximo ~0,08 casa.
- [ ] **Step 3:** `npm run typecheck` → sem erros.
- [ ] **Step 4:** Ver no navegador, também com cor personalizada e numa área que segue token; ajustar até o dono aprovar.
- [ ] **Step 5:** Sugerir o commit `Efeitos: raízes desenhadas para a área, com pontas rastejando` e esperar.

### Task 3: Eletrificado e documentação

**Files:**
- Modify: `client/src/map/effectFx.ts` (`electric`, `Particle`)
- Modify: `CHANGELOG.md` (`[Não lançado]` → *Alterado*)

- [ ] **Step 1:** Fundo: deslocamento por `t` lento (sem `Math.random()` por quadro); alpha com soma de senos; clarão guardado no estado que acende e decai em ~0,2 s.
- [ ] **Step 2:** Raios: arco por deslocamento do ponto médio (curvo, 3–4 níveis), 1–2 galhos curtos; vida 0,15–0,4 s, piscando (alpha alterna enquanto vive); traço largo azul que some mais devagar que o núcleo branco.
- [ ] **Step 3:** CHANGELOG: uma linha em *Alterado* sobre fogo, raízes e eletrificado redesenhados.
- [ ] **Step 4:** `npm run typecheck` e `npm test` → sem erros.
- [ ] **Step 5:** Ver no navegador e ajustar até o dono aprovar.
- [ ] **Step 6:** Sugerir o commit `Efeitos: eletrificado com arcos ramificados e documentação` e esperar.
