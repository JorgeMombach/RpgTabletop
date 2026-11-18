# Paredes emendadas, telhado invisível, janelas e texturas novas

Combinado em 2026-11-17, com o dono do projeto, na branch `feat/campanha`, depois da [luz](luz.md). É o primeiro dos três projetos de "construção" do mapa: **1. paredes e portas** (este), 2. relevo (níveis com penhascos, só visual), 3. estruturas (pontes, escadas, pisos), nessa ordem, cada um com o seu desenho. Teste aprovado da emenda: `docs/design/paredes-teste.html`.

## Por quê

Hoje cada parede é um traço solto (`from` → `to`), desenhado no próprio eixo, passando um pouco das pontas, com os blocos recomeçando em cada traço (`client/src/map/wallArt.ts`). Um quadrado vira quatro peças encavaladas; um T e um traço sobreposto ficam um por cima do outro. O mestre quer que paredes que se encostam **se integrem**, como uma construção só. Com a luz nova, a sombra do sol cai também dentro dos cômodos, o que não faz sentido: o mapa é o mundo "fatiado" na altura do telhado. E faltam janelas; e algumas texturas (a rocha principalmente) estão feias.

## Objetivos

1. **Emenda automática.** Paredes que se tocam (ponta com ponta, ponta no meio de outra, cruzamento, sobreposição no mesmo alinhamento) são desenhadas como uma peça só: quina em ângulo, T encaixado, textura contínua de um traço para o seguinte. Vale para os mapas que já existem; nada muda no arquivo de sessão. Aprovado no teste.
2. **Telhado invisível.** Cômodo fechado = laço de paredes **sólidas**, com portas e janelas contando como fechadas. Dentro dele: sem sombra de sol/lua, e de dia a luz um pouco mais baixa ("bem de leve": ambiente + 45% do sol; o teste começou nesse valor e o dono aprovou). À noite não muda nada. Laço com buraco = aberto (a sombra entra).
3. **Janela.** Novo modo *Janela* na ferramenta *Paredes*, traçado como a porta, em cima de uma parede sólida, e emendado nela. Aberta: deixa ver e passar luz de tocha. Com a **persiana fechada** (o mestre alterna, como a porta abre e fecha): corta visão e luz. Não impede passagem (o app é um registro, ADR-06). De dia, com ela aberta, o sol entra e desenha no chão do cômodo um retângulo de luz inclinado pela hora (comprido no entardecer, azulado no luar).
4. **Texturas novas** para os 11 estilos de parede, as portas (e portões) e a janela, escolhidas pelo dono em páginas de teste com 2 ou 3 versões lado a lado, por lotes. Inclui as vazadas (cerca, grade, arame, sebe, muro baixo) e conferir como a luz trata cada uma (sombra curta, tocha passando).

## Não é

- Não muda regra de jogo: emenda, telhado e janela não mudam régua, movimento nem quem passa.
- Não muda a geometria de bloqueio: visão, névoa e luz continuam pela linha do meio de cada parede; a emenda é só desenho.
- Não leva as paredes para a placa de vídeo (fica para a troca de motor do mapa).
- Não faz pisos, telhados desenhados, relevo nem estruturas (projetos seguintes).

## Antigoals

- A emenda mudar o que o mestre traçou: ela é só desenho (as paredes guardadas continuam uma por traço; apagar, trocar desenho, desfazer, porta e borracha funcionam como hoje). A única mudança nas paredes guardadas é o corte ao pôr porta ou janela em cima (abaixo).
- Interior escuro a ponto de atrapalhar a leitura do mapa de dia.
- Janela que vaza o que está do outro lado para jogador sem visão daquilo (segue as mesmas regras da porta aberta).

## Abordagens

- **A. Emendar no desenho que já existe (escolhida).** Uma conta pura no `shared` acha os encontros e monta cadeias; cada cadeia é desenhada como um caminho, com a quina em ângulo e a textura seguindo o comprimento; a mesma conta acha os cômodos para a luz. Mantém o desenho em canvas e os estilos aprovados, e não espera o motor novo.
- B. Paredes na placa de vídeo (renderizador do chão): 11 estilos e portas refeitos em shader; muito mais trabalho, mesma emenda. Faz sentido na troca de motor.
- C. Só cobrir as quinas com uma peça de canto: barato, mas o T, as diagonais e a textura que recomeça continuam, e não dá os cômodos do telhado.

## Como (o que foi decidido)

### Etapas

1. **Emenda e telhado** (com os desenhos de hoje adaptados para desenhar ao longo da cadeia) e **janela** (com um desenho provisório simples).
2. **Texturas**, em lotes com página de teste e aprovação do dono a cada lote: (a) sólidas: rocha (a mais urgente), pedra lavrada, tijolo, madeira; (b) paliçada e muralha; (c) vazadas e portões: cerca, grade, arame, sebe, muro baixo; (d) portas (todos os estados: aberta, trancada e secreta para o mestre) e janela (aberta e fechada).

### Emenda (do teste aprovado)

- **Conta pura em `shared`** (testada em `server/test`): corta as paredes nos encontros (ponta no meio de outra, cruzamento, sobreposição no mesmo alinhamento) e junta trechos repetidos; monta o grafo de nós (pontas que coincidem até 0,001 casa).
- **Quem continua em quem:** num nó com duas paredes do mesmo desenho e espessura, elas continuam (quina em ângulo, limite do bico a ~3× a meia espessura). Num nó com três ou mais, continuam os pares mais alinhados (diferença até ~20° de reto) de mesmo desenho e espessura; as outras terminam no nó, por baixo da que passa. Desenho ou espessura diferentes: só se encostam. Ponta solta: passa um pouco da ponta, arredondada, como hoje.
- **Desenho da cadeia:** contorno com quina em ângulo; primeiro a sombra de todas, depois o contorno de tinta de todas, depois o corpo de todas (as emendas somem). A textura de cada trecho é recortada pelo quadrilátero do trecho e posta pelo comprimento acumulado da cadeia, com os blocos sorteados pela posição no comprimento (o mesmo bloco dos dois lados da quina). Rocha e sebe, que não têm fiadas, são desenhadas como peças espalhadas pelo caminho no mapa (a quina sai natural).
- **Porta e janela** quebram a cadeia: as paredes terminam no batente, que é desenhado com a porta/janela.
- **Cliques continuam por parede:** cada parede guardada mantém a sua área de clique (selecionar porta, trocar desenho, apagar); só o desenho visível é por cadeia. A imagem guardada passa a ser por cadeia (chave: pontos, desenho, espessura).

### Telhado invisível

- **Cômodos:** faces do desenho das paredes sólidas, portas e janelas (vazadas não fecham cômodo: um curral com cerca não tem telhado). Conta pura em `shared`, com teste.
- **Na luz** (`client/src/map/ground/lightPass.ts`): os cômodos viram uma máscara de "telhado"; dentro dela não entra sombra de sol/lua e a luz é ambiente + `INDOOR_SUN` (0,45) × sol. Tochas iguais dentro e fora.
- **Jogador:** calcula os cômodos com as paredes que recebeu (`server/src/view.ts` só manda as já vistas, sem porta secreta). Um cômodo ainda não todo visto fica sem telhado para ele; a parte não vista está sob a névoa. *(Chamada minha: mandar os cômodos prontos do servidor entregaria a forma de paredes não vistas.)*

### Porta e janela em cima de parede

- **Traçar porta ou janela por cima de uma parede corta a parede** naquele trecho (o servidor divide a parede em até duas, uma de cada lado do vão, e a porta/janela ocupa o vão). Hoje a porta traçada por cima deixa a parede embaixo, que continua bloqueando com a porta aberta; o corte conserta isso também. A emenda junta tudo de novo no desenho. *(Chamada minha.)*
- Vale para paredes no mesmo alinhamento que a porta/janela (folga de ~0,05 casa), uma ou várias; as partes que passam do vão ficam como paredes, com o mesmo desenho e espessura. Fora de parede, a porta/janela fica solta, como a porta hoje.
- **Desfazer** volta tudo junto (as paredes cortadas e a porta/janela) num passo só.
- Mexer depois na parede ao lado (apagar, trocar o desenho) não mexe na porta/janela. *(Chamada minha: sem cascata.)*

### Janela

- `Wall.window?: { closed?: boolean }`, como `door`; ação de traçar janela e de abrir/fechar a persiana (como a porta), só o mestre; validação no servidor; no arquivo de sessão (`session-file.ts` e `save-guard.test.ts`).
- **Visão e névoa** (`shared/src/fog.ts`, o mesmo lugar que trata porta aberta e vazadas): janela aberta não bloqueia; fechada bloqueia. **Luz** (`lightBlockers`): igual.
- **Sol pela janela:** com a janela aberta e o sol (ou a lua) do lado de fora dela, um quadrilátero da janela projetado para dentro na direção do sol, do comprimento da sombra da parede, recortado pelo cômodo, recebe a luz de fora em vez da de dentro.
- **Revelar *Cômodo* da névoa** (`roomCells`): janela, aberta ou fechada, segura o preenchimento como a parede (o cômodo é o mesmo do telhado). *(Chamada minha.)*
- A moldura acompanha o desenho das paredes ao lado.

### Textura (direção)

Cada lote para na página de teste até o dono escolher; o lote seguinte só começa depois. Sem aprovação, a etapa 2 não segue.

Sem referências: vai no teste. Ponto de partida do teste aprovado: contorno de tinta escuro, topo com luz de um lado, grão por cima. Rocha: blocos grandes e irregulares, largura variando, rachaduras, topo achatado pegando luz (não "colar de pedrinhas").

## Fica para o construtor

- Nomes, a ação e o atalho do modo *Janela*; o ícone (Tabler) e os textos (pt-BR, en, es).
- Se a etapa 1 adapta todos os 11 desenhos para a cadeia ou adapta os de fiada e deixa os outros por segmento até o lote deles.
- Como a máscara de telhado entra no passo da luz (textura ou estêncil).
- Desempenho: a conta da emenda e dos cômodos é refeita só quando as paredes mudam.
