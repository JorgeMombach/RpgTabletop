# Paredes, portas e janela na placa de vídeo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desenhar no mapa as paredes (os 11 desenhos), as portas em todos os estados e a janela com shader, em nitidez de Full HD, com o visual aprovado nas três páginas de teste (lotes a, b e c).

**Architecture:** O processador transforma as paredes em **peças** (trechos de cadeia, portas e janelas, com tudo o que o shader precisa) e monta um **índice por casa** (que peças passam perto de cada casa). Isso é feito em `shared/` e tem teste. Na placa de vídeo, um passo novo do renderizador do chão (`WallPass`) desenha uma camada do tamanho da tela. Por pixel, ele acha a peça vencedora entre as candidatas da casa e calcula de forma exata a posição ao longo e através, a altura do perfil, a normal, o material e o contorno de tinta. A camada só é refeita quando a visão, as paredes ou a luz da cena mudam; a cada quadro ela não custa nada. Ela sai numa imagem própria (`wallImage`), posta na camada das paredes do Konva por uma `GroundOutputLayer`. Os cliques continuam por parede no Konva.

**Tech Stack:** TypeScript, WebGL 2 (GLSL 300 es), React + react-konva, node:test.

**Spec:** [docs/design/relevo.md](../../design/relevo.md), seção *Paredes na placa de vídeo (etapa 2)*. Visual aprovado nos lotes a, b e c (`docs/design/paredes-gpu-a.html`, `-b.html`, `-c.html`, copiados na Tarefa 1).

## Global Constraints

- Nitidez de Full HD: nada vem de imagem guardada em resolução fixa. Detalhe, veio, juntas e contorno de tinta são calculados por pixel, a partir da posição no mapa; o contorno tem largura em pixels.
- O pesado é feito uma vez, não a cada quadro: a camada das paredes é redesenhada só quando algo muda (como o terreno, `terrainDirty`).
- Shaders pequenos: **um programa por desenho** e um para portas e janela. Nada de um shader gigante com todos os desenhos (já travou o WebGL do aplicativo inteiro).
- O visual segue as páginas aprovadas: alturas, cores, ruído, ferragens, vidro, persiana, marca do mestre (trancada em vermelho, secreta tracejada em violeta). Folha da porta fina, de espessura própria `LEAF = 0.055` casa (meia espessura). Janela com peitoril baixo (0,34 casa de altura) e moldura fina (meia largura de 0,07 casa).
- A luz é **relativa**: a camada só aplica o sombreado da face (`luz(n) / luz(plano)`, como o relevo). A luz da cena, a sombra do sol e as tochas continuam vindo do mapa de luz (`lightPass`), que multiplica por cima. A sombra das paredes no chão continua a de hoje (`sunShadows`), assim como o telhado invisível, as janelas e o corte sob porta e janela.
- Sem WebGL 2, ou com o chão desligado (`groundFailed`), tudo fica como hoje: `WallChains` e `drawDoor`/`drawWindow` no canvas.
- O jogador nunca recebe a marca de trancada nem de secreta: as peças são montadas com `gm` e, para jogador, essas flags ficam zeradas. A porta secreta já nem chega ao jogador (`server/src/view.ts`).
- Comentários e textos em português, nomes com significado, sem `any` e sem cast forçado. Formatar só o que foi tocado. Sem commits do agente: cada tarefa termina com a sugestão de `git add` e `git commit`, e espera o "segue".

## Review Focus

- **Cadeia longa (dezenas de casas) vista de perto:** o veio e as juntas não podem tremer nem borrar. O `along` é calculado por pixel a partir da peça, nunca lido de textura de meia precisão.
- **Casa com muitas paredes perto** (labirinto, encontro de várias): o teto de candidatas por casa não pode sumir com uma parede que está de fato ali. Ao cortar, ficam as mais próximas do centro da casa. Teste na Tarefa 1.
- **Quina em L e encontro em T:** sem emenda visível nem dente; a mesma regra de "maior folga vence" do teste aprovado. Teste das pontas (`reach`) na Tarefa 1.
- **Abrir e fechar porta, trocar desenho e desfazer:** a camada é refeita na hora, sem sobrar desenho velho. A peça muda quando a porta muda, e a assinatura das peças entra na chave de redesenho (Tarefa 3).
- **Jogador vendo o mapa:** sem marca do mestre e sem porta secreta. Teste na Tarefa 1.

---

## Arquivos

- Create: `shared/src/wallPieces.ts`: peças, layout das portas (movido de `WallShape.tsx`), índice por casa, empacotamento.
- Modify: `shared/src/index.ts` (exportar), `client/src/map/WallShape.tsx` (importar `doorLayouts` do shared; sem desenho quando a placa de vídeo desenha).
- Create: `client/src/map/ground/wallShader.ts`: GLSL comum (ruído, `pieceAt`, luz relativa, tinta), o programa por desenho e o de portas e janela, portados dos lotes.
- Create: `client/src/map/ground/wallPass.ts`: `WallPass` (texturas das peças e do índice, desenho da camada).
- Modify: `client/src/map/ground/GroundRenderer.ts`, `client/src/map/ground/GroundLayer.tsx`, `client/src/map/ground/groundOutputs.ts`, `client/src/map/ground/GroundOutputLayer.tsx`, `client/src/map/BattleMap.tsx`.
- Test: `server/test/wall-pieces.test.ts`.
- Docs: `docs/design/paredes-gpu-{a,b,c}.html` (cópias aprovadas), `docs/design/relevo.md` (etapa 2: decisões deste plano), `CHANGELOG.md`, `docs/pendencias.md`.

---

### Task 1: Peças e índice por casa (shared, com teste)

**Files:**
- Create: `shared/src/wallPieces.ts`
- Modify: `shared/src/index.ts`, `client/src/map/WallShape.tsx` (passa a importar `doorLayouts` e `DoorLayout` de `@rpg/shared`)
- Create: `docs/design/paredes-gpu-a.html`, `-b.html`, `-c.html` (cópias de `scratchpad/spike/page/paredes-gpu.html`, `-b`, `-c`, sem mudança)
- Test: `server/test/wall-pieces.test.ts`

**Interfaces:**
- Consumes: `wallChains(walls, sceneStyle)` e `WallChain` (`shared/src/wallJoin.ts`), `WALL_STYLES`, `WALL_THICKNESS`, `Wall`.
- Produces:
  ```ts
  export type WallPieceKind = "wall" | "door" | "window";
  export interface WallPiece {
    kind: WallPieceKind;
    style: WallStyle;          // desenho resolvido (o da parede ou o da cena)
    a: LightPoint; b: LightPoint; // casas; porta: a = dobradiça
    thickness: number;         // casas
    along: number;             // comprimento da cadeia até `a` (casas): o veio continua de um trecho para o outro
    reach: [number, number];   // quanto passa de `a` e de `b` (casas)
    seed: number;              // 0..1, da primeira parede da cadeia (ou da porta)
    door?: { open: boolean; swing: 1 | -1; double: boolean; locked: boolean; secret: boolean };
    window?: { closed: boolean };
  }
  export interface DoorLayout { hingeAtTo: boolean; swing: number } // movido de WallShape.tsx, sem mudança
  export function doorLayouts(walls: Wall[]): Map<string, DoorLayout>; // movido, sem mudança
  export function straightenChain(points: LightPoint[], closed: boolean): LightPoint[]; // a de wallChainArt.ts, em casas
  export function wallPieces(walls: Wall[], sceneStyle: WallStyle, viewer: { gm: boolean }): WallPiece[];
  export const PIECE_FLOATS = 16;
  export function packPieces(pieces: WallPiece[]): Float32Array; // PIECE_FLOATS por peça, layout abaixo
  export interface WallCellIndex { col: number; row: number; cols: number; rows: number; start: Uint32Array; count: Uint8Array; list: Uint32Array }
  export const CELL_CANDIDATES = 8;
  export function wallCellIndex(pieces: WallPiece[]): WallCellIndex | null; // null = sem peças
  export function pieceMargin(piece: WallPiece): number; // casas além do eixo que a peça pode ocupar
  ```
- Regras de `wallPieces`:
  - Trechos vêm de `wallChains` com `straightenChain`. Em cada ponta, `reach` vale:
    - meia espessura numa junta interna da cadeia (e em toda junta de cadeia fechada);
    - `thickness * 0.12` em ponta solta (`FREE_END` de hoje);
    - `chain.extend[i]` em ponta `butt`.
  - Cada parede com `door` ou `window` vira uma peça. Na porta, `a` é a dobradiça, segundo `doorLayouts` (`hingeAtTo` troca as pontas); `swing` vem do layout (1 se não houver), e `double` é verdadeiro quando ela está no layout.
  - `locked` e `secret` só valem com `viewer.gm`; para jogador, ficam sempre `false`.
  - A espessura é `wall.thickness ?? WALL_THICKNESS.default`.
  - `seed` = `wallSeed(...) / 2^32`. A `wallSeed` vai do client para o shared junto, e `wallArt.ts` passa a importá-la.
- `pieceMargin`:
  - parede: `thickness * 1.5 + 0.05`, o que cobre a sebe com ondulação, os esteios e a muralha;
  - porta: o comprimento do vão + `thickness`, para a folha aberta girar;
  - janela: `thickness * 1.5 + 0.05`.
- `packPieces`, por peça:
  - v0 = `a.x, a.y, b.x, b.y`;
  - v1 = `thickness, along, seed, estilo` (índice em `WALL_STYLES`);
  - v2 = `reach[0], reach[1], tipo` (0 parede, 1 porta, 2 janela), `bandeiras`;
  - v3 = `swing, 0, 0, 0`.
  - Bandeiras somadas: aberta 1, dupla 2, trancada 4, secreta 8, janela fechada 16.
- `wallCellIndex`: cobre a caixa das peças com a margem. A casa (c, r) recebe toda peça cuja distância do segmento ao **centro** da casa seja ≤ `pieceMargin + 0.7072` (meia diagonal). Com mais de `CELL_CANDIDATES`, ficam as mais próximas do centro. `start` e `count` são por casa (linha a linha); `list` guarda os índices das peças.

- [ ] **Passo 1: Copiar as três páginas aprovadas** para `docs/design/` com os nomes acima, sem mudança.

- [ ] **Passo 2: Escrever os testes que falham** (`server/test/wall-pieces.test.ts`, `node:test` + `assert`, como `relief.test.ts`):
  - `parede em L vira dois trechos com o veio contínuo`: paredes (0,0)→(4,0) e (4,0)→(4,3), estilo `stone`, espessura padrão `T`. Resultado: 2 peças `kind: "wall"`; `pieces[1].along === 4`; `pieces[0].reach[1] === T / 2` (junta interna); `pieces[0].reach[0] === T * 0.12` (ponta solta).
  - `encontro em T no meio de uma reta continua um trecho só`: (0,0)→(4,0), (4,0)→(8,0) e (4,0)→(4,3). A reta de 0 a 8 vira uma peça só, com `a.x === 0` e `b.x === 8`.
  - `porta usa a dobradiça e o giro do layout`: duas portas em linha (2,0)→(3,0) e (3,0)→(4,0). As duas saem com `door.double === true` e `swing` com sinais opostos; a dobradiça (`a`) é a ponta de fora de cada uma.
  - `jogador não recebe marca de trancada nem de secreta`: porta com `locked: true, secret: true`. Com `{ gm: false }`, as duas bandeiras são `false`; com `{ gm: true }`, `true`.
  - `janela fechada`: `window: { closed: true }` dá `kind: "window"` e `window.closed === true`; `packPieces` tem a bandeira 16 na posição `[11]`.
  - `índice por casa acha a parede e respeita o teto`: com uma parede (0,0.5)→(10,0.5), a casa (5,0) a lista e a casa (5,5) não. Com 12 paredes paralelas a 0,05 casa uma da outra passando pela casa (5,0), `count` dessa casa é `CELL_CANDIDATES`, e todas as listadas estão entre as 8 mais perto do centro.
  - `sem paredes, sem índice`: `wallCellIndex([]) === null`.

- [ ] **Passo 3: Rodar e ver falhar**
  Run: `npm test`
  Expected: FAIL em `wall-pieces.test.ts` (o módulo `wallPieces` não existe); o resto passa.

- [ ] **Passo 4: Implementar `shared/src/wallPieces.ts`** com as assinaturas acima.
  - Mover `doorLayouts`, `DoorLayout` e `wallSeed` sem mudar o comportamento.
  - Mudar o `straighten` de `wallChainArt.ts` para usar `straightenChain` em casas (a ordem dos pontos é a mesma).

- [ ] **Passo 5: Rodar os testes e o typecheck**
  Run: `npm test` e `npm run typecheck`
  Expected: tudo passa (os 525 de antes + os novos).

- [ ] **Passo 6: Sugerir o commit**
  ```bash
  git add shared/src/wallPieces.ts shared/src/index.ts client/src/map/WallShape.tsx client/src/map/wallArt.ts client/src/map/wallChainArt.ts server/test/wall-pieces.test.ts docs/design/paredes-gpu-a.html docs/design/paredes-gpu-b.html docs/design/paredes-gpu-c.html
  git commit -m "Paredes na placa de vídeo: peças e índice por casa"
  ```

---

### Task 2: Shaders e `WallPass`

**Files:**
- Create: `client/src/map/ground/wallShader.ts`, `client/src/map/ground/wallPass.ts`

**Interfaces:**
- Consumes: `WallPiece`, `packPieces`, `PIECE_FLOATS`, `wallCellIndex`, `WallCellIndex`, `CELL_CANDIDATES` (Tarefa 1); `linkProgram`, `createTexture`, `bindTextures`, `uniformOf`, `useVertices`, `GroundView` (`glKit.ts`); `FULLSCREEN_VERTEX` (`terrainShader.ts`); `SceneLight`.
- Produces:
  ```ts
  export class WallPass {
    constructor(gl: WebGL2RenderingContext);
    setPieces(pieces: WallPiece[]): void;   // sobe peças + índice; guarda os desenhos presentes
    get empty(): boolean;
    /** Desenha a camada no framebuffer ligado (já limpo), na tela inteira. */
    draw(view: GroundView, width: number, height: number, scene: SceneLight, stone: WebGLTexture, stoneLight: WebGLTexture): void;
    dispose(): void;
  }
  ```
- Texturas:
  - peças: `RGBA32F`, 4 texels por peça, numa linha de até `MAX_TEXTURE_SIZE` (quebrando em linhas);
  - índice: `RG32UI` por casa (`start`, `count`);
  - lista: `R32UI`;
  - todas com `NEAREST` e lidas com `texelFetch`.
- Shader comum (`WALL_COMMON`):
  - `hash`, `noise`, `fbm`, `voronoi` dos lotes;
  - `pieceAt(p)`: percorre as candidatas da casa de `p`. Cada uma é avaliada como em `wallAt` do lote a: `along` local + `piece.along`, `across`, folga = `min(meia largura − |across|, −fora das pontas com reach)`. A maior folga vence. Devolve o índice, `along`, `across` e a folga.
  - Só peças `kind = 0` entram em `pieceAt`; portas e janelas têm o seu próprio `openingAt`.
  - luz relativa: `max(dot(n, L), 0) / max(L.z, 0.35)`, misturada com o ambiente como em `RELIEF_DRAW_FRAGMENT`, de modo que o chão plano dê 1.
  - tinta: a borda da peça e o pixel do chão encostado nela (1 a 2 pixels, `fwidth`), cor `vec3(0.1, 0.075, 0.06)`, como nos lotes.
- Um programa por desenho, gerado a partir de `WALL_STYLES`:
  - `styleHeight` e `styleColor` portados do lote a (`stone`, `rock`, `wood`, `brick`) e do lote b (os outros sete), com a mesma meia largura por desenho;
  - descarta o pixel se a peça vencedora for de outro desenho;
  - a normal sai de diferenças de `styleHeight` com passo de meio pixel da tela (como nos lotes), ou seja, nítida em qualquer zoom.
- Programa das aberturas, portado do lote c:
  - faz o próprio laço sobre as candidatas de `kind ≠ 0`;
  - inclui batentes, `doorLeaf` com `LEAF = 0.055`, dobradiças e puxador, porta dupla, portão (nos desenhos vazados), peitoril, moldura, vidro e persiana;
  - marca do mestre: trancada em vermelho, secreta tracejada em violeta;
  - o ângulo da folha aberta é ±80° × `swing`, como `drawDoor`;
  - batente com a cor do desenho da parede: pedra nos de pedra, tijolo e muralha; madeira em madeira e paliçada *(chamada minha: o lote c só mostrou a pedra)*.
- `draw`:
  - **ordem:** primeiro os programas dos desenhos presentes, depois o das aberturas;
  - **mistura:** pré-multiplicada (`ONE, ONE_MINUS_SRC_ALPHA`), e o chão fica transparente;
  - **limite de corte:** só a caixa das peças na tela (`scissor`).

- [ ] **Passo 1: Escrever `wallShader.ts`** (comum, gerador por desenho, aberturas) portando dos três lotes. Os valores de cor e ruído são os das páginas.
- [ ] **Passo 2: Escrever `wallPass.ts`** com a interface acima. `setPieces([])` libera as texturas.
- [ ] **Passo 3: Typecheck**
  Run: `npm run typecheck`
  Expected: sem erros.
- [ ] **Passo 4: Conferir que compila na placa** na página de teste (servidor da porta 5199):
  - montar com as peças das cenas dos três lotes;
  - comparar as capturas de perto (zoom 5) com as dos lotes: mesma cara, sem anel e sem degrau na quina;
  - todos os programas compilam sem travar.
- [ ] **Passo 5: Sugerir o commit**
  ```bash
  git add client/src/map/ground/wallShader.ts client/src/map/ground/wallPass.ts
  git commit -m "Paredes na placa de vídeo: shaders por desenho e passo do chão"
  ```

---

### Task 3: No mapa (renderizador, camada e reserva no canvas)

**Files:**
- Modify: `GroundRenderer.ts`, `GroundLayer.tsx`, `groundOutputs.ts`, `GroundOutputLayer.tsx`, `BattleMap.tsx`, `WallShape.tsx`

**Interfaces:**
- Consumes: `WallPass` (Tarefa 2), `wallPieces`, `doorLayouts` (Tarefa 1).
- Produces:
  - `GroundRenderer.setWalls(pieces: WallPiece[]): void` marca a camada para redesenho. `GroundRenderer.wallImage: HTMLCanvasElement` é a cópia da camada, feita a cada desenho em que ela mudou.
  - `useGroundOutputs` ganha `walls: HTMLCanvasElement | null`.
  - `GroundOutputLayer` aceita `which: "light" | "flame" | "walls"`. `walls` usa mistura normal e é **um nó dentro da camada das paredes**, não uma `Layer` própria (ver passo 3).
  - `GroundLayer` ganha as props `walls: Wall[]`, `sceneStyle: WallStyle` e `gm: boolean`.

- [ ] **Passo 1: `GroundRenderer`**
  - Guarda uma textura do tamanho da tela para as paredes (como `reliefImage`).
  - A chave de redesenho junta: a visão, a versão das peças (incrementada em `setWalls`) e a luz da cena (`sunDirection`).
  - Na chave mudando, desenha `WallPass.draw` nessa textura e copia para `wallImage`. Sem mudança, não toca na camada.
  - `empty` passa a considerar as paredes.
- [ ] **Passo 2: `GroundLayer`**
  - Monta as peças com `useMemo(() => wallPieces(walls, sceneStyle, { gm }), [walls, sceneStyle, gm])` e chama `setWalls`.
  - Publica `wallImage` em `useGroundOutputs` (como `light` e `flame`) e limpa ao desmontar.
- [ ] **Passo 3: `GroundOutputLayer`**
  - Separa a imagem presa à tela num componente `GroundOutputImage`, usado dentro de uma `Layer` existente.
  - `light` e `flame` continuam como estão.
  - O `walls` redesenha a camada-mãe (`getLayer()?.batchDraw()`) quando avisado por `onGroundDrawn`.
- [ ] **Passo 4: `BattleMap`**
  - Com `groundLit`:
    - passa `chainWalls`, `wallStyle` e `gm` ao `GroundLayer`;
    - na camada das paredes, troca `<WallChains …>` por `<GroundOutputImage which="walls" …>`;
    - passa `gpu` ao `WallShape`.
  - Sem `groundLit`, tudo como hoje.
- [ ] **Passo 5: `WallShape`**
  - Com a nova prop `gpu`, não desenha porta nem janela: mantém a área de clique e, se `selected`, só o contorno de seleção que `drawDoor`/`drawWindow` já desenham (extraído para uma função `drawSelection`).
  - A prévia do traço (`standalone`) continua no canvas *(chamada minha: é um traço momentâneo)*.
- [ ] **Passo 6: Typecheck, testes e build**
  Run: `npm run typecheck`, `npm test`, `npm run build`
  Expected: tudo passa.
- [ ] **Passo 7: Conferir no app** (`npm run dev`, pela pré-visualização), com o mapa visível se der:
  - parede em L, T e diagonal;
  - porta aberta e fechada (clique abre);
  - porta dupla, porta trancada e secreta vistas pelo mestre;
  - janela aberta e fechada;
  - cerca com portão;
  - trocar desenho com desfazer;
  - dia, crepúsculo e noite;
  - sem erro no console.
- [ ] **Passo 8: Sugerir o commit**
  ```bash
  git add client/src/map/ground/GroundRenderer.ts client/src/map/ground/GroundLayer.tsx client/src/map/ground/groundOutputs.ts client/src/map/ground/GroundOutputLayer.tsx client/src/map/BattleMap.tsx client/src/map/WallShape.tsx
  git commit -m "Paredes na placa de vídeo: no mapa, com o canvas de reserva"
  ```

---

### Task 4: Documentação

**Files:**
- Modify: `docs/design/relevo.md`, `CHANGELOG.md`, `docs/pendencias.md`

- [ ] **Passo 1: `relevo.md` (etapa 2).** Registrar as decisões deste plano:
  - peças e índice por casa em vez de pedaços guardados: o cálculo exato por pixel é o que dá Full HD;
  - camada redesenhada só quando algo muda;
  - luz relativa, com a sombra no chão continuando a do passo da luz;
  - folha da porta fina e janela com peitoril e moldura (lote c revisado);
  - as três páginas aprovadas.
- [ ] **Passo 2: `CHANGELOG.md`**, em `[Não lançado]` › *Alterado*: uma linha dizendo que paredes, portas e janelas têm desenho novo em alta definição, com relevo e luz (onde o chão em WebGL está ligado).
- [ ] **Passo 3: `docs/pendencias.md`.** Acrescentar o roteiro de teste da etapa 2 (os itens do Passo 7 da Tarefa 3, mais celular e zoom bem de perto) e o que não foi verificado.
- [ ] **Passo 4: Sugerir o commit**
  ```bash
  git add docs/design/relevo.md CHANGELOG.md docs/pendencias.md
  git commit -m "Paredes na placa de vídeo: documentação"
  ```

---

### Revisão final

Revisão da branch inteira desde `895e29f`, com o Review Focus acima. Achados críticos e importantes entram numa passada de correção (teste que falha antes, quando der). Os menores vão para `docs/pendencias.md`.
