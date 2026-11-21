# Luz (renderizador do chão, passo 2)

Combinado em 2026-11-17, em brainstorm com o dono do projeto, na branch `feat/campanha`. Segundo passo do [renderizador do chão](renderizador-chao.md), depois do terreno na placa de vídeo.

Teste que decidiu o visual: [`luz-teste.html`](luz-teste.html), cópia da página aprovada (*Luz (shader): teste*). É a referência do shader (luz, sombras, chama, faíscas, selo do token), não código para colar: as paredes, as tochas e o token estão fixos na página, e ela usa `grass_01`/`stone_01` de `client/public/terreno/` e o desenho de árvore do app (`propart.js`, que não foi copiado).

## Por quê

Imersão e beleza: agora que o mapa tem a placa de vídeo, a luz pode ficar no nível de jogo. O dono aprovou no teste a iluminação inteira ("tanto de dia, como de noite, como entardecer, como luar, tá perfeito") e pediu uma tocha de verdade, com fogo que tremula e muda de cor, no tamanho das tochas de hoje, e também no token que carrega tocha.

## Hoje

- **Luz da cena** (`WeatherOverlay.tsx`): uma película de cor (`LIGHT_STYLE`: entardecer, noite, luar; dia sem película) multiplicada sobre o mapa inteiro, com vinheta; escurece tudo junto (chão, objetos, tokens, efeitos).
- **Tochas** (`Torch.tsx`): fixas (`MapTorch`, 3 desenhos: fincada, de ferro, braseiro, em `MapTorches.tsx`) e a do token (`c.torch`, selo `TorchBadge` no canto do token). Cada uma abre um furo redondo na película (máscara CSS) e soma um brilho quente que tremula (`TorchGlowLayer`). O furo **atravessa as paredes**.
- **Visão dos personagens** (névoa, `shared/src/fog.ts`): já usa as paredes; tocha dá 20 ft de luz forte e mais 20 de meia-luz (`TORCH_BRIGHT_FEET`, `TORCH_FEET`). A regra da visão não muda aqui.

## O que muda

- **Mapa de luz na placa de vídeo, aplicado ao mapa inteiro**: o renderizador do chão calcula quanta luz chega em cada ponto e o resultado escurece e colore tudo (chão, objetos, tokens, efeitos), no lugar da película de hoje. O que brilha sozinho (chama, faíscas, brilho em volta da chama) vai por cima, sem escurecer.
- **Dia, entardecer, noite e luar** como no teste: cor ambiente de cada um, mais o sol (dia: alto, do alto à esquerda, sombras curtas; entardecer: baixo e alaranjado, da esquerda, sombras compridas) ou a lua (luar: azulada fraca, sombras leves); à noite, sem sol nem lua. Trocar a luz da cena muda devagar (meio segundo), como no teste.
- **Sombra das paredes**: o sol e a lua fazem as paredes jogarem sombra para o lado oposto (a parede tem altura); as tochas iluminam até as paredes e param nelas (a luz passa pelos vãos e pelas portas abertas), com a sombra macia (a chama tem tamanho).
- **Tochas com luz quente que tremula**: a força e a cor da luz no chão oscilam com a chama (entre laranja e amarelo), com o alcance de hoje (20 ft forte e mais 20 de meia-luz).
- **A chama nova**, nas tochas fixas e no token: chama em camadas (por fora laranja-avermelhado, a cor do instante, miolo amarelo-claro), base redonda afinando até a ponta, dançando de lado a lado e mudando de altura, uma segunda língua menor ao lado, cor oscilando entre laranja e amarelo, faíscas subindo. Tocha fixa com o tamanho de hoje (~0,75 casa); no token, dentro do selo no canto de baixo à direita.
- **Relevo pegando luz de lado**: o mapa de luz já recebe a altura do chão (hoje só a água tem altura); quando o relevo chegar, os morros pegam o sol de lado sem refazer a luz.

## Fora do escopo

- Sombra de tokens, árvores e objetos (luz por objeto): fica para a troca de motor do mapa.
- Sol andando com a *Hora do jogo* (direção e cor seguindo o relógio): depois.
- Mudar a regra da visão dos personagens, o alcance das tochas ou o que o jogador vê pela névoa (ADR-06: só visual).
- Luzes novas (lanterna, magia de luz, fogueira com outra cor): depois.

## Para não fazer (falharia mesmo funcionando)

- Luz que pisca a cada quadro ou salta (a tremulação é suave, como no teste).
- A mesa engasgando com muitas paredes e tochas: o máximo da cena (600 paredes, 60 tochas fixas, mais as dos tokens) tem que continuar fluido.
- Token ou objeto "aceso" no escuro (o mapa de luz vale para tudo, como a película de hoje).
- Tocha grande, ocupando a casa inteira.

## Restrições

- Um contexto WebGL só (o do renderizador do chão); a luz é mais um passo dele.
- Paredes que bloqueiam a luz = as que bloqueiam a visão: parede e porta fechada (inclusive secreta); as vazadas (cerca, grade, arame, sebe, muro baixo — `SEE_THROUGH_WALLS`) e as portas abertas deixam a luz passar.
- O jogador calcula a luz com as paredes que recebe (sem as secretas e sem as que a névoa cobre).
- *Reduzir efeitos*: luz parada (sem tremulação nem faíscas), sombras e cores iguais. Aparelho lento (`FrameWatch`): o mesmo.
- Sem WebGL 2 ou com o contexto perdido: a película e o brilho de hoje (`WeatherOverlay`, `TorchGlowLayer`), como reserva.
- Sem `any` nem cast forçado; comentários e textos em português.

## Abordagens

- **A. Mapa de luz no renderizador do chão, aplicado ao mapa inteiro (escolhida).** Coerente (nada aceso no escuro), sombras de verdade, prepara o relevo; um contexto só.
- B. Luz só no chão, mantendo a película por cima: tokens e objetos ficariam iguais à noite enquanto o chão escurece. Descartada.
- C. Luz por objeto (sombra de cada token e árvore): precisa do motor novo do mapa. Depois.

## Decidido

- **Mestre com brilho mínimo (decisão do dono)**: o mestre vê a mesma luz, sombras e tochas, mas nunca abaixo de uma claridade em que dá para trabalhar (um luar fraco); os jogadores veem a escuridão de verdade. Para ver exatamente como um jogador, o mestre usa o *Ver como jogador*, que já existe (com ele, sem o brilho mínimo).
- **Onde a luz fica nas camadas do mapa**: a camada da luz (que multiplica) vai no meio do mapa, por cima do chão, efeitos, objetos, tochas, névoa, tokens e copas, e **abaixo** da interface desenhada no mapa (régua, pings, áreas de magia, "?" de visto por último, borracha, prévias das ferramentas): a interface continua legível à noite. *(Chamada minha.)*
- **Chamas e brilho**: os das tochas fixas ficam onde o brilho delas fica hoje (`TorchGlowLayer`: abaixo da névoa e dos tokens), então a névoa esconde a tocha de uma área que não está à vista e um token em cima da tocha a cobre; a chama do selo do token é desenhada com o token (no Konva, no estilo novo da chama). *(Chamada minha.)*
- **Clima**: chuva, neve e o resto que não brilha sozinho ganham a cor da luz da cena (sem sombra de parede); o que brilha (vagalumes, brasas, luzes mágicas) fica como hoje. A vinheta das bordas continua. *(Chamada minha.)*
- **Saídas do mesmo contexto, em sequência**: o renderizador desenha o chão e copia para a camada do chão; depois desenha o mapa de luz e copia para a camada da luz; e as chamas e o brilho das tochas fixas para a camada delas. *(Chamada minha.)*
- **Sombras guardadas**: o recorte de luz de cada tocha e a sombra do sol/lua são refeitos só quando paredes, portas, tochas ou a luz da cena mudam (ou um token com tocha anda); a cada quadro só a tremulação e a chama. *(Chamada minha: com 600 paredes e dezenas de tochas, testar cada parede por pixel a cada quadro, como no teste, não cabe.)*
- **Corpo das tochas fixas**: os 3 desenhos de hoje (fincada, de ferro, braseiro) continuam no Konva, sem a chama de hoje; a chama nova sai da placa de vídeo, no lugar da chama de cada desenho. No selo do token, o mesmo: o círculo e o aro no Konva, a chama nova da placa. Arrastando a tocha, a chama acompanha. *(Chamada minha.)*
- **Paredes vazadas e o sol**: as vazadas não seguram a luz das tochas e fazem sombra de sol curta (um terço da sombra de uma parede cheia). *(Chamada minha.)*
- **Porta secreta para o jogador**: o jogador não recebe a porta secreta, então a luz da tocha dele passa por ela. Com a névoa ligada, o outro lado está coberto e nada aparece; sem névoa, a luz atravessa (como hoje a luz atravessa toda parede). *(Chamada minha: mandar a forma das paredes secretas sem a porta seria mudar o contrato e a regra da névoa; fica registrado como limite.)*

## Fica com quem implementa

- Como guardar as sombras (recorte de cada tocha como polígono desenhado numa textura, ou mapa de sombra por luz) e a resolução delas.
- Cores, alcance e força exatos de cada luz da cena e das tochas: partir dos números do teste e acertar no navegador.
- Onde exatamente fica a chama em cada um dos 3 desenhos de tocha fixa.
