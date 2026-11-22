# Névoa de guerra na placa de vídeo

Combinado em 2026-11-22, com o dono do projeto, na branch `feat/objetos`. É a **etapa 3 de 4** da troca de motor do mapa (1. [objetos](objetos.md), feita; 2. [sombra por objeto](sombras.md), feita; **3. névoa de guerra**; 4. efeitos e clima), que sai inteira numa versão só. Teste aprovado em [nevoa-teste.html](nevoa-teste.html) (código da página em [nevoa-teste.ts](nevoa-teste.ts)).

## Por quê

O mapa inteiro está indo para o padrão de nitidez do chão (Full HD, detalhe por pixel na placa de vídeo). A névoa de hoje (`Fog.tsx`, `fogRender.ts`) destoa:

- **A borda é mole e em degraus de casa:** o furo é uma imagem montada no processador, com no máximo 5 px por casa, borrada; rente a uma parede, a névoa vaza parede adentro.
- **A fumaça repete:** dois ladrilhos de 256 px no Konva, a 20 quadros por segundo.
- **Pesa:** a imagem do furo é refeita inteira cada vez que a visão muda; em mapa grande, trava.

## O que é

A névoa desenhada na placa de vídeo, como mais um passo do desenho do chão (`GroundRenderer`). Ela é feita a cada quadro, com:

- **fumaça por pixel:** camadas de nuvem que se torcem e andam devagar;
- **borda pela linha de visão de verdade**, cortada pelas casas que o servidor manda.

### Metas

- **Rente às paredes, a borda é firme e reta:** segue a linha de visão, como a luz das tochas, e a fumaça não vaza parede adentro.
  - Num pilar ou cômodo fechado, a fumaça fica dentro das paredes.
- **Onde a visão acaba pelo alcance**, no campo aberto, a borda se desfaz em fiapos que avançam e recuam com a fumaça, até ~1,5 casa.
- **Nunca mostra mais do que o servidor mandou:** só fica limpo o que a linha de visão alcança *e* as casas visíveis que chegaram. Nenhum mob aparece "do nada" no chão já limpo.
- **Fumaça com volume:**
  - **jogador:** tinta escura com reflexo violeta, dobras mais claras, vãos escuros e um relevo leve;
  - **mestre:** a bruma cinza translúcida de hoje (62%).
- **Explorado** (já visto, ninguém olhando agora): o mapa lembrado, escurecido e meio sem cor, com um véu de fumaça que se mexe. A fumaça escura do nunca visto avança só sobre o nunca visto, não sobre o explorado.
- **O que o mestre revela com o pincel** e o explorado seguem as casas, com a borda arredondada e os fiapos, sem os degraus borrados de hoje.
- **60 quadros por segundo:** a visão só é refeita quando ela muda (alguém anda, uma porta abre, o zoom muda); a fumaça lê uma textura de ruído pronta.
- **"Reduzir efeitos":** a fumaça para (a borda continua).

### Não metas

- **A regra da visão não muda:** o servidor continua decidindo casa por casa, em `sightCells` e `updateSight`, e filtrando por elas o que manda. A placa só desenha.
- **"Visto por último aqui"** (`LastSeen.tsx`), o *Cômodo* do pincel, a ferramenta e as opções da névoa ficam como estão.
- **Sem WebGL 2:** a névoa de hoje (`FogLayer`) continua.
- **Efeitos e clima:** etapa 4.

### Anti-metas

- A fumaça atravessando parede, ou saindo de um pilar fechado para o lado visível.
- Mostrar o chão (ou um token) que o servidor não mandou.
- Névoa chapada, sem detalhe, ou com o ladrilho repetido aparecendo.
- O mapa engasgando com a névoa ligada (a página de teste dava poucos quadros antes do ajuste: a visão refeita a cada quadro e ~35 contas de ruído por pixel).

## Caminhos considerados

- **Borda por casa, só mais nítida.** Descartado: continua em degraus rente às paredes.
- **Linha de visão pura.** Descartado: mostra o chão de casas que o servidor ainda não mandou, e o mob surgiria do nada.
- **Linha de visão cortada pelas casas do servidor.** **Escolhida pelo dono** ("a segunda, mas sendo bem bonita").
- **Como construir:**
  - **Um passo novo no desenho do chão.** **Escolhido pelo dono** ("caminho 1"). Aproveita o recorte das tochas e as paredes que já estão na placa, sem trabalho pesado no processador.
  - **Manter o Konva com um furo em resolução maior.** Descartado: continua montando a imagem no processador e com o ladrilho.

## Como fica (a conta da página aprovada)

- **Casas** *(chamada minha, no plano: uma máscara na metade da tela, desenhada com os triângulos de cada trecho de casas (no hex, o polígono de cada uma). Assim a grade hex e o mapa grande saem de graça; na página, era uma textura de 1 ponto por casa)*:
  - **R:** visível agora (`state.battle.sight`), com a pincelada em andamento do mestre (`FogDraft`);
  - **G:** explorado (`fog.explored`, só com a visão dos personagens);
  - **B:** revelado pelo mestre (`fog.revealed`).
  - Refeita só quando uma dessas muda (a chave de hoje, `maskKey`).
- **Recorte da linha de visão** (meia resolução da tela, como a luz; com níveis menores para a borda macia):
  - **R:** o leque de cada aliado no mapa (`lightPolygon` com as paredes que este cliente tem, `lightBlockers`, mais os objetos que bloqueiam, `propOccluders`). O alcance é o da visão dele menos meia diagonal (0,71 casa), para o círculo cair inteiro dentro das casas que o servidor manda e a borda do alcance sair redonda.
  - **G:** o mesmo círculo sem paredes, para saber se a borda ali é de parede (firme) ou de alcance (fiapos).
  - Refeito só quando a visão muda.
- **O que fica limpo:** a linha de visão (R) cortada pelas casas visíveis. As casas vão até a beira da casa (`smoothstep(0.2, 0.55)` da leitura linear), para não empurrar a fumaça para dentro do que se vê. Por cima vem o revelado pelo mestre (B).
- **Borda:**
  - **Firme:** linha de visão com ~0,1 casa de borda.
  - **Larga:** ~1,5 casa, para saber onde é a beira.
  - **Fiapos:** o ruído da fumaça empurra o limite para os dois lados na faixa da borda, só fora do círculo do alcance; dentro dele, a borda é de parede e fica com só um respiro (12%).
- **Explorado:** vai até a beira da casa e só se espalha, com o balanço da fumaça, para o lado do nunca visto.
- **Fumaça:**
  - **Ruído:** uma textura de ruído pronta (256 × 256, duas nuvens em R e G, emenda nas bordas, 1 ladrilho = 11 casas), lida em três escalas (grande, média, fina) com o deslocamento de uma nuvem mais lenta.
  - **Relevo:** a nuvem grande comparada com ela mesma, um tico deslocada.
  - **Cores do jogador:**
    - vãos 4, 3, 8;
    - corpo 30, 24, 42;
    - dobras 96, 80, 128.
  - **Cores do mestre:** 92, 88, 110 a 160, 156, 176, e as dobras 232, 230, 240, por cima do mapa a 62%.
  - **Brilho:** a beira da fumaça pega um pouco de luz.
- **Ordem das camadas:** a mesma de hoje (por cima do chão, efeitos, desenhos, paredes e tochas; abaixo dos tokens), como mais uma imagem de saída do chão (como `GroundPropsImage`).
- **Copas por cima dos tokens** (`propsAbove`) *(chamada minha)*: recebem a mesma névoa, porque hoje uma copa em área nunca vista aparece por cima da névoa. O nunca visto a esconde; o explorado a escurece.
- **Desempenho:**
  - a visão (casas e recorte) é refeita só quando muda;
  - a fumaça anda num laço próprio: só a imagem da névoa é refeita, não o chão;
  - parada com "Reduzir efeitos" e no aparelho que não aguenta.
- **Mestre e jogador:** a névoa usa só o que cada um recebe: as casas da visão e as paredes já vêm filtradas pelo servidor.

## Limites conhecidos

- **Degrauzinhos na sombra de pilares e paredes:** onde ela corta as casas na diagonal, alguns trechos curtos saem em degrau. Uma casa vista pela metade fica escondida, porque o servidor não a mandou.
- **Chão iluminado por um mob com tocha fora de vista:** o servidor manda as casas acesas, mas o cliente não sabe dessa tocha. Esse chão fica na névoa até o mob aparecer. O mob em si chega e aparece por cima da névoa, como hoje.
- **Fumaça sobre parede que o jogador ainda não tem:** o servidor não manda paredes não vistas, e a linha de visão do cliente passa por elas. As casas do servidor cortam.

## Página de teste

[nevoa-teste.html](nevoa-teste.html): casa de dois cômodos com portas, campo com pilares, canto revelado pelo mestre e dois aliados andando com visão de 60 ft.
- **Opções:** névoa *Nova* ou *Hoje*; borda *Por casa*, *Linha + casa* ou *Linha pura*; jogador ou mestre; portas; zoom.
- **Aprovada em 2026-11-22**, depois de três ajustes:
  - borda com fiapos e fumaça com volume ("tá bem reta, sem detalhes");
  - 60 quadros por segundo ("o fps tá terrível");
  - a fumaça sem vazar da parede de um pilar ("uma parte do token estaria [visível]").

## Fica para o construtor

- **Grade hexagonal:** o centro e o alcance de cada aliado vêm da geometria (`shapeCenter`, `drawSpan`), como no servidor.
- **Como a névoa entra no `GroundRenderer`:** as entradas (névoa, visão, aliados, objetos que bloqueiam, quem é mestre), o laço da fumaça, e se a imagem da névoa sai junto com a das copas ou à parte.
- **Visão sem os personagens** (`fog.vision` desligado): só o revelado pelo mestre, com a borda por casa e os fiapos.
- Medir no teste do dono antes de lançar (roteiro em `docs/pendencias.md`).
