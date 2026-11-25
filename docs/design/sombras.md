# Sombra por objeto (tochas, tokens, objeto sobre objeto)

Combinado em 2026-11-21, com o dono do projeto, na branch `feat/objetos`. É a **etapa 2 de 4** da troca de motor do mapa (1. [objetos](objetos.md), feita; **2. sombra por objeto**; 3. névoa de guerra; 4. efeitos e clima), que sai inteira numa versão só. Teste aprovado em [sombras-teste.html](sombras-teste.html) (código da página em [sombras-teste.ts](sombras-teste.ts)).

## Por quê

Depois da etapa 1, sol e lua fazem sombra de paredes, relevo, pontes, escadas e objetos. Faltava:

- **A luz das tochas atravessa tudo** que não é parede: uma tocha no meio da floresta ilumina como se as árvores fossem transparentes; tokens e objetos não fazem sombra dela.
- **Tokens não fazem sombra** do sol nem da lua (só uma sombrinha fixa desenhada na arte do token).
- **Objeto sobre objeto:** a máscara de sombra não sabe a altura de quem recebe; a sombra de um barril pode escurecer uma copa alta por cima dele.

O dono quer as três ("é isso aí"), com a sombra da tocha girando e esticando conforme o token anda.

## O que é

Um **mapa de alturas** na placa de vídeo, refeito a cada desenho da luz: a altura de tudo o que está na tela (objetos pela forma guardada no atlas, tokens como um cilindro da altura do tamanho deles). Para cada ponto, a sombra do sol, da lua e de cada tocha anda do ponto até a luz e vê se algo mais alto que o raio está no caminho.

### Metas

- Tochas (fixas e dos tokens) fazem sombra de objetos e tokens, longa quando a tocha é baixa (fogueira), curta ou nenhuma quando a tocha passa por cima (tocha alta sobre um caixote baixo); a sombra gira e estica conforme a tocha ou o token anda.
- **O token não faz sombra da própria tocha** (a luz sai do centro dele, acima da cabeça, e o portador é ignorado na conta), mas faz sombra do que está do lado.
- Tokens fazem sombra do sol e da lua (longa no entardecer).
- A sombra respeita a altura de quem recebe: a copa alta não escurece pela sombra do barril; o topo do objeto recebe a luz da tocha se nada mais alto estiver no caminho.
- A força da tocha segue a luz da cena, como já é: quase nada de dia (0,12), média no entardecer (0,55), cheia no luar e à noite. De dia, sem leque de sombra de tocha (ajuste pedido pelo dono no teste).
- Borda macia, sem degraus (os passos começam num ponto um pouco diferente em cada pixel).

### Não metas

- Paredes e relevo continuam como estão (recorte das tochas pelas paredes, sombra do sol das paredes, máscara do relevo).
- Névoa, efeitos e clima: etapas 3 e 4.
- O desenho do token não muda (continua no Konva); só a sombrinha fixa da arte sai quando a sombra nova está valendo.
- Token voando (elevação): faz sombra como se estivesse no chão *(chamada minha: o mapa de alturas guarda só o topo; a sombra deslocada pela altura do voo fica para depois)*.
- Sombra do objeto no patamar do relevo descendo o penhasco: continua a da etapa 1 (o mapa de alturas não soma o relevo).

### Anti-metas

- Leque de sombra de tocha de dia.
- Anel escuro em volta do token que carrega tocha.
- Sombra em degraus ou piscando quando o token anda.
- O mapa engasgando com tokens andando à noite na floresta.

## Caminhos considerados

- **A. Recorte geométrico, como as paredes:** objetos e tokens viram contornos no recorte da tocha. Descartado: tudo vira parede de altura infinita (barril faz sombra até o fim do alcance), a copa tapa a tocha embaixo dela, e o objeto sobre objeto continua errado.
- **B. Mapa de alturas na placa de vídeo.** **Escolhido pelo dono:** resolve as três frentes com uma conta só, com a altura de verdade.

## Como fica

- **Mapa de alturas** (`client/src/map/ground/heightPass.ts` *(chamada minha)*): textura RGBA8 na meia resolução da luz, altura/4 no canal R, pela maior (`MAX`). Entram:
  - objetos: o mesmo retângulo instanciado do desenho, lendo a altura do atlas (canal G) e só dentro da silhueta;
  - copas (`above`: árvore, pinheiro, palmeira) *(achado na revisão final)*: além do topo, o mapa guarda onde a copa começa, 1,7 casa (× o tamanho, se maior que 1; `CANOPY_BOTTOM`), acima da tocha de um token médio (1,5) e das fixas. Só o tronco vai até o chão. A tocha abaixo da copa passa por baixo dela e ilumina o chão em volta e embaixo da copa (o ponto embaixo dela recebe como chão). Sem isso, a copa virava coluna maciça e apagava a tocha de quem estava embaixo da árvore. A sombra do sol e da lua continua pelo topo;
  - tokens: um disco do raio do token, altura pelo tamanho *(chamada minha: miúdo 0,5; pequeno 0,9; médio 1,2; grande 2; enorme 3; imenso 4 casas)*.
  - Feito a cada desenho da luz (tokens andam); só o que está na tela e na faixa de sombra em volta.
- **Sol e lua** (passo da luz, máscara de sombra): a sombra de objetos e tokens passa a sair do mapa de alturas (32 passos até `2,6 × shadowCells`, raio subindo `1/shadowCells` por casa), na mesma máscara das paredes e do relevo (pela maior). A sombra por silhueta empurrada da etapa 1 (`PROP_SHADOW_FRAGMENT`) sai.
- **Tochas** (passo da luz, `TORCH_FRAGMENT`): cada pixel do recorte de cada tocha anda até a tocha no mapa de alturas (32 passos, raio indo da altura do ponto até a da tocha) e apaga a luz onde algo mais alto está no caminho. Altura da tocha *(chamada minha)*: fincada 1,2; de ferro (parede) 1,6; braseiro 0,6; do token = altura do token + 0,3, no centro dele, ignorando o próprio token (raio do token). A conta é a da página aprovada.
- **Tokens:** com a sombra nova valendo (chão na placa de vídeo), a sombrinha fixa da arte do token (`tokenArt.ts`) não é desenhada.
- **Desempenho:** a conta das tochas é por pixel dentro do alcance de cada uma, na meia resolução. As 4 origens macias de hoje ficam (a borda macia na parede vem delas), cada uma com 16 passos no mapa de alturas (64 leituras por pixel, perto das 32 × 2 da página) *(chamada minha)*. Medir no teste do dono (tokens andando à noite na floresta, 10 tochas).
- **Sem WebGL 2:** nada muda (a película e o brilho de antes).
- **Mestre e jogador:** o mapa de alturas usa só o que cada um recebe (o servidor já filtra pela névoa).

## Página de teste

[sombras-teste.html](sombras-teste.html): floresta, clareira com fogueira, depósito com tocha alta e três tokens andando (um com tocha); dia, entardecer, luar e noite; *Novas* e *Hoje*. Aprovado em 2026-11-21, depois do ajuste da força da tocha pela hora ("de dia tá com muita sombra").

## Fica para o construtor

- Onde exatamente o mapa de alturas é desenhado na ordem do renderizador (antes do passo da luz).
- Como as alturas dos tokens chegam ao renderizador (a lista de tokens com posição, tamanho e quem carrega tocha).
- A altura de cada desenho de tocha fixa, se os valores acima não ficarem bons no app.
- Medir antes de lançar (roteiro em `docs/pendencias.md`).
