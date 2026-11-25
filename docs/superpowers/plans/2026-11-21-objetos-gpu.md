# Objetos na placa de vídeo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os 28 tipos de objeto passam a ser desenhados pela placa de vídeo, com a receita aprovada no teste: forma pela semente, folhas e pedra em aquarela, madeira, ferro e tecido calculados por pixel, luz por pixel, contorno fino, vento e sombra simples. Assentam no relevo. A edição continua a de hoje.

**Architecture:**
- **Conta pura** (`client/src/map/props/propLayout.ts`, sem DOM), com teste:
  - atlas das formas (lugares por tamanho, resolução que cai e sobe com a quantidade na tela, o menos usado sai);
  - linha de dados de cada objeto (posição, tamanho, giro, semente, base no relevo, transparente);
  - altura da sombra por tipo.
- **Placa de vídeo:** `PropPass` no renderizador do chão.
  - **Forma guardada:** um programa de "assar" calcula, uma vez por tipo e semente, a forma num atlas `TEXTURE_2D_ARRAY`:
    - distância até a borda de fora;
    - altura;
    - distância até a borda de dentro;
    - tom e material.
  - **Desenho:** a cada quadro, um retângulo por objeto lê o atlas, aplica o vento e calcula o detalhe fino e a luz relativa.
  - **Duas saídas novas:** objetos de baixo e objetos de cima, copiadas do canvas WebGL como as de hoje.
  - **Sombra:** entra na máscara de sombra da luz, junto do relevo.
- **Edição:** o Konva fica com nós invisíveis só para clique, arrasto e alças. Enquanto arrasta, o passo recebe a posição provisória.
- **Troca aos poucos:** um conjunto `GPU_PROP_KINDS` diz quais tipos já saem da placa; os outros continuam no Konva até a Tarefa 6.
- **Sem WebGL 2** (ou `groundFailed`): tudo como hoje.

**Tech Stack:** TypeScript, WebGL 2, React + react-konva + zustand, node:test.

**Spec:** [docs/design/objetos.md](../../design/objetos.md). Visual aprovado: `docs/design/objetos-teste.html`. A página tem as contas de referência:
- `canopy`, `pine`, `boulder`, `barrel`, `cart`;
- `albedo`, `swayAt`;
- o contorno e a sombra.

## Global Constraints

- **Dados:** `MapProp` não muda (nem arquivo de sessão, nem servidor). Os 28 tipos são `PROP_KINDS`; o tamanho de cada desenho continua `PROP_EXTENT` (`propArt.ts`).
- **Receita (da página aprovada):**
  - **Copa (árvore, arbusto):**
    - 8 lobos e 30 bolas de folha (raio 0,16–0,25, borda recortada só no contorno);
    - altura da bola `0,9 − anel × 0,25 + 0,12 × domo`;
    - beira da bola escurece de 0,55 a 1;
    - aquarela de grama a `world × 0,22`;
    - folhinhas a 46 e 95.
  - **Pinheiro:** 5 andares, `19 − 3k` galhos, `R = 1,1 × (1 − 0,19k)`, pontas claras (`×1,18`) e fundo escuro (`×0,62`).
  - **Pedregulho:**
    - borda `0,62 × (1 + 0,5 × (fbm − 0,5))`;
    - facetas de voronoi a 4,2, inclinação 0,03;
    - rachaduras em 28% das bordas;
    - musgo onde `n.z > 0,75`.
  - **Barril e carroça:** como `barrel` e `cart` da página.
  - **Contorno:**
    - borda de fora com `1,15 × densidade` px;
    - degrau de dentro com `smoothstep(4, 9, inclinação) × 0,5`.
  - **Sombra (altura por tipo, em casas, no tamanho 1):** árvore 1,25; pinheiro 1,2; arbusto 0,5; pedregulho 0,45; barril 0,8; carroça 0,55. Os outros tipos, da Tarefa 5. O tronco liga a sombra das árvores e pinheiros ao pé (largura 0,07).
  - **Vento:**
    - inclina para o lado do vento e oscila, `0,45 + 0,55 × (0,6 sin(1,1t+φ) + 0,3 sin(2,3t+1,7φ) + 0,1 sin(4,1t+2,9φ))`, com `φ = semente × 0,37 − (posição · direção) × 0,35`;
    - copa desloca `0,07`, pinheiro `0,1 × (1 − r/1,2)`;
    - bola clareia 16% com `hash > 0,93` trocando 2× por segundo;
    - a força e a direção vêm de `windOf(weather)` (`shared/src/wind.ts`).
- **Luz relativa**, como paredes e relevo (`faceLight(scene)`): o passo pinta a cor do material × quanto o ponto está virado para o sol, relativo ao chão plano. A cor e a força da cena vêm da camada de luz por cima.
- **Camadas:**
  - objetos `above: false` → saída **de baixo**, no lugar da `MapPropLayer layer="below"` (acima das paredes, abaixo das tochas, baús e névoa);
  - `above: true` → saída **de cima**, no lugar da `layer="above"` (acima dos tokens, abaixo da luz);
  - ordem = ordem da lista da cena.
- **Copa com token embaixo:** opacidade 0,45 e parada (a regra `under` de hoje).
- **Vento parado:** com a ferramenta *Objetos*, *Reduzir efeitos*, `windStalled`, ou copa transparente.
- **Placa de vídeo:**
  - `ProgramCache` com `NO_UNROLL` e `textureLod` nos laços;
  - samplers sem textura ligados à textura vazia;
  - nada de crase dentro das strings de shader;
  - pré-compilar ao abrir a ferramenta *Objetos* e na primeira cena com objetos.
- **Regras do projeto:**
  - sem `any` nem cast forçado; nomes com significado; comentários em português;
  - textos novos em `pt-BR.ts`, `en.ts` e `es.ts`;
  - sem commits do agente: sugestão de commit no fim de cada tarefa, esperando o "segue".

## Review Focus

- **Floresta grande longe (800 objetos na tela):** o atlas não cabe na melhor resolução; a resolução cai e nada some. Teste do atlas na Tarefa 1; no app na Tarefa 7.
- **Copa parcialmente fora da tela ou objeto girado:** a forma é a do objeto inteiro (o retângulo cobre o `PROP_EXTENT` girado); não corta nas bordas. Teste das linhas na Tarefa 1.
- **Mudar só a posição, o tamanho ou o giro (arrastar):** não refaz a forma (a chave é tipo + semente + resolução). *Variar* refaz. Teste na Tarefa 1.
- **Objeto no relevo, em cima do patamar ou ao pé do penhasco:** a sombra parte da altura do chão; o objeto não some atrás da face. Teste da base na Tarefa 1; no app na Tarefa 4.
- **Própria sombra:** a carroça e o pedregulho não escurecem a si mesmos (a sombra de um objeto não vale dentro da silhueta dele). Conferido no app na Tarefa 4.

---

### Task 1: Conta pura dos objetos na placa

**Files:**
- Create: `client/src/map/props/propLayout.ts`
- Test: `server/test/prop-layout.test.ts` (importa do cliente, como `server-text.test.ts`)

**Interfaces:**
- Produces:
  ```ts
  /** Altura da sombra por tipo (casas, tamanho 1). Tipos ainda sem valor: 0 (sem sombra). */
  export const PROP_CAST: Record<PropKind, number>;
  /** Pontos por casa da forma guardada, por resolução: [48, 24]. */
  export const PROP_TIERS: readonly number[];
  export type PropSlotClass = "small" | "large"; // small: PROP_EXTENT ≤ 1,0; large: o resto
  export interface PropSlot { layer: number; x: number; y: number; side: number }
  export class PropAtlas {
    constructor(size: number, layers: { small: number; large: number });
    /** Resolução para `onScreen` objetos por classe (cai quando não cabe, sobe com folga de 1/4, como o relevo). */
    tierFor(onScreen: { small: number; large: number }): number;
    /** Lugar da forma (chave = tipo|semente|resolução); `fresh` = precisa assar. Sem lugar: null. */
    slotFor(key: string, slotClass: PropSlotClass, frame: number): { slot: PropSlot; fresh: boolean } | null;
    /** Esquece tudo (troca de resolução, contexto perdido). */
    reset(): void;
  }
  export interface PropRowInput { prop: MapProp; base: number; faded: boolean; drag: PropDrag | null }
  export interface PropDrag { col: number; row: number; size: number; rotation: number }
  /** 3 vec4 por objeto: [col, row, size, rotação rad], [tipo, semente, base, faded], [camada do atlas, x, y, lado]. */
  export function propRow(input: PropRowInput, slot: PropSlot, atlasSize: number): Float32Array;
  /** Retângulo do objeto na tela, em casas (o PROP_EXTENT girado), para descartar os de fora. */
  export function propBounds(prop: MapProp, drag: PropDrag | null): { left: number; top: number; right: number; bottom: number };
  ```
- Consumes: `PROP_EXTENT` (`propArt.ts`; se importar `propArt.ts` puxar o DOM no node, mover `PROP_EXTENT` para `propLayout.ts` e reexportar de `propArt.ts`).

- [ ] **Step 1: Testes** em `prop-layout.test.ts`:
  - `slotFor` duas vezes com a mesma chave → mesmo lugar, `fresh` só na primeira;
  - chaves com sementes diferentes → lugares diferentes;
  - atlas cheio:
    - a chave usada há mais quadros sai e a nova pega o lugar dela;
    - se todas foram usadas neste quadro → `null`;
  - `tierFor({ small: 10, large: 10 })` → 0;
  - acima da capacidade grande da resolução 0 → 1;
  - voltando a 1/4 de folga → 0 de novo;
  - `propRow` de um objeto arrastado usa a posição do arrasto;
  - `faded` vai como 1;
  - a base vai como recebida;
  - `propBounds` de uma árvore (extent 1,65) girada 45°, tamanho 2 → caixa de lado `2 × 1,65 × 2 × √2` em volta do centro;
  - todo `PROP_KINDS` tem `PROP_CAST` definido (número ≥ 0).
- [ ] **Step 2:** `npx tsx --test server/test/prop-layout.test.ts`. Esperado: falha (módulo não existe).
- [ ] **Step 3:** implementar.
  - Capacidade por camada: 2048 / lado do lugar.
  - Lado = `ceil(extent × 2 × pontos por casa)` da maior extensão da classe (small: 1,0 → 96 na resolução 0; large: 1,7 → 164).
- [ ] **Step 4:** o mesmo comando. Esperado: PASS. Depois `npm run typecheck`.
- [ ] **Step 5:** sugerir commit `Objetos: conta do atlas e das linhas para a placa de vídeo`.

### Task 2: Passo dos objetos (6 tipos aprovados) e as duas saídas

**Files:**
- Create:
  - `client/src/map/props/propShader.ts`:
    - `PROP_BAKE_FRAGMENT(kind: PropKind): string` (forma do tipo: as funções da página, escrevendo os 4 canais);
    - `PROP_DRAW_FRAGMENT: string` e `PROP_DRAW_VERTEX: string` (retângulo por objeto, instanciado).
  - `client/src/map/props/propPass.ts`:
    ```ts
    export const GPU_PROP_KINDS: ReadonlySet<PropKind>; // nesta tarefa: tree, pine, bush, boulder, barrel, cart
    export class PropPass {
      setProps(props: MapProp[], relief: ReliefChunks): void;
      setFaded(ids: ReadonlySet<string>): void;
      setDrag(id: string | null, drag: PropDrag | null): void;
      setWind(wind: { strength: number; direction: [number, number] } | null): void;
      bake(view: GroundView): boolean;               // até 6 formas por quadro; devolve se assou algo
      draw(layer: "below" | "above", view: GroundView, width: number, height: number, scene: SceneLight, time: number, textures: { leaves: WebGLTexture; stone: WebGLTexture; dirt: WebGLTexture }): void;
      drawShadowMask(view: GroundView, width: number, height: number, scene: SceneLight, time: number): void; // Tarefa 4
      warm(): void;
      get empty(): boolean; get pending(): boolean; get swaying(): boolean; dispose(): void;
    }
    ```
- Modify:
  - `client/src/map/ground/GroundRenderer.ts`:
    - `propsBelowImage` e `propsAboveImage` (canvas), desenhados depois das paredes, cada um copiado com `copyTo`;
    - `setProps`, `setPropFaded`, `setPropDrag`, `setPropWind` (repassam);
    - refeitas quando objetos, visão ou luz mudam, ou a cada quadro com `swaying`;
    - aquarelas `grass`, `stoneLight`, `dirtDark` de `this.watercolors`.
  - `client/src/map/ground/groundOutputs.ts`: `propsBelow` e `propsAbove` no store; `onPropsDrawn` / `notifyPropsDrawn`.
  - `client/src/map/ground/GroundOutputLayer.tsx`: `GroundPropsImage({ which: "below" | "above", view, size })`, com mistura normal, presa à tela, redesenha com `onPropsDrawn`.
  - `client/src/map/ground/GroundLayer.tsx`: efeito `setProps(props, relief)`; `animating` passa a incluir `renderer.swaying`; `renderer.warm({ props: true })` com a ferramenta *Objetos* aberta (o `warm` do renderizador ganha `props?: true` e chama `PropPass.warm`).
  - `client/src/map/MapProps.tsx`: com `gpu` (prop nova): tipos em `GPU_PROP_KINDS` não desenham imagem (só o nó invisível da Tarefa 3; nesta tarefa, a imagem com `opacity 0`); os outros como hoje.
  - `client/src/map/BattleMap.tsx`: `GroundPropsImage which="below"` dentro da camada dos objetos de baixo e `which="above"` na de cima, só com `groundLit`; `gpu={groundLit}` nas duas `MapPropLayer`.
- Test: conferência no app

**Interfaces:**
- Consumes: `PropAtlas`, `propRow`, `propBounds`, `PROP_TIERS` (Tarefa 1); `faceLight`; `reliefSampler`; `ProgramCache`.
- Produces: `PropPass` e `GPU_PROP_KINDS` para as Tarefas 3–6; `GroundPropsImage`.

- [ ] **Step 1:** shader de assar.
  - Uma passada por forma: `gl.framebufferTextureLayer` no lugar do atlas, `viewport` no lugar, avalia a forma do tipo no ponto (coordenadas do objeto, tamanho 1, sem vento).
  - Escreve, em RGBA8:
    - **R** = distância até a borda de fora, em `0,5 + sd × 4` (cortada);
    - **G** = altura / 4;
    - **B** = distância até a borda de dentro, `clamp(dist × 8)`, achada pelo degrau da altura entre vizinhos ao assar;
    - **A** = material × 32 + tom × 31.
  - Materiais: 0 folha, 1 agulha, 3 pedra, 4 madeira, 5 madeira escura, 6 ferro, 7 tecido.
- [ ] **Step 2:** shader de desenho.
  - Um retângulo instanciado por objeto (3 atributos vec4 da `propRow`), cobrindo o `PROP_EXTENT` girado.
  - No fragmento:
    1. coordenada do objeto;
    2. vento: lê a altura em `q` e lê de novo em `q − balanço × altura`;
    3. contorno de fora pela distância (largura fixa em px);
    4. degrau de dentro pelo canal B;
    5. normal pelos vizinhos da altura (`textureLod`, passo de 1 px de tela);
    6. cor pelo material, com o detalhe fino na hora (as funções `albedo` da página, a partir da posição no mapa);
    7. luz relativa `faceLight`;
    8. `faded` → 0,45.
  - Cor pré-multiplicada.
- [ ] **Step 3:** ligar no renderizador e nas camadas (lista *Modify*).
  - Só tipos em `GPU_PROP_KINDS` entram no passo.
  - Formas da tela primeiro; depois as próximas, até 6 por quadro.
- [ ] **Step 4:** `npm run typecheck` e `npm test`. Esperado: limpos.
- [ ] **Step 5:** conferir no app com o teste lado a lado:
  - árvores, pinheiros, arbustos, pedregulhos, barris e carroça como na página (dia, entardecer, luar com tocha);
  - outros tipos ainda no desenho antigo;
  - perto e longe nítidos;
  - *Variar* refaz;
  - sem erro no console.
- [ ] **Step 6:** sugerir commit `Objetos: passo na placa de vídeo com os seis tipos aprovados`.

### Task 3: Vento, copa transparente e edição

**Files:**
- Create: `client/src/map/props/propDrag.ts`: store zustand `usePropDrag: { id: string | null; drag: PropDrag | null }` e `movePropDraft(id: string | null, drag: PropDrag | null)`.
- Modify:
  - `client/src/map/MapProps.tsx`:
    - com `gpu`, o tipo da placa vira `PropHitNode`: `Konva.Rect` invisível (`opacity 0`), do lado do desenho, com o `hitFunc` de hoje, arrastável e com o `Transformer`;
    - `onDragMove` / `onTransform` chamam `movePropDraft` com a posição, o tamanho e o giro do nó; o fim limpa e faz o `updateProp` de hoje;
    - a regra `under` vira a lista de ids transparentes (para o passo);
    - `PlantNode` só para tipos fora da placa.
  - `client/src/map/ground/GroundLayer.tsx`:
    - `setPropDrag` a partir de `usePropDrag`;
    - `setPropFaded` a partir dos tokens (mesma conta de `under`);
    - `setPropWind`: `windOf(weather)`, ou `null` com a ferramenta *Objetos*, `reduceFx` ou `windStalled`;
    - o `FrameWatch` de hoje vale para os quadros do chão com objetos balançando.
- Test: conferência no app

**Interfaces:**
- Consumes: `PropPass.setDrag/setFaded/setWind`, `swaying` (Tarefa 2).
- Produces: `usePropDrag`, `movePropDraft`.

- [ ] **Step 1:** vento no passo (fórmulas das Global Constraints); `swaying` = algum tipo de planta na tela com vento ligado.
- [ ] **Step 2:** nó invisível, arrasto e alças com a posição provisória; copa transparente parada.
- [ ] **Step 3:** `npm run typecheck` e `npm test`. Esperado: limpos.
- [ ] **Step 4:** conferir no app:
  - escolher, arrastar (com e sem Shift), alças de tamanho e giro: o desenho acompanha o mouse;
  - Delete, Ctrl+C / Ctrl+V, *Desfazer*, *Variar*, *Acima/Abaixo*;
  - pincel *Espalhar* uma *Floresta* e *Apagar*;
  - token embaixo da copa (transparente e parada);
  - brisa e vento forte; parado com *Objetos* aberta e com *Reduzir efeitos*.
- [ ] **Step 5:** sugerir commit `Objetos: vento, copa transparente e edição com o desenho da placa`.

### Task 4: Sombra e relevo

**Files:**
- Modify:
  - `client/src/map/props/propPass.ts`:
    - `drawShadowMask`: para cada objeto com `PROP_CAST > 0`, o retângulo deslocado para longe do sol em `(PROP_CAST × tamanho) × shadowCells` por casa de altura de parede (a mesma conta das paredes);
    - lê a silhueta do atlas (com o vento) e soma na máscara com borda macia `0,05 + altura × 0,06`;
    - não soma dentro da silhueta do próprio objeto;
    - tronco de árvore e pinheiro do pé até a sombra da copa.
  - `client/src/map/props/propShader.ts`: `PROP_SHADOW_FRAGMENT`.
  - `client/src/map/ground/GroundRenderer.ts`: o `extraShadow` da luz chama o relevo e depois `props.drawShadowMask`.
  - `client/src/map/props/propPass.ts` (`setProps`): base = `reliefSampler(relief)(col, row)` × 1,4 casa por nível (`LEVEL_HEIGHT` do relevo) na `propRow`; a sombra sobe pela base.
- Test: conferência no app

**Interfaces:**
- Consumes: `PROP_CAST`, `propRow` (base) da Tarefa 1; `LightPass.renderLight(…, extraShadow)`.

- [ ] **Step 1:** máscara de sombra e base no relevo (lista acima).
- [ ] **Step 2:** `npm run typecheck` e `npm test`. Esperado: limpos.
- [ ] **Step 3:** conferir no app:
  - dia, entardecer (curto, ~2,1 casas por parede) e luar;
  - o token entra na sombra da árvore e escurece;
  - carroça e pedregulho sem sombra em cima de si;
  - árvore em cima de um patamar +2 com a sombra caindo lá embaixo;
  - noite sem lua: sem sombra.
- [ ] **Step 4:** sugerir commit `Objetos: sombra pelo sol e pela lua, assentados no relevo`.

### Task 5: Página de catálogo dos outros 22 tipos (aprovação do dono)

**Files:**
- Create: `docs/design/objetos-catalogo-teste.html`: a página aprovada, com os 22 tipos que faltam lado a lado, em três sementes cada:
  - flores, palmeira, grama alta, pedras, entulho, tronco caído, toco, cogumelos;
  - caixote, pilha de caixotes, pilha de tábuas, mesa, estante, cama, ponte, poço;
  - pilar, estátua, altar, barraca, sacos, ossos.
  - Mesmos controles (luz, zoom, vento, *Variar*, *Hoje*).

- [ ] **Step 1:** cada tipo na receita do seu grupo (tabela de `objetos.md`), com as mesmas partes e escala do desenho de hoje (`propArt.ts`, `propArtMore.ts`, `plantArt.ts`).
- [ ] **Step 2:** servir a página (servidor estático do teste) e conferir de perto cada peça; ajustar o que destoar da página aprovada.
- [ ] **Step 3:** **parar e pedir aprovação ao dono** (capturas de dia, entardecer e luar, e de perto). Ajustar até aprovar.
- [ ] **Step 4:** completar `PROP_CAST` dos 22 tipos (altura da sombra de cada um, da página) e rodar o teste da Tarefa 1.
- [ ] **Step 5:** sugerir commit `Objetos: catálogo dos 22 tipos aprovado`.

### Task 6: Os 22 tipos no passo

**Files:**
- Modify:
  - `client/src/map/props/propShader.ts`: as formas da página de catálogo em `PROP_BAKE_FRAGMENT(kind)`.
  - `client/src/map/props/propPass.ts`: `GPU_PROP_KINDS` = todos os `PROP_KINDS`.
- Test: conferência no app

- [ ] **Step 1:** as 22 formas, um grupo por vez, conferindo cada grupo no app contra a página de catálogo.
- [ ] **Step 2:** `npm run typecheck` e `npm test`. Esperado: limpos.
- [ ] **Step 3:** conferir no app um mapa com os 28 tipos: dia, entardecer, luar; perto e longe; vento nas plantas (flores, palmeira, grama alta); sombra de cada um.
- [ ] **Step 4:** sugerir commit `Objetos: os 28 tipos na placa de vídeo`.

### Task 7: Ícones, desempenho e o caminho sem WebGL 2

**Files:**
- Modify:
  - `client/src/map/props/propPass.ts`: `iconOf(kind: PropKind, seed: number, side: number): HTMLCanvasElement | null` (assa, desenha de dia num alvo pequeno e copia; guardado por tipo).
  - `client/src/map/ground/GroundRenderer.ts`: `propIcon(kind)` repassando.
  - `client/src/map/MapProps.tsx`: `PropIcon` usa o ícone da placa quando houver; senão o de hoje.
- Test: conferência no app

- [ ] **Step 1:** ícones do painel *Objetos* no desenho novo.
- [ ] **Step 2:** medir no app compilado (`npm run build`, `node dist/server.cjs`):
  - **WASD:** com 500 objetos (*Floresta* espalhada), sem engasgo visível, comparando com a `master`;
  - **Pincel *Espalhar*:** uma floresta inteira sem travar;
  - **Cena grande:** abrir uma cena com 800 objetos e afastar até ver todos (a resolução cai, nada some);
  - **Primeira vez:** os programas compilam sem pausa longa.
  - Anotar os números em `docs/pendencias.md`. Se algum passar do aceitável, ajustar o que medir (formas por quadro, resolução, teto do atlas) antes de seguir.
- [ ] **Step 3:** conferir sem WebGL 2 (forçar `groundFailed`): tudo como antes, com o vento de `PlantWind.tsx`.
- [ ] **Step 4:** `npm run typecheck`, `npm test`, `npm run build`. Esperado: limpos.
- [ ] **Step 5:** sugerir commit `Objetos: ícones na placa, medidas de desempenho`.

### Task 8: Documentação

**Files:** `CHANGELOG.md` (*Alterado*: objetos redesenhados), `SPEC.md` (entrada da troca de motor, etapa 1), `docs/pendencias.md` (roteiro de teste dos objetos e o que ficou para a etapa 2), `docs/backlog.md` (Entrega 2 da *Criação de mapa* feita).

- [ ] **Step 1:** escrever.
- [ ] **Step 2:** sugerir commit `Objetos: documentação`.

### Revisão final

Uma revisão do branch inteiro contra `objetos.md` e o Review Focus, antes de seguir para a etapa 2 (sombra por objeto).
