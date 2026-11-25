# Fontes de luz: modelos novos, cores e tocha na parede (bloco 6)

Bloco 6 da lista de 2026-11-24 (branch `feat/objetos`). Aprovado na conversa de 2026-11-25.

## Por quê

Hoje o mestre tem três tochas soltas (fincada, de ferro, braseiro), todas com a mesma luz quente, desenhadas em
canvas 2D. Ele quer **mais desenhos de fontes de luz** para montar cenas diferentes (acampamento, taverna, cripta,
templo), **mais cores** de luz, a **tocha presa na parede** e as tochas de hoje **redesenhadas no padrão novo**
(por pixel na placa de vídeo, como os objetos, nítidas em qualquer zoom).

## Objetivos

- Dez modelos:
  - **tochas refeitas:** fincada, de ferro, braseiro;
  - **na parede:** arandela;
  - **no chão:** fogueira de acampamento, lanterna, castiçal com velas, candelabro de pé, lamparina a óleo,
    orbe/cristal mágico.
- **Cores da luz:**
  - chama comum (padrão);
  - azul (fogo mágico);
  - verde (fogo-fátuo);
  - roxo;
  - branco frio.
  A cor tinge a chama no desenho e a luz no chão.
- **Alcance por modelo** (só visual, ADR-06: não muda visão nem regra).
- **Arandela presa à parede:**
  - o clique perto de uma parede gruda a arandela nela, virada para o lado do clique;
  - a luz sai só desse lado;
  - se a parede for apagada ou movida e a arandela ficar solta, ela some junto (como uma porta).
- Desenho por pixel na placa de vídeo, no estilo dos objetos (aquarela/metal/madeira por ponto, luz de um lado,
  contorno fino), com a chama animada.

## Fora do escopo

- Trocar a cor ou o modelo de uma fonte já posta (apaga e põe de novo). Fica para depois, se fizer falta.
- Luz pendurada no teto (lustre) e luz carregada por token além da tocha de hoje.
- Mudar a visão dos personagens na névoa por causa dessas luzes (continua como hoje).

## Anti-objetivos

- Cara de canvas/"Paint" (o retorno das molduras): nada de forma chapada com degradê simples.
- Pesar: 20 fontes de luz na cena de teste sem piorar o `idle` e o `zoom` do teste de desempenho.

## Abordagens

1. **Ampliar a tocha fixa de hoje** (escolhida):
   - a mesma peça do jogo (`MapTorch`), com mais desenhos, cor e o "preso à parede";
   - desenho num passo da placa de vídeo com o kit dos objetos;
   - luz pelo caminho dos efeitos (cor e tremor);
   - ferramenta, borracha, desfazer, arrastar, arquivo de sessão e névoa continuam iguais.
2. **Fontes de luz como objetos com "acende luz":**
   - ganharia girar, tamanho e copiar/colar;
   - mas misturaria duas ferramentas (o *Espalhar* e o limite de objetos passariam a valer para luz, e o filtro da
     névoa teria de ser refeito);
   - muito trabalho para pouco ganho.
3. **Só desenhar mais modelos no canvas:** rápido, mas abaixo do padrão. Descartada.

## Como fica (decidido)

### Dados (`shared/src/types.ts`)

- `MAP_TORCH_STYLES`: os 3 de hoje + `sconce` (arandela), `campfire`, `lantern`, `candles`, `candelabra`,
  `oilLamp`, `orb`. Os ids antigos não mudam (mapas salvos abrem iguais).
- `MAP_TORCH_COLORS = ["flame", "blue", "green", "purple", "white"]`.
- `MapTorch`:
  - `color?: MapTorchColor` (sem campo = `flame`);
  - `facing?: number` (só na arandela: o ângulo, em graus, para onde ela aponta, saindo da parede).
- Os campos novos vão no arquivo de sessão, ida e volta, e no `save-guard`.

### Servidor (`server/src/actions/mapTorches.ts`)

- `maptorch:add` passa a receber `color?` e `facing?`.
- **Outros modelos:** continuam recusando parede ("Aí tem uma parede.").
- **Arandela:** é o contrário. Precisa ter uma parede a até 0,3 casa da base; sem ela, recusa com
  "A arandela precisa de uma parede." (modelo traduzível, `serverText.ts`). O `facing` é validado (0–359).
- **`maptorch:move` da arandela:** mesma regra; o cliente manda o ponto e o ângulo já grudados na parede.
- **Arandela solta:** depois de qualquer ação que muda paredes, sai toda arandela que ficou sem parede a até
  0,3 casa. Ações que mudam paredes: `wall:add`, `wall:remove`, `wall:erase`, `wall:clear`, mover/editar parede,
  troca de grid, Dungeondraft. Um lugar só, chamado depois dessas ações, com teste.

### Cliente

- **Painel *Tochas*:**
  - escolhe o modelo (10, com ícone desenhado pelo mesmo shader ou miniatura) e a cor (5 bolinhas);
  - o resto como hoje (clique ou arrastar, borracha, desfazer).
- **Arandela:**
  - com ela escolhida, a prévia gruda na parede mais perto (até 0,75 casa do ponteiro);
  - vira para o lado em que está o ponteiro;
  - sem parede perto, a prévia fica vermelha e o clique não põe.
- **Desenho:** passo novo da placa de vídeo para as fontes de luz (instâncias, um shader com os 10 modelos),
  com o kit dos objetos:
  - luz da cena de um lado e sombra do outro;
  - chama animada por pixel, tingida pela cor;
  - brilho em volta da chama.
  - Sem WebGL 2: os 3 desenhos de canvas de hoje, e os novos caem num desenho simples de chama sobre base.
- **Luz:**
  - cada fonte vira uma luz com cor (`MAP_TORCH_COLORS` → RGB), alcance por modelo e jeito de tremer;
  - a chama treme, a lanterna treme pouco e o orbe pulsa devagar.
  - Altura da chama por modelo (para as sombras de objetos e tokens), como o `TORCH_HEIGHT` de hoje.
  - A arandela fica alta (1,6) e a luz sai do lado do `facing`. Nenhuma fonte passa de 1,7 (onde começa a copa das árvores): a sombra da copa apagaria a luz embaixo dela.
- **Tabela por modelo** (aprovada na página de teste [luzes-teste.html](luzes-teste.html), 2026-11-25):

| Modelo | Tamanho (casa) | Alcance (ft) | Altura | Tremor |
|---|---|---|---|---|
| fincada | 0,7 | 40 | 1,2 | chama |
| de ferro | 0,7 | 40 | 1,6 | chama |
| braseiro | 0,8 | 50 | 0,6 | chama |
| arandela | 0,6 | 40 | 1,6 | chama |
| fogueira | 1,0 | 60 | 0,4 | chama forte |
| lanterna | 0,5 | 40 | 1,0 | pouco |
| castiçal com velas | 0,5 | 20 | 0,8 | chama fraca |
| candelabro de pé | 0,8 | 30 | 1,5 | chama fraca |
| lamparina a óleo | 0,55 | 25 | 0,7 | pouco |
| orbe/cristal | 0,6 | 30 | 1,0 | pulso |

### Ordem

1. **Página de teste** `docs/design/luzes-teste.html`:
   - os 10 modelos × 5 cores, de dia e à noite, perto e longe;
   - a arandela numa parede;
   - aprovação do dono antes do app.
2. Dados, servidor e testes (arandela precisa de parede, arandela solta sai, cor e ângulo no arquivo de sessão).
3. Passo de desenho e luz no app, painel.
4. Medir (skill `desempenho`, com as tochas da cena de teste em modelos e cores variados), documentação (CHANGELOG,
   README, SPEC, roteiro em `docs/pendencias.md`).

## Fica para quem constrói

- Os desenhos em si: saem da página de teste aprovada.
- Como gerar o ícone do painel (miniatura renderizada ou desenho simples) e onde cada fonte se encaixa no passo
  (camada) dos objetos.
- O RGB exato de cada cor e os números da tabela, depois da página de teste.
