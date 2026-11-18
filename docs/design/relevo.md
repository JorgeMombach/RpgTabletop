# Relevo, paredes na placa de vídeo e nitidez de Full HD

Combinado em 2026-11-18, com o dono do projeto, na branch `feat/campanha`, depois das [paredes emendadas](paredes.md). Segundo dos três projetos de "construção" do mapa (1. paredes, feito; **2. relevo**; 3. estruturas: pontes, escadas, pisos). Teste aprovado: `docs/design/relevo-teste.html` (técnica *C. Mistura*, com a nitidez da última versão).

## Por quê

O mestre quer mapas com cara de produto comercial (referência: Nimblehold). Hoje o chão é plano, e as paredes e a rocha são desenhadas à mão no canvas, com um resultado que o dono chamou de "de Paint", "480p". O teste em WebGL, com altura, luz por pixel e grão fino, foi aprovado, e o dono definiu um padrão: **nitidez de Full HD em tudo o que for visual no mapa, mesmo com retrabalho do que já existe**. Pode pesar mais na placa de vídeo, sem deixar de rodar num PC comum.

## Objetivos

1. **Relevo pintado.** Uma ferramenta pinta níveis com pincel, como o *Terreno*, com dois tipos de borda: **escarpa** (penhasco de rocha) e **suave** (morro, monte, duna: sobe e desce sem rocha aparecendo). O terreno sobe e desce em patamares de topo plano, e entre dois níveis aparece sozinho um penhasco: face larga de rocha em camadas com borda clara, blocos grandes, poucas rachaduras, aresta de cima com contorno de tinta fino e base mais escura.
2. **Luz do relevo.** A face do penhasco pega o sol (ou a lua) de um lado e fica na sombra do outro. O patamar alto joga sombra no baixo, comprida no entardecer. Faz parte da luz da cena que já existe.
3. **Água no fundo.** A água pintada num nível baixo (o rio do cânion) fica entre os penhascos.
4. **Paredes, portas e janela na placa de vídeo**, com o mesmo material e a mesma luz do penhasco. A parede de rocha é um penhasco fino (crista irregular); o muro de pedra lavrada é um muro reto com blocos. Os 11 desenhos, as portas (com os estados do mestre) e a janela são refeitos assim.
5. **Retrabalho do chão e da água** para a mesma nitidez: grão fino e relevo fino por pixel na grama, terra e pedra, e na água.

## Não é

- Não muda regra: o relevo é só visual. Não muda régua, movimento, visão, névoa nem luz das tochas. Um dia pode virar relevo de verdade, mas não agora. O selo de elevação do token (↑ 10 ft) continua manual.
- Não faz pontes, escadas nem pisos (projeto seguinte), nem cachoeira (relevo com correnteza).
- Não leva árvores e objetos para a placa de vídeo (ficam para a troca de motor do mapa).

## Antigoals

- Arrastar ou dar zoom engasgar por causa do relevo: o cálculo pesado não pode rodar a cada quadro.
- Perder a nitidez aprovada para caber no desempenho: se precisar escolher, guarda-se mais (memória) e recalcula-se menos.
- Mudar o que já foi aprovado na emenda das paredes (as cadeias, o telhado invisível, as janelas, o corte sob porta e janela).

## Abordagens

- **A. Calcular uma vez por pedaço do mapa e guardar (escolhida).** Quando o relevo, as paredes ou a luz da cena mudam, a placa de vídeo calcula só os pedaços de 8×8 casas afetados e guarda cada um como textura. A cada quadro, só lê o que foi guardado. Pedaço plano sem nada por perto não ocupa memória.
- B. Calcular tudo a cada quadro (como o teste): ~50 ms por quadro numa tela menor que Full HD. Só serviria baixando a qualidade.
- C. Calcular no processador (Worker): dezenas de vezes mais lento, com atraso de segundos ao pintar num mapa grande.

## Como (o que foi decidido)

### Etapas (cada uma com página de teste e aprovação do dono quando muda a aparência)

1. **Relevo:** dados, pincel, cálculo guardado por pedaço, penhascos, sombra do relevo na luz e água no nível baixo.
2. **Paredes, portas e janela na placa de vídeo:** os 11 desenhos, as portas em todos os estados e a janela, com o material e a luz do relevo. Lotes com página de teste, como combinado nas paredes. A rocha vira penhasco fino.
3. **Chão e água na nitidez nova:** grão e relevo fino por pixel no terreno pintado e na água.

### Relevo: dados e pincel

- **Níveis de −2 a +3** (0 = chão) e, em cada ponto, o **tipo de borda** (escarpa ou suave), na mesma grade fina do terreno (4 pontos por casa, pedaços de 8×8 casas, `shared/src/terrain.ts`), um byte por ponto (nível e tipo). Novo campo da cena, por exemplo `relief`, com o mesmo formato e o mesmo canal de envio do terreno: no arquivo de sessão, por cena, e apagado por *Limpar campo*.
- **Ferramenta *Relevo*** no painel *Construir*, ao lado do *Terreno*. Escolhe-se o nível de −2 a +3 e o tipo (*Escarpa* ou *Suave*) e pinta-se com pincel (tamanho como o do terreno). *Aplainar* volta a 0. Tem *Desfazer* (Ctrl+Z) e *Apagar tudo*. Funciona no quadrado e no hex, como o terreno.
- Só o mestre pinta (validado no servidor). Todos veem o relevo, sob a névoa como o resto do chão.

### Relevo: forma (do teste aprovado)

- **Tipo de borda:** quem decide é o lado de cima da borda (o patamar diz como ele cai). Um morro pode ter um lado em escarpa e o outro suave.
- **Suave** (pedido do dono depois da aprovação; aprovado no teste em 2026-11-18): rampa de **2,5 casas por nível, centrada na borda pintada** (metade fora, metade dentro), perfil `smoothstep`; monte pequeno termina em topo arredondado. A altura das encostas suaves é **suavizada antes da luz** (a distância até uma borda irregular tem dobras que viram raios na luz, vistos no teste). É o próprio chão da encosta (o terreno pintado, a imagem do mapa ou a mesa), sem rocha nem contorno de tinta, e ganha só a luz da encosta e a sombra do relevo. **Dunas não são níveis pintados** (viraram platôs com borda no teste): são uma ondulação contínua da areia, com altura regulável, e vão para a etapa 3 junto com a areia.
- O que segue é a **escarpa**:

- O patamar mantém a forma pintada. O penhasco fica **do lado de baixo da borda**, com **1,15 casa de face por nível**, e a borda é irregular (ruído).
- A altura sai da distância até a região mais alta (cada nível desce numa face, com a curva do teste).
- **Detalhe por pixel** (o que dá o Full HD):
  - relevo fino na rocha (duas escalas de ruído) e ondulação leve no chão;
  - blocos facetados (Voronoi) com rachaduras raras e quebradas;
  - camadas com borda de cima clara e borda de baixo escura;
  - grão da rocha (manchas, pontinhos claros e escuros);
  - contorno de tinta na aresta de cima com **largura fixa em pixels**.
- Material: aquarela de pedra CC0 do projeto misturada com as camadas calculadas e o contorno.

### Relevo sem terreno pintado e sobre imagem de mapa *(chamada minha)*

Hoje, onde nada foi pintado, o chão é transparente e aparece a imagem do mapa (ou a mesa). Com o relevo:

- **A face do penhasco é sempre rocha opaca**, por cima da imagem do mapa (um penhasco é um penhasco).
- **O topo dos patamares e o fundo dos níveis baixos continuam como estão** (terreno pintado, imagem do mapa ou mesa). Ganham só a luz do relevo: a sombra do patamar alto e a oclusão no pé da face.
- **Vale sobre mapa importado (UVTT)**: o mestre pode pôr penhascos num mapa de imagem.

O material guardado tem cobertura (alfa): rocha onde há face, nada onde é plano.

### Água e relevo *(chamada minha)*

- A água é só a pintada com o *Terreno*, como hoje: nível baixo não vira água sozinho (o teste fazia isso só para mostrar).
- **Água pintada atravessando uma borda de nível:** a face do penhasco fica por cima da água.
- **Água num patamar alto** (lago na mesa) pode.
- A margem e a correnteza da água não olham o relevo nesta etapa (pé do penhasco como margem fica para depois).

### Lições do teste (valem para o app)

- Distância até a borda **exata** (Felzenszwalb), não por chanfro: o chanfro de 8 direções deixa encostas octogonais.
- Altura em **precisão completa** (R32F com filtro linear quando houver) e lida com **curva cúbica** onde vira luz: com meia precisão ou leitura linear, a encosta suave mostra anéis em degraus.
- Sombra **calculada uma vez** numa textura (o laço por pixel a cada quadro estourou o compilador da placa e travou o WebGL do navegador).

### Relevo: cálculo guardado (abordagem A)

- **O que é guardado por pedaço:** os campos que saem da altura e não dependem da luz: altura fina, normal grossa, cobertura de rocha, posição na camada, bloco (id do Voronoi) e oclusão. A resolução é de 32 pixels por casa: um pedaço de 8×8 casas vira 256×256 *(chamada minha)*.
- **Full HD em qualquer zoom** *(chamada minha)*: o detalhe de alta frequência é refeito a cada quadro em cima dos campos guardados e da posição no mapa, sem a sombra, que é o que pesa. Isso vale para o relevo fino da rocha, o grão, os pontinhos, as rachaduras e o contorno de tinta com largura em pixels. Assim, de perto não amolece.
- **A sombra do relevo** depende da direção do sol. Ela é guardada à parte, por pedaço e por luz da cena. Ao trocar a luz, as duas sombras se misturam durante a troca (meio segundo, como a luz).
- **Quando recalcular:**
  - o pedaço pintado e os vizinhos que a face ou a sombra alcançam;
  - todos os pedaços com relevo quando a luz da cena muda (só a sombra);
  - os pedaços onde uma parede muda (etapa 2).
- **Desenho a cada quadro:** o shader do terreno lê o material e a normal guardados e aplica a luz da face (direção do sol da cena). A sombra do relevo entra na máscara de sombra do passo da luz, junto com a sombra das paredes. Debaixo do telhado invisível não há sombra, como hoje.
- **Memória:** só pedaços com relevo (ou perto dele) ocupam espaço, com um teto. Passando do teto, a resolução cai para 16 por casa nos pedaços mais distantes da tela *(chamada minha)*.
- **Celular e tablet** (`MobileShell`, tela pequena) *(chamada minha)*: o mesmo efeito, com os campos a 16 pixels por casa e teto de memória menor (como o terreno no processador já faz em tela pequena).
- **Sem WebGL 2 ou com o chão desligado** (`groundFailed`): o chão continua plano, como hoje.

### Paredes na placa de vídeo (etapa 2)

- O desenho das paredes sai do canvas (`wallChainArt.ts`) e passa para um passo novo do renderizador do chão. Esse passo desenha as cadeias (as mesmas de `wallChains`) com shader, com altura de perfil por desenho (muro reto, crista de rocha, tábuas, esteios…), material por pixel e a luz da cena.
- O passo publica uma imagem própria, posta na camada das paredes por uma `GroundOutputLayer`, como as chamas. O clique continua por parede no Konva.
- As portas (aberta, fechada, trancada e secreta para o mestre, porta dupla, portões) e a janela também vão para o shader.
- A emenda, o telhado invisível, as janelas e o corte sob porta e janela continuam como estão.
- A parede de rocha é um penhasco fino, com o mesmo material dos penhascos do relevo.
- Lotes com página de teste e escolha do dono, como combinado nas paredes.
- **Sem WebGL 2 ou com o chão desligado** *(chamada minha)*: as paredes continuam com o desenho de hoje no canvas (`wallChainArt.ts`), emendadas, sem as texturas novas. Esse desenho fica como reserva e não é retrabalhado.

### Chão e água (etapa 3)

- **Dunas**: ondulação contínua da areia (ondas com crista mais aguda que o vale, direção variando de leve), altura regulável, no mesmo cálculo guardado do relevo.
- **Areia** entra como terreno novo do *Terreno* (para deserto e dunas; aquarela CC0 ou calculada, com a mesma nitidez) *(chamada minha, a partir do pedido das dunas)*.
- O terreno pintado e a água ganham o grão fino e o relevo fino por pixel do teste, calculados no mesmo esquema (guardado quando dá, barato a cada quadro).
- Página de teste antes, com o dono.

## Fica para o construtor

- Nomes dos campos, das ações e das chaves de texto. O ícone da ferramenta (Tabler) e o atalho.
- Formato exato das texturas guardadas (quantos canais, meia precisão ou 8 bits), desde que caiba o que está acima.
- Como dividir o passo da luz para receber a sombra do relevo.
- Valores finos de cor e ruído, desde que fiquem iguais ao teste aprovado.
