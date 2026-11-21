# Pisos

Combinado em 2026-11-18, com o dono do projeto, na branch `feat/campanha`. Primeira parte do terceiro projeto de "construção" do mapa (1. [paredes](paredes.md), feito; 2. [relevo](relevo.md), feito; **3. estruturas**: pisos, depois pontes e píer, depois escadas). As pontes e as escadas terão desenho próprio quando chegar a vez.

## Por quê

O mestre monta tavernas, castelos, masmorras e vilas na beira do rio. Hoje o chão de dentro de um cômodo é o terreno pintado (borda de aquarela, irregular) ou a imagem do mapa: não há assoalho, laje nem ladrilho de verdade. O dono quer **o máximo de qualidade**, no padrão de nitidez combinado no relevo (Full HD em qualquer zoom, desenhado pela placa de vídeo), sem economizar e sem deixar para refazer depois.

## O que é

Uma ferramenta **Piso** no painel *Construir*. O mestre escolhe o material (e o sentido das tábuas) e pinta o piso de três jeitos: **Cômodo** (um clique dentro de um lugar fechado por paredes preenche até elas), **Retângulo** e **Pincel** (círculo de borda dura), mais **Borracha**. O piso é desenhado por pixel na placa de vídeo, com o veio, as juntas e o relevo fino pegando a luz da cena.

### Metas

- Seis materiais: **tábua corrida**, **tábua larga gasta**, **laje de pedra**, **ladrilho**, **mosaico** e **tapete** (com barra decorada na borda).
- Borda **dura e reta** (não aquarelada), lisa também na diagonal, sem escadinha.
- Padrão **alinhado ao grid** (as tábuas e as lajes seguem as linhas das casas); tábuas na **horizontal ou na vertical**, à escolha.
- Detalhe de produto: veio, juntas, pregos, cor variando por peça, **desgaste** onde se pisa (longe da borda) e **sujeira nos cantos** (perto da borda).
- Nitidez em qualquer zoom; de longe, o detalhe fino vira textura sem chiado (como o chão da etapa 3).
- Um piso por ponto: pintar outro material por cima troca; a borracha tira.
- *Desfazer* (Ctrl+Z), *Apagar tudo*, limite por cena, arquivo de sessão, cada cena com o seu, *Limpar campo* apaga.
- Todos veem o piso (por baixo da névoa, como o terreno).

### Não metas

- Não muda régua, visão, movimento nem névoa: é só visual (ADR-06).
- Não faz pontes, píer nem escadas (projetos seguintes), nem telhado desenhado.
- Não liga o piso às paredes: se a parede muda, o piso fica onde foi pintado.

### Anti-metas (seria um fracasso mesmo funcionando)

- Cara de "Paint" ou de textura esticada de baixa resolução.
- Borda aquarelada ou serrilhada.
- Padrão que não respeita o grid (tábua torta, laje cortada no meio da casa sem motivo).

## Caminhos considerados

- **A. Grade fina, como o terreno e o relevo (escolhido).** Cada ponto da grade fina (4 por casa), nos pedaços de 8 × 8 casas, guarda um byte com o material e o sentido. *Cômodo*, *Retângulo* e *Pincel* são contas que marcam pontos. Na placa de vídeo, a borda é traçada entre os pontos pela cobertura interpolada: sai reta na diagonal, sem escadinha. Reaproveita o desfazer, a borracha, o arquivo de sessão, o limite e o envio só dos pedaços que mudaram. Custo: a borda tem precisão de 1/4 de casa (exata nos pontos, reta entre eles); numa parede diagonal a própria parede cobre a emenda.
- **B. Polígonos** (cada piso uma área exata). Borda perfeita, mas o pincel vira pilha de formas, apagar exige recortar polígonos e o desfazer e o arquivo ficam complexos. Infraestrutura toda nova.
- **C. Piso ligado ao cômodo das paredes.** Não serve para piso fora de cômodo (píer, pátio, retângulo solto) e perde o dono quando a parede some.

O dono escolheu o **A**: a mesma qualidade visual do B (pela borda traçada na placa), sem uma segunda forma de guardar o mapa que teria de ser refeita para o píer e as pontes.

## Como fica

### Dados

- `floors: FloorChunks` por cena: pedaços `"cx,cy"` com 1024 bytes (32 × 32 pontos finos) em base64, como o relevo.
- O byte de um ponto: material nos 4 bits de baixo (0 = sem piso, 1 a 6 = os materiais na ordem acima; até 15 para os que vierem) e o sentido no bit de valor 16 (0 = na horizontal, 1 = na vertical). Os bits de valor 32, 64 e 128 ficam zerados (reservados) e o servidor recusa byte com eles ligados. O sentido pode vir ligado em qualquer material (é guardado como pintado) e só as tábuas o usam *(chamada minha)*. Ponto sem piso tem o byte 0 inteiro.
- Pedaço todo sem piso some (não ocupa espaço).
- Limite por cena: o mesmo do terreno (`LIMITS.terrainChunks`).

### Ações (servidor valida tudo, só o mestre)

- `floor:paint`: material (1 a 6) ou `"erase"`, sentido (`"horizontal" | "vertical"`) e a forma:
  - `{ kind: "brush", radius, points }` (raio e pontos como o pincel do terreno);
  - `{ kind: "rect", from, to }` (cantos em casas; os pontos finos de dentro). Na interface, os cantos **encaixam nas linhas das casas** (a borda cai na linha, como a laje pede); com **Shift**, encaixam na meia casa *(chamada minha)*. O servidor aceita qualquer múltiplo de 1/4 de casa;
  - `{ kind: "room", at }` (um ponto em casas): o servidor acha o lugar fechado que contém o ponto e preenche os pontos de dentro; fora de lugar fechado, recusa com uma mensagem ("Clique dentro de um lugar fechado por paredes.").
- `floor:restore` (o desfazer, como `relief:restore`) e `floor:clear` (*Apagar tudo*).
- Recusas em português, como modelo traduzido (`serverText.ts`).
- Envio: evento próprio com só os pedaços que mudaram (como o relevo), para todos.

### "Lugar fechado" para o modo Cômodo *(chamada minha)*

- Qualquer contorno fechado de paredes, portas e janelas, **de qualquer desenho**: paliçada, muralha e também a cerca vazada fecham um pátio para o piso (diferente do telhado invisível da luz, que deixa esses ao ar livre). Usa as faces do grafo das paredes que já existe (`wallChains`/`wallRooms` em `shared/src/wallJoin.ts`), com uma opção para contar todos os desenhos.
- O ponto clicado escolhe a menor face que o contém. **Lugares fechados inteiros dentro dela** (um cômodo solto no meio de um salão, sem encostar nas paredes de fora) **ficam de fora** do preenchimento: são outro lugar. Paredes soltas no meio (que não fecham nada) não abrem buraco: a parede cobre o piso embaixo dela.
- O piso vai até a linha do meio da parede (a parede cobre a borda).
- A mesma conta roda no servidor (o que vale) e no client (o contorno sob o mouse antes de clicar), em `shared`.

### Desenho (placa de vídeo)

- Um passo novo no renderizador do chão, **por cima do terreno e da água e por baixo da camada do relevo** *(chamada minha)*: assim o piso segue o relevo de graça (a luz da encosta escurece ou clareia o piso como o chão, e a face do penhasco cobre o piso que passar dela). Por baixo das paredes, da poeira e dos tokens. Piso sobre a água pinta como um deck chapado (as estacas do píer vêm no projeto seguinte). A camada é guardada numa textura do tamanho da tela e refeita só quando a visão, o piso ou a luz da cena mudam (como o terreno).
- Os bytes sobem numa textura de inteiros por ponto fino (só a área com piso, com uma borda vazia, como os pesos do terreno).
- **Um programa por material**, compilados em paralelo (`ProgramCache`), cada um desenhando os pontos do seu material.
- **Borda:** a cobertura de **"tem piso"** (qualquer material) é interpolada entre os 4 pontos vizinhos e cortada em 1/2, com anti-serrilhado pelo tamanho do pixel: reta e lisa na diagonal. **Entre dois materiais encostados** a cobertura é cheia (sem fresta): o material de cada pixel sai da mesma interpolação por material, e a troca de um para o outro acontece numa linha fina e lisa *(chamada minha)*.
- **Perto da borda / longe dela** (distância estimada por amostras em volta): a **sujeira nos cantos** e o **desgaste no meio** usam a borda do **piso inteiro** (a laje não fica suja em volta do tapete); a **barra do tapete** usa a borda **do próprio tapete** *(chamada minha)*.
- **Padrão no grid** (da malha quadrada): tábuas com largura de 1/5 de casa (corrida) ou 1/3 (larga), pontas desencontradas, comprimento variando; lajes retangulares alinhadas às casas; ladrilho em quadrados de 1/2 casa; mosaico em peças miúdas com desenho; tapete com trama e barra.
- **Luz:** relativa, como o chão (`faceLight`): o relevo fino (juntas, frestas entre tábuas, lajes um pouco inclinadas) pega a luz da cena; a luz absoluta, a sombra e as tochas vêm do mapa de luz.
- **De longe:** cada detalhe fino vira a média abaixo de ~2 pixels (como o chão da etapa 3).
- **Sorteio** pelos bits do número (o mesmo do chão), sem degenerar longe da origem.

### Interface

- Ferramenta **Piso** no painel *Construir* (ícone Tabler e atalho escolhidos na implementação), com:
  - os seis materiais em botões com amostra (como o *Terreno*);
  - *Sentido das tábuas* (horizontal/vertical), só para as tábuas;
  - modo *Cômodo / Retângulo / Pincel / Borracha*;
  - tamanho do pincel (no modo Pincel e na Borracha);
  - *Desfazer* e *Apagar tudo* (com confirmação);
  - uma dica por modo.
- Prévia: no *Pincel*, a passada aparece na hora (como o relevo); no *Retângulo*, o contorno enquanto arrasta; no *Cômodo*, o contorno do lugar sob o mouse antes de clicar.
- Textos novos no `pt-BR.ts` e traduzidos em `en.ts` e `es.ts`.

### Grid hexagonal *(chamada minha)*

O piso funciona no hex também, mas o padrão fica alinhado à malha **quadrada** do mapa (as tábuas e as lajes não viram hexágono): taverna e castelo são quadrados. Trocar o grid **apaga o piso**, como já apaga as paredes (o piso acompanha os cômodos), e a confirmação da troca passa a citar o piso.

### Sem WebGL 2 *(chamada minha)*

Desenho simples no processador: cada material numa cor chapada com a borda reta (a mesma regra da cobertura), para o mestre não perder o piso. Sem detalhe.

### Página de teste

Antes da implementação, uma página de teste com os seis materiais (em cômodos com paredes, uma diagonal, um retângulo solto e um tapete no meio de uma laje), luz de dia, entardecer e luar, e zoom até bem de perto. O dono aprova o visual antes de entrar no app.

## Fica para o construtor

- Nomes dos campos, ações, chaves de texto, ícone e atalho.
- Formato exato da textura dos bytes e do cache da camada.
- Valores finos de cor, ruído e proporções, desde que fiquem iguais à página de teste aprovada.
- Como estimar a distância até a borda (quantas amostras, que raio), desde que o tapete tenha a barra e os cantos tenham a sujeira.
