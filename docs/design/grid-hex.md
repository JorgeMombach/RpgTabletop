# Grid hexagonal (Passo 16)

Desenho aprovado em 2026-11-12, em brainstorm com o dono do projeto. Entra no pacote da branch `feat/campanha`, em três fases jogáveis. As três fases foram feitas (fase 1 em 2026-11-13, fase 2 em 2026-11-13, fase 3 em 2026-11-16); planos em `docs/superpowers/plans/2026-11-1*-grid-hex-fase-*.md`.

## Objetivo

Combate tático em mapas hexagonais: tokens encaixando em hex, criaturas grandes ocupando formas de hex, régua contando hexes e, nas fases seguintes, áreas, efeitos, paredes, névoa e visão em hex. Mapa de viagem (hexcrawl) não é o foco, mas funciona com a Fase 1.

Continua valendo o ADR-06: o hex muda a geometria, não cria regra. O app não conta movimento nem alcance.

## 1. Dados

- **Por cena:** `map.grid: "square" | "hexRows" | "hexCols"`. Ausente = `"square"` (arquivos antigos abrem iguais; formato 2, campo opcional).
  - `hexRows`: hex de **pontas para cima**, linhas deslocadas ("vertical" no backlog).
  - `hexCols`: hex de **lado reto em cima**, colunas deslocadas ("horizontal").
- **Posições continuam `{ col, row }`.** No hex são coordenadas *offset*: `hexRows` = "odd-r" (linhas ímpares meio hex à direita); `hexCols` = "odd-q" (colunas ímpares meio hex para baixo). Coordenadas cúbicas existem só dentro da geometria, para as contas.
- **`cellPx`** = distância entre centros de hexes vizinhos (de lado reto a lado reto). A calibração por arraste continua valendo. `offsetX`/`offsetY` = canto de cima à esquerda do hex (0, 0).
- **O que tem posição livre não muda de formato:** paredes, tochas, objetos, desenhos, pings e setas guardam a posição em unidades de `cellPx` a partir do canto do grid, igual no quadrado e no hex. Só o encaixe (o "imã") muda.
- **Trocar o grid da cena** (com confirmação): tokens e baús mantêm `col`/`row` (podem trocar de vizinhos ou se encavalar; o app não reposiciona ninguém); paredes, portas, névoa pintada, explorado e pinturas de efeito são apagados (só valem na geometria em que foram feitos).

## 2. Geometria (`shared/src/gridGeometry.ts`)

Um módulo com a mesma interface para as três geometrias; mapa, régua, servidor, névoa e visão chamam ele em vez de fazer a conta do quadrado à mão. O quadrado devolve exatamente o que o código faz hoje.

| Função | O quê |
|---|---|
| `geometryOf(map)` | a geometria da cena |
| `cellCenter(pos)` / `cellAt(point)` | centro de uma casa e casa de um ponto (em unidades de `cellPx`) |
| `neighbors(pos)` | 4 vizinhos no quadrado (como o cômodo de hoje), 6 no hex |
| `distance(a, b)` | casas entre duas posições (quadrado: a regra de hoje, diagonal = 5 ft; hex: número de hexes) |
| `footprint(pos, size)` | casas ocupadas por uma criatura |
| `shapeCenter(pos, size)` | onde o token é desenhado |
| `cellPolygon(pos)` | contorno da casa (desenho do grid, névoa, pincel) |
| `snapPoints` | pontos de encaixe livre (cantos no quadrado; vértices e centros no hex) |

### Tamanhos no hex
- Miúdo divide a casa (como hoje); Pequeno e Médio: 1 hex.
- **Grande: 3 hexes** em triângulo. `pos` é o hex de cima à esquerda da forma.
- **Enorme: 7 hexes** (o hex e o anel em volta). `pos` é o hex do meio.
- **Imenso: 19 hexes** (dois anéis). `pos` é o hex do meio.
- `shapeCenter` = média dos centros da forma. O servidor confere todas as casas da forma, como hoje.

## 3. Fases

### Fase 1 — dá para jogar combate em hex
- `gridGeometry.ts` e testes das três geometrias.
- Painel *Mapa*: escolha do grid (*Quadrado*, *Hex (pontas para cima)*, *Hex (lado em cima)*), confirmação ao trocar com coisas no mapa; grid hex desenhado na cor da cena; calibração.
- Tokens: encaixe no hex mais perto; formas dos tamanhos; servidor conferindo ocupação pela geometria (`token:move`, invocar ao lado, *Levar o grupo*, ficha que cresce, soltar da lista na casa livre mais perto).
- Régua contando hexes ("4 hexes · 20 ft"); baús encaixando no hex.
- **Desligado na cena hex** (botão apagado com a dica "Ainda não disponível no grid hexagonal" **e recusa no servidor**, com mensagem traduzida): paredes e portas, névoa (pincel, retângulo, cômodo, revelar/cobrir), visão dos personagens, pincel de efeitos, pincel de espalhar, áreas de magia e fixar efeito.
- Importar do Dungeondraft numa cena hex volta a cena para quadrado (o formato só tem grid quadrado).

### Fase 2 — áreas e efeitos
- Áreas: origem encaixa no centro ou num vértice do hex; tamanho em pés (o desenho já é geométrico).
- Fixar efeito e efeito que anda com o token.
- Pincel de efeitos hex a hex (tamanhos 1, 7 e 19); `MapEffect.cells` continua guardando `col, row`.
- Pincel de espalhar objetos com pincel em hex.

### Fase 3 — paredes, névoa e visão
- Paredes e portas encaixando nos vértices e lados do hex (traço livre e borracha iguais).
- Névoa: pincel em hexes; retângulo revela os hexes cujo centro cai dentro dele; *Revelar o mapa*, *Cobrir tudo*; *Cômodo* cresce hex a hex até as paredes (vizinhos pela geometria, passagem por cruzamento de parede como hoje).
- Visão dos personagens: linha de visão do centro de cada hex; explorado e "visto por último".
- Máscara da névoa desenhada em hex. A névoa continua guardada por linhas em intervalos de colunas (as coordenadas offset cabem no mesmo formato).

## 4. Visual

Protótipo aprovado em 2026-11-13, antes da Fase 1 (as duas orientações, os quatro tamanhos, régua e barra com ferramentas desligadas, sobre o couro e sobre um mapa):
- Grid hex com o mesmo traço e cor do grid quadrado da cena.
- Token Médio: a moldura de hoje (círculo, quadrado, hexágono), centrada no hex, com ~90% da largura do hex.
- Token grande: moldura centrada no `shapeCenter`, cobrindo a forma; os hexes ocupados realçados de leve com o token selecionado ou sendo arrastado.
- Régua realça os hexes cruzados.

## 5. Testes

- Geometria (puros, em `server/test/`): por geometria, `cellCenter`↔`cellAt` ida e volta, vizinhos, distância, formas dos tamanhos, casa livre mais próxima; o quadrado comparado com o comportamento atual (`grid.ts`).
- Servidor (Fase 1): Grande no hex recusa pousar em cima de alguém e aceita do lado; invocar, *Levar o grupo* e ficha que cresce caem em lugar livre no hex; trocar o grid apaga paredes, névoa e pinturas e mantém tokens; ações desligadas recusadas numa cena hex (textos no `serverText.ts`); `map.grid` no arquivo de sessão (ida e volta, arquivo antigo = quadrado, `save-guard`).
- Fases 2 e 3: os mesmos tipos de teste para áreas, pincel, cômodo e visão.

## 6. Documentação

Cada fase: linha no CHANGELOG e no README (painel *Mapa*); a SPEC registra a decisão "geometria no `shared`, posições em offset, o que é livre não muda" e o que fica desligado no hex até a fase seguinte.
