# Cenário: paredes novas, objetos e pincel de espalhar

Desenho combinado em 2026-11-03, em brainstorm com o dono do projeto. Entra na versão depois da 2.12.0, numa branch contínua nova; a Fase 4 (exportar/importar) e a Fase 7 (instalador/hospedagem) ficam para depois. Inspiração: o editor de mapas da Deepnight, em que as árvores nunca saem iguais.

## Decisões

- **Tudo desenhado por código** (como paredes, tochas e baús hoje), com **protótipo de cada peça** antes de entrar no app. Nada de imagem pronta.
- **Paredes ganham desenho próprio** (hoje é um só por cena) e cada desenho diz se **bloqueia a visão** ou só marca o limite.
- **Objetos atrapalham a visão** quando são grandes (árvore, pilar, pedregulho): entram na conta da visão dos personagens, como as paredes.
- **Pincel de espalhar** entra já nesta versão.
- Só o **mestre** coloca e mexe; os jogadores só veem.

## 1. Paredes

### Desenho por parede
- `Wall.style` (opcional): o desenho daquela parede. Sem ele, vale o desenho da cena (`map.wallStyle`), então sessões antigas abrem iguais.
- Na ferramenta *Paredes*, o painel ganha a escolha do desenho (com miniatura). Parede nova sai com o escolhido. O modo **Trocar desenho** muda o das paredes que o mestre arrastar por cima (como a borracha) e **Todas** muda a cena inteira. (Decidido na implementação: clicar numa parede, nessa ferramenta, já começa a traçar outra.)
- O desenho da cena (padrão das paredes antigas) só aceita os que bloqueiam a visão: assim a visão olha só a própria parede.

### Catálogo
| Desenho | Bloqueia a visão | Porta nele vira |
|---|---|---|
| Pedra, Rocha, Madeira (os de hoje) | sim | porta de hoje |
| Tijolo | sim | porta de madeira |
| Paliçada (troncos pontudos) | sim | portão de troncos |
| Muralha (grossa, com ameias) | sim | portão de ferro |
| Cerca de madeira | não | **portão de cerca** |
| Grade de ferro | não | **portão de ferro** |
| Arame farpado | não | (sem porta) |
| Sebe (arbustos) | não | passagem na sebe |
| Muro baixo de pedra | não | (sem porta) |

Bloquear ou não é do desenho (não uma caixinha por parede): cerca nunca bloqueia, muro sempre. Porta fechada num desenho que não bloqueia continua sem bloquear (o portão da cerca deixa ver).

### Por baixo
- `blocks(w)` (em `shared/src/fog.ts`) passa a olhar o desenho: os que não bloqueiam ficam fora da visão dos personagens, da luz das tochas e do *Cômodo* da névoa.
- Arquivo de sessão: o campo novo, com ida e volta (`save-guard`).

## 2. Objetos (ferramenta *Objetos*, tecla O)

### O que é um objeto
`MapProp` por cena: tipo, posição livre em casas (fracionada, como as tochas), tamanho (escala), giro, **semente** (variação), camada (**abaixo** ou **acima** dos tokens) e **bloqueia a visão** (o padrão vem do tipo; o mestre muda por objeto).

### Variação por semente
O desenho sai de uma conta com a semente: duas árvores nunca saem iguais, mas a mesma árvore é igual para todos e não muda ao recarregar. Botão **Variar** sorteia outra semente.

### Catálogo da primeira leva
| Objeto | Camada | Bloqueia a visão |
|---|---|---|
| Árvore (copa) | acima: o token passa por baixo | sim (o tronco) |
| Arbusto | abaixo | não |
| Pedregulho grande | abaixo | sim |
| Pedras pequenas | abaixo | não |
| Tronco caído | abaixo | não |
| Toco | abaixo | não |
| Entulho | abaixo | não |
| Barril | abaixo | não |
| Caixote (e pilha de caixotes) | abaixo | pilha: sim |
| Pilha de tábuas | abaixo | não |
| Mesa | abaixo | não |
| Pilar | abaixo | sim |

Depois (segunda leva, se a primeira ficar boa): estátua, ossos, altar, barraca, carroça, poço, estante, cama, sacos, cogumelos, flores, ponte de tábuas.

### Editar
- Escolher o objeto no painel e clicar no mapa (ou arrastar do painel), como as tochas.
- Clicar num objeto seleciona: **arrastar** muda o lugar; **alças** mudam o tamanho e o giro; no painel, *Variar*, *Acima/Abaixo dos tokens*, *Bloqueia a visão*, *Apagar*.
- Posição livre; segurando **Shift**, encaixa no grid.
- **Ctrl+Z** (escopo próprio no `mapHistory`), **Ctrl+C / Ctrl+V** (cola onde está o mouse) e **Delete**.

### Visão e névoa
- Objeto que bloqueia vira um contorno pequeno (o pé da árvore, o pilar), que entra na conta da visão como segmentos de parede. Não entra no *Cômodo* (uma árvore não fecha uma sala).
- Coberto pela névoa, o jogador não recebe o objeto (como tochas e baús); no explorado, vê.
- Copa acima dos tokens: fica meio transparente quando tem token embaixo, para não esconder ninguém.

## 3. Pincel de espalhar

- Na ferramenta *Objetos*, o modo **Espalhar** pinta uma área e o app distribui objetos nela, sem encavalar (distância mínima entre eles), cada um com semente, tamanho e giro sorteados.
- **Conjuntos**: *Floresta* (árvores e arbustos), *Bosque ralo* (poucas árvores, mais arbustos e tocos), *Pedregal* (pedregulhos e pedras), *Entulho* (entulho, tábuas, pedras). O mestre escolhe o conjunto, o tamanho do pincel e a **densidade**.
- **Apagar** tira os objetos que o pincel tocar. Uma pincelada inteira é um passo do *Desfazer*.
- O que o pincel põe é objeto normal: dá para selecionar, mexer e apagar um por um.

## 4. Limites e desempenho

- Até **800 objetos por cena** e paredes como hoje.
- Cada objeto é desenhado uma vez numa imagem guardada (refeita só quando muda tipo, semente, tamanho ou zoom forte), para o mapa não pesar com uma floresta inteira. Medir o WASD com 500 objetos antes de lançar (a lição do pincel de efeitos).

## 5. Ordem de trabalho (cada passo com protótipo antes)

1. **Paredes**: protótipo dos desenhos novos e dos portões → desenho por parede, bloqueia ou não, painel.
2. **Objetos**: protótipo do catálogo com variações (várias árvores, várias pedras lado a lado) → ferramenta, edição, visão.
3. **Pincel de espalhar**: protótipo de uma floresta espalhada → pincel, conjuntos, densidade.

## 6. Ferramentas de construção na aba Mapa (decidido em 2026-11-03)

A barra do mapa ficou cheia para o mestre. Ela fica só com o que se usa jogando (Mover, Régua, Área, Ping, Desenho/Setas e Névoa, que revela salas durante o jogo); Paredes, Tochas, Baús, Objetos e Pincel de efeitos vão para o painel **Construir** na aba *Mapa* (entre Cenas e Mapa), e as opções de cada uma passam a ficar dentro do painel, em vez de flutuar por cima do mapa. Atalhos continuam; com outra aba aberta, a coluna troca para *Mapa*.

## Fora daqui

- Objetos que o jogador coloca, colisão/movimento bloqueado (o app não é motor de regras, ADR-06), objetos animados, imagens enviadas pelo mestre como objeto.
