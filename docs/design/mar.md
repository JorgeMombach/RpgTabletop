# Mar (bloco 5 da lista de 2026-11-24)

Combinado em 2026-11-25, com o dono do projeto, na branch `feat/objetos`. É o quinto de seis blocos antes de lançar a versão. Os anteriores foram os [ajustes rápidos](ajustes-rapidos.md), o [desempenho](desempenho.md), as [estruturas](estruturas-ajustes.md) e a [moldura](moldura.md). Teste aprovado em [mar-teste.html](mar-teste.html), nas cenas praia, porto, alto-mar e penhasco.

## Por quê

O pedido do dono: "ondas mais fortes, espuma na borda, areia mais suave (bordas); o mar não pode ter bordas em todos os 4 pontos, não faz sentido se a cena não cobrir todo o espaço do mar; mais ideias para o mar". As cenas que ele quer cobrir são praia, porto, alto-mar e penhasco: "todos esses cenários são válidos".

Hoje toda água pintada é lago ou rio. O barranco nasce em volta inteira dela, e um mar pintado vira um lago gigante.

## O que é

Um terreno novo, **Mar**, no painel *Terreno* ao lado da água e da água funda. Lago e rio continuam como estão, e os dois convivem com o mar na mesma cena.

- **Borda aberta:** o mar só tem margem onde encosta em terra pintada. Onde a pintura acaba sem nada pintado do lado, ele não tem barranco nem espuma: segue mais 2 casas e some aos poucos. Com a moldura do bloco 4, basta pintar o mar além da moldura.
- **Profundidade:** turquesa no raso, azul no meio e azul escuro longe, pela distância até a costa (a mesma do campo da água). Sem costa por perto, é azul de alto-mar.
- **Ondas:**
  - longe da costa, uma soma de ondas em várias direções e tamanhos, tortas por ruído, sem padrão repetido, com brilho do sol ou da lua e carneirinhos de vez em quando;
  - até 5 casas da costa, as frentes ficam paralelas a ela, encurtam e quebram.
- **Praia** (o mar encostando em areia ou terra batida):
  - a onda sobe e desce na areia, como uma lâmina fina com espuma na ponta;
  - acima dela, areia molhada mais escura e com brilho;
  - espuma rendada no raso;
  - margem rasa no lugar do barranco do lago.
- **Costa de pedra ou penhasco** (o mar encostando em pedra, ou com relevo mais alto do lado): arrebentação forte na base, com espuma que pulsa, e sombra na água junto à base.
- **Pedras e cais:** a espuma em volta dos pedregulhos e das estacas do píer, que já existe, vale também no mar, mais forte.
- **Noite:** a luz da cena escurece, e o brilho vira o da lua.
- **Reduzir efeitos:** o mar fica parado, como a água de hoje.

### Não metas

- Barco: o da página só ilustra.
- Maré que muda a linha da costa com o tempo.
- Som do mar: o som ambiente continua sendo do painel *Som*.

## Caminhos considerados

- **Terreno próprio "Mar"** (escolhido pelo dono). É o mesmo gesto de pintar e não muda a água de hoje.
- **Opção "a água desta cena é mar".** Descartado: não dá para ter lago e mar juntos.
- **Marcar cada corpo de água com um clique.** Descartado: mais trabalho de uso e de código, sem ganho.

Como fica no app *(chamadas minhas)*:
- **Terreno:** `sea` no fim de `TERRAINS`, no 12º e último canal dos pesos.
- **Campo da água** (no Worker):
  - o mar conta como água, e a parte de mar de cada ponto vai no canal A da textura do campo, que ficou livre no bloco 3;
  - **borda aberta:** um ponto sem nenhum terreno pintado, a até 2 casas do mar, conta como água no campo, e o mar some aos poucos nessas 2 casas;
  - o tipo de costa sai do terreno do lado de terra, lido no próprio Worker: areia e terra batida dão praia, pedra (ou relevo mais alto) dá costa de pedra, e o resto dá margem rasa. Ele vai num campo pequeno junto.
- **Shader:** o mar entra no passo da água que já existe (o "assar" e o desenho de cada quadro), com o código da página. Lago e rio passam pelo caminho de hoje, sem mudança.

## Fica para o construtor

- **Desempenho:** medir a primeira água e "água 50×" com mar na cena de teste. O mar não pode pesar mais que o lago no mesmo tamanho.
- **O "assar" com mar:** cabe no tempo de hoje.
