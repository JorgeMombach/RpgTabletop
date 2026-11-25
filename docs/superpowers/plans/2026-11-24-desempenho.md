# Desempenho e estabilidade (bloco 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zoom fluido, animação que volta sozinha, sem vazamento de memória, janela do app que se recupera, e menos engasgos no relevo, na primeira água e nos objetos animados — tudo medido por um teste repetível.

**Architecture:** Um modo de teste só de desenvolvimento (`?bench`) monta a cena pesada e mede quadros, memória e objetos vivos da placa; uma skill de projeto o roda e compara. O zoom passa a ser provisório (as imagens prontas esticam durante o gesto, um desenho completo ao parar). O detector de aparelho lento ignora trabalho pontual e tenta de novo com espera crescente. O Electron recarrega a janela caída e grava um registro local.

**Tech Stack:** TypeScript, React + Konva, WebGL2, Electron, node:test.

**Spec:** `docs/design/desempenho.md`

## Global Constraints

- Sem commits do agente: sugestão de `git add`/`git commit` no fim de cada tarefa, parada até o "segue".
- Metas (no PC do dono, cena pesada): zoom com os piores 5% dos quadros ≤ 25 ms; memória depois de "água 50×" no patamar do começo ±10%.
- O visual parado não muda; só durante o gesto de zoom ele pode ser provisório.
- Nada da partida vai para o disco (ADR-04); o registro de falha só tem data, motivo e versão.
- O modo de teste nunca entra no build de produção (`import.meta.env.DEV`).
- `npm run typecheck` e `npm test` verdes ao fim de cada tarefa; quem mexer em `desktop/`: também `npm run build` e `npm run package`.

## Review Focus

- **Zoom e depois arrasto/clique imediato:** o desenho completo pendente sai antes de qualquer outro e nada fica desalinhado (tokens, paredes, névoa). Conferido no app na Task 3.
- **Zoom com a rodinha parada no meio de uma animação de água:** a água não congela esticada; volta a animar ao parar o gesto. App na Task 3.
- **Detector num aparelho realmente lento:** com quadros lentos sem ocupação, a animação desliga e as tentativas espaçam (não fica ligando e desligando a cada 5 s). Teste na Task 2.
- **Janela recarregada depois de cair:** a pessoa continua como mestre (loopback) e a cena está igual. Conferido no app empacotado na Task 4.
- **Contexto WebGL perdido e devolvido:** os contadores do teste não acusam vazamento depois de um `webglcontextlost`/`restored`. Teste de bancada na Task 4.

---

### Task 1: Medição repetível (modo de teste e skill)

**Files:**
- Create: `client/src/bench/bench.ts` (cenários e medição)
- Create: `client/src/bench/benchScene.ts` (monta e apaga a cena pesada pelas ações)
- Create: `client/src/bench/glCounters.ts` (contadores de objetos vivos da placa)
- Modify: `client/src/main.tsx` (com `?bench` e `import.meta.env.DEV`: instala os contadores antes do app e expõe `window.rpgBench`)
- Create: `.claude/skills/desempenho/SKILL.md`
- Create: `docs/desempenho/README.md` (o que cada número quer dizer, uma tela) e a primeira medição `docs/desempenho/2026-11-24-inicio.json`

**Interfaces:**
- Produces:
  - `window.rpgBench.run(): Promise<BenchReport>`;
  - `BenchReport = { when: string; version: string; screen: { width; height; dpr }; scenarios: Record<ScenarioId, ScenarioResult> }`;
  - `ScenarioResult = { frames: number; medianMs: number; p95Ms: number; worstMs: number; heapMb: number | null; gl: { textures: number; buffers: number; programs: number; framebuffers: number } }`;
  - `ScenarioId` = `"idle" | "zoom" | "pan" | "firstWater" | "water50" | "relief" | "forestWind"`.
- `installGlCounters()`: envolve `create*`/`delete*` de `WebGL2RenderingContext.prototype` (texture, buffer, program, framebuffer) e mantém as contagens vivas.

- [ ] **Step 1: Contadores.** `glCounters.ts` com `installGlCounters()` e `glCounts()`. Só são instalados com `?bench`, em desenvolvimento.
- [ ] **Step 2: Cena pesada** (`benchScene.ts`), pelas mesmas ações do jogo, numa cena nova (`scene:add` + `scene:switch`, apagada no fim com `scene:remove`):
  - mapa 60 × 40 casas (`battle:grid`);
  - terreno variado com rio (traço de água fina) e lago;
  - relevo e dunas (`relief:paint`);
  - 300 objetos de floresta (`prop:addMany`);
  - 20 tochas;
  - 6 cômodos de paredes;
  - névoa ligada;
  - chuva à noite.
- [ ] **Step 3: Cenários** (`bench.ts`). Cada um mede os intervalos de `requestAnimationFrame` durante a ação e lê memória e contadores no fim:
  - `idle`: 3 s parado;
  - `zoom`: 40 eventos `wheel` no centro do mapa, 20 para dentro e 20 para fora, a cada 16 ms;
  - `pan`: arrasto de 600 px em 1 s, por eventos de ponteiro no palco;
  - `firstWater`: o primeiro traço de água numa cena sem água;
  - `water50`: 50 × (traço de água, `current:add`, Desfazer dos dois); mede a memória e os contadores antes e depois;
  - `relief`: um traço de relevo e um de duna, até o relevo terminar de calcular;
  - `forestWind`: 5 s parado com a floresta e o vento.
- [ ] **Step 4: Skill** `.claude/skills/desempenho/SKILL.md`. Passos curtos para um agente com pouco contexto:
  1. dev rodando (`preview_start` "dev");
  2. abrir `http://localhost:5173/?bench`;
  3. rodar `await window.rpgBench.run()` pelo `javascript_tool`;
  4. salvar em `docs/desempenho/AAAA-MM-DD-<rótulo>.json`;
  5. comparar com o último arquivo (tabela por cenário: antes, depois, diferença).

  Inclui as metas da spec e o aviso: com a janela do navegador escondida os números não valem (conferir com `tabs_context`).
- [ ] **Step 5: Primeira medição.** Rodar a skill. Expected: o arquivo `2026-11-24-inicio.json` com os 7 cenários e números ≠ 0. Anotar no ledger o `p95Ms` do zoom e a diferença de memória e contadores de `water50`.
- [ ] **Step 6: Conferir.** Run: `npm run typecheck && npm test && npm run build`. Expected: verde. Também `grep -c rpgBench dist/public/assets/*.js` → 0 (fora do build).
- [ ] **Step 7: Commit (sugestão).**

```bash
git add client/src/bench client/src/main.tsx .claude/skills/desempenho docs/desempenho
git commit -m "Desempenho: teste repetível (?bench) e skill de medição"
```

### Task 2: Detector de aparelho lento que não trava e tenta de novo

**Files:**
- Modify: `shared/src/wind.ts` (`FrameWatch`)
- Modify: `client/src/map/ground/GroundLayer.tsx`, `client/src/map/PlantWind.tsx` (quem chama), `client/src/store.ts` (`windStalled` vira tempo: `windStalledUntil: number`)
- Test: `server/test/wind.test.ts`

**Interfaces:**
- Produces:
  - `FrameWatch.tick(frameMs: number, now: number, busy: boolean): boolean` (`false` = parar por enquanto);
  - `FrameWatch.resumeAt: number` (quando tentar de novo);
  - esperas `[5_000, 15_000, 45_000, 135_000, 300_000]`; a espera só volta ao começo depois de 60 s seguidos animando sem parar;
  - `markMapBusy()` (exportado de `GroundLayer` ou de um módulo pequeno em `client/src/map/`), chamado no zoom e no arrasto: os próximos 300 ms não contam.
- Consumes: nada das outras tarefas.

- [ ] **Step 1: Testes que falham** em `wind.test.ts`:

```ts
it("quadros lentos com o mapa ocupado não contam", () => { /* 4 s de quadros de 80 ms com busy=true → tick sempre true */ });
it("parou: tenta de novo depois de 5 s, depois 15 s", () => { /* 3 s de 80 ms (busy=false) → false; resumeAt = agora+5000;
  em agora+5000 tick volta true; outros 3 s lentos → false com resumeAt = agora+15000 */ });
it("60 s animando bem zera a espera", () => { /* depois de parar duas vezes, 60 s de quadros de 16 ms; nova parada → espera de 5 s */ });
it("aba voltando do segundo plano (quadro > 1 s) não conta", () => { /* como o teste de hoje */ });
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `npm test`. Expected: FAIL (assinatura nova).
- [ ] **Step 3: Implementar.**
  - Em `GroundLayer`, `busy` = `renderer.busy || waterPending || ocupado nos últimos 300 ms`.
  - O store guarda `windStalledUntil`, e o laço do `GroundLayer` volta a animar quando `Date.now() >= windStalledUntil` (`animate` depende disso, com um `setTimeout` até a hora).
  - `PlantWind` usa o mesmo relógio.
- [ ] **Step 4: Rodar os testes.** Run: `npm run typecheck && npm test`. Expected: verde.
- [ ] **Step 5: Conferir no app.**
  - Zoom rápido por 5 s na cena pesada: a água e o vento continuam.
  - Forçar uma parada (`useApp.setState({ windStalledUntil: Date.now() + 5000 })`): volta sozinha em 5 s.
- [ ] **Step 6: Commit (sugestão).**

```bash
git add shared/src/wind.ts client/src/map/ground/GroundLayer.tsx client/src/map/PlantWind.tsx client/src/store.ts server/test/wind.test.ts
git commit -m "Desempenho: animação volta sozinha depois de uma queda de fps"
```

### Task 3: Zoom provisório

**Files:**
- Modify: `client/src/map/ground/GroundLayer.tsx` (o efeito de `paint` na mudança de `view`)
- Modify: `client/src/map/ground/GroundOutputLayer.tsx` (as imagens de saída se posicionam pela visão do último desenho, não pela atual)
- Modify: `client/src/map/BattleMap.tsx` (`zoomAt` marca o gesto; `markMapBusy` da Task 2)

**Interfaces:**
- Consumes: `markMapBusy()` (Task 2).
- Produces:
  - `drawnView` em `useGroundOutputs`: a `GroundView` com que as imagens foram desenhadas;
  - `ZOOM_SETTLE_MS = 150`.

- [ ] **Step 1: Medir antes.** `zoom.p95Ms` da Task 1 (ledger).
- [ ] **Step 2: Imagens pela visão do desenho.** Cada imagem de saída do chão (`GroundLayer` e `GroundOutputLayer`) é posta em coordenadas do mapa pela `drawnView`: `x = -drawnView.stageX / drawnView.scale`, largura `drawnView.width / drawnView.scale`, e assim por diante. Com o palco do Konva na escala nova, ela estica sozinha.
- [ ] **Step 3: Adiar o desenho completo durante o gesto.**
  - Mudança de `view` vinda do zoom (escala diferente) nos últimos `ZOOM_SETTLE_MS`: não chama `paint`, só agenda um `paint` para `ZOOM_SETTLE_MS` depois do último passo.
  - O laço das animações também pula enquanto o gesto dura.
  - Arrasto (escala igual) continua desenhando na hora.
- [ ] **Step 4: Medir depois.** Rodar a skill (`docs/desempenho/2026-11-24-zoom.json`). Expected: `zoom.p95Ms ≤ 25`. Se não chegar, olhar o perfil do `BattleMap` (React) no gesto e reduzir o que renderiza por passo de zoom. Cada mudança vira `Ruling` no ledger.
- [ ] **Step 5: Conferir no app.**
  - Zoom: fluido e nítido ao parar.
  - Zoom seguido de clique num token e de arrasto: tudo alinhado.
  - Água volta a animar.
- [ ] **Step 6: Commit (sugestão).**

```bash
git add client/src/map/ground/GroundLayer.tsx client/src/map/ground/GroundOutputLayer.tsx client/src/map/BattleMap.tsx docs/desempenho
git commit -m "Desempenho: zoom provisório (desenho completo ao parar o gesto)"
```

### Task 4: Vazamento de memória e janela que se recupera

**Files:**
- Modify: os arquivos que a medição apontar (o que cresce em `water50`)
- Modify: `desktop/src/main.ts` (`render-process-gone`, `crashReporter`, `falhas.log`)
- Modify: `SPEC.md` (ADR-04: exceção do registro de falha), `README.md` (onde fica o `falhas.log`, seção do mestre)

**Interfaces:**
- Produces: `falhas.log` em `app.getPath("userData")`, uma linha por falha: `AAAA-MM-DDTHH:MM:SSZ versão motivo (código)`.

- [ ] **Step 1: Achar o que cresce.** Rodar `water50` e comparar memória e contadores antes e depois. Expected hoje: algum contador ou a memória acima de +10%. Anotar qual no ledger.
- [ ] **Step 2: Isolar.** Repetir `water50` só com o traço de água, depois só com a correnteza, depois só com o Desfazer, até um passo explicar o crescimento. Hipóteses, na ordem:
  1. texturas ou buffers recriados sem `delete`;
  2. programas recompilados;
  3. `Worker` ou `ImageBitmap` sem `close`;
  4. listas que só crescem (`ReliefQueue`, memória de traço, histórico).
- [ ] **Step 3: Corrigir na origem** e rodar `water50` de novo. Expected: memória e contadores no patamar do começo ±10%.
- [ ] **Step 4: Contexto perdido.** Na bancada, `WEBGL_lose_context.loseContext()` e `restoreContext()` no canvas do chão e `water50` de novo. Expected: contadores sem sobra do motor antigo.
- [ ] **Step 5: Janela que cai.** Em `desktop/src/main.ts`:
  - `crashReporter.start({ uploadToServer: false })`;
  - `win.webContents.on("render-process-gone", (_event, details) => …)`: grava a linha no `falhas.log` e, se `details.reason !== "clean-exit"`, `win.reload()`;
  - `app.on("child-process-gone", …)`: só grava a linha.
- [ ] **Step 6: Documentação.**
  - SPEC: ADR-04 com a exceção ("registro de falha local, sem dados da partida").
  - README, seção do mestre: onde achar o `falhas.log` para mandar quando o app cair.
- [ ] **Step 7: Conferir.**
  - Run: `npm run typecheck && npm test && npm run build && npm run package`. Expected: verde.
  - No app empacotado: abrir `chrome://crash` não é permitido. Use `win.webContents.forcefullyCrashRenderer()`, chamado por um item escondido de depuração **só para o teste**, e tire-o antes do commit. A janela volta, o mestre continua mestre e a cena está igual; o `falhas.log` ganha uma linha.
- [ ] **Step 8: Commit (sugestão).**

```bash
git add desktop/src/main.ts SPEC.md README.md <arquivos do vazamento> docs/desempenho
git commit -m "Desempenho: sem vazamento ao mexer na água; janela do app se recupera"
```

### Task 5: Engasgos pelo número (relevo, primeira água, objetos animados)

**Files:**
- Modify: os que o perfil apontar em cada caso
- Modify: `CHANGELOG.md`, `docs/pendencias.md`

**Interfaces:**
- Consumes: a skill e o `?bench` (Task 1).

- [ ] **Step 1: Ordem.** Da última medição, ordenar `relief`, `firstWater` e `forestWind` pelo `p95Ms` (o pior primeiro). Anotar no ledger.
- [ ] **Step 2: Para cada um, na ordem:**
  1. perfil de desempenho do navegador durante o cenário (o que mais gasta: JS, desenho na placa, cópias `copyTo`, React);
  2. corrigir o maior custo sem mudar o visual;
  3. medir de novo;
  4. parar quando o `p95Ms` do cenário ficar ≤ 33 ms (30 quadros, o ritmo das animações) ou quando a próxima correção mudaria o visual. Nesse caso, anotar como pendência pequena para o dono decidir.

  Cada mudança vira `Ruling` com o número antes e depois.
- [ ] **Step 3: Medição final** `docs/desempenho/2026-11-24-fim.json` e a tabela de comparação com o início, no ledger e na mensagem ao dono.
- [ ] **Step 4: Documentação.**
  - CHANGELOG em *Corrigido*: zoom, animações que paravam, fechamento do app, relevo, primeira água e objetos (só os que melhoraram).
  - `docs/pendencias.md`: seção "Desempenho (bloco 2)" com o roteiro (zoom, deixar o fps cair e voltar, mexer na água muitas vezes no app instalado).
- [ ] **Step 5: Conferir.** Run: `npm run typecheck && npm test && npm run build`. Expected: verde.
- [ ] **Step 6: Commit (sugestão).**

```bash
git add <arquivos> CHANGELOG.md docs/pendencias.md docs/desempenho docs/design/desempenho.md docs/superpowers/plans/2026-11-24-desempenho.md
git commit -m "Desempenho: relevo, primeira água e objetos animados mais leves"
```
