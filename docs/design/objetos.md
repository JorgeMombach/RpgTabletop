# Objetos na placa de vídeo

Combinado em 2026-11-21, com o dono do projeto, na branch `feat/objetos`. É a **etapa 1 de 4** da troca de motor do mapa (1. **objetos e plantas**; 2. sombra por objeto; 3. névoa de guerra; 4. efeitos e clima), que sai inteira numa versão só. É também a Entrega 2 da *Criação de mapa* ("objetos com mais qualidade"). Teste aprovado em [objetos-teste.html](objetos-teste.html).

## Por quê

O chão, a água, o relevo, a luz, as paredes, os pisos, as pontes e as escadas já são desenhados pela placa de vídeo, nítidos em qualquer zoom. Os objetos ficaram para trás: são desenhados à mão no canvas 2D (`propArt.ts`, `propArtMore.ts`, `plantArt.ts`), com formas, degradê e granulado, e viram uma imagem guardada. Ao lado do chão novo, parecem de outro jogo: chapados, borrados de perto e sem conversar com a luz. O dono quer o mapa inteiro no mesmo padrão de nitidez ("literalmente tudo"), mirando algo vendável (referências: Nimblehold, 2-Minute Tabletop).

O dono apontou "um pouco dos dois" como problema: o traço e a nitidez/integração. Daí a receita escolhida.

## O que é

Os **28 tipos de objeto** passam a ser desenhados pela placa de vídeo, com a receita aprovada no teste:

- **Forma calculada pela semente**, como hoje: duas árvores nunca saem iguais, e a mesma árvore sai igual para todos.
- **Superfície pintada:** folhas e pedra usam as aquarelas CC0 do chão (as mesmas do terreno); madeira, ferro, tecido e afins são calculados por pixel, como nos pisos.
- **Luz por pixel:** cada parte pega o sol (ou a lua) de um lado e fica escura do outro; a tocha ilumina o lado virado para ela.
- **Contorno fino** de largura fixa em pixels, por fora e onde uma parte encosta na outra (bola de folha sobre bola de folha, tábua com tábua).
- **Vento** calculado na placa de vídeo: a copa inclina para o lado do vento e oscila, cada bola de folha balança um pouco diferente e uma ou outra clareia quando o vento vira a folha.
- **Sombra simples** pelo sol ou pela lua (a silhueta empurrada para longe da luz, ligada ao pé pelo tronco nas árvores).
- **Assenta no relevo:** o objeto fica na altura do chão onde está; a sombra parte de lá.

### Metas

- Os 28 tipos redesenhados (lista abaixo), cada um com o nível do teste aprovado.
- Nítido em qualquer zoom (do *Normal* ao *Bem de perto* do teste), na densidade da tela.
- Tudo o que se faz hoje com objetos continua igual: pôr, escolher, arrastar (Shift encaixa), alças de tamanho e giro, *Variar*, *Acima/Abaixo dos tokens*, *Bloqueia a visão*, Delete, Ctrl+C / Ctrl+V, *Desfazer*, pincel de espalhar com os conjuntos, copa meio transparente com token embaixo.
- Vento do jeito de hoje: mais forte e para o lado do vento com clima de vento; parado com a ferramenta *Objetos* aberta, com *Reduzir efeitos* e no aparelho que não dá conta.
- Mapa com 500 objetos andando no WASD sem engasgar (como hoje), e pôr um objeto sem travar.
- Sombra do entardecer já curta (~2,1 casas por altura de parede; feito junto com o teste).

### Não metas

- **Sombra pela tocha, sombra dos tokens e sombra de um objeto em cima do outro:** etapa 2.
- **Névoa, efeitos e clima:** etapas 3 e 4.
- Objetos novos no catálogo (a "segunda leva" de antes já entrou; outros ficam para depois).
- Não muda os dados: `MapProp` continua igual (tipo, posição, tamanho, giro, semente, camada, bloqueia), então mapas salvos abrem iguais e o arquivo de sessão não muda.
- Não muda régua, visão nem névoa (ADR-06). O pé que bloqueia a visão continua o de hoje.

### Anti-metas (seria um fracasso mesmo funcionando)

- Objetos com cara de "Paint" ou de 480p perto do chão.
- Floresta grande travando o WASD ou o pincel de espalhar.
- Objeto piscando, sumindo ou trocando de desenho ao dar zoom, ao recarregar ou para jogadores diferentes.
- Editar ficar pior que hoje (alças, arrastar, escolher).

## Caminhos considerados

- **A. Arte pintada como base** (imagens CC0 de cada objeto) com luz e vento por cima. Descartado: não há pacote CC0 coerente que cubra os 28 tipos (os bons não são livres; os livres têm estilos que não combinam, e um é feito com IA), e a variação ficaria presa às imagens existentes.
- **B. Forma por código, superfície pintada** (a mesma receita do relevo: aquarela CC0 + camadas calculadas + tinta). **Escolhido pelo dono.**
- **C. Tudo por código, sem textura nenhuma.** Descartado: é o caminho reprovado como "de Paint".

## Como fica

### Desenho (placa de vídeo)

- **Um passo novo no renderizador do chão** (`client/src/map/ground/propPass.ts` + `propShader.ts`), no mesmo contexto WebGL 2, como pontes e escadas. Não conhece Konva nem React.
- **Forma guardada, detalhe na hora** *(chamada minha, para caber 800 objetos por cena)*: o caro é a forma (as 30 bolas de folha, os andares do pinheiro, as facetas da pedra). Ela é calculada **uma vez por tipo e semente** numa textura pequena, num atlas, como o relevo guarda os pedaços:
  - distância até a borda de fora (o contorno fica nítido em qualquer zoom, sem depender da resolução guardada);
  - altura (dá a luz por pixel);
  - distância até a borda de dentro (o contorno entre partes);
  - tom e material (qual bola de folha, qual tábua, madeira ou ferro).
  - Resolução da forma guardada em torno de 48–64 pontos por casa; o detalhe fino (folhinhas, veio da madeira, agulhas, trama do saco, grão da pedra) é calculado na hora por pixel, a partir da posição no mapa, e é o que deixa nítido de perto.
  - O atlas tem teto de memória; forma que sai da tela há tempo sai do atlas e é refeita quando volta. Algumas por quadro, como os pedaços do relevo (o objeto novo aparece logo; uma floresta inteira vai aparecendo em poucos quadros).
- **A cada quadro**, cada objeto na tela é um retângulo que lê a forma guardada, aplica o vento (desloca a leitura pela altura: o topo da copa anda mais que a borda), calcula a luz e o detalhe e pinta.
- **Luz relativa**, como paredes e relevo: o passo calcula só o quanto cada ponto está virado para o sol (claro de um lado, escuro do outro); a cor e a força da luz da cena vêm da camada de luz por cima de tudo (`lightImage`). A tocha entra pela mesma camada.
- **Sombra simples no mapa de luz:** a silhueta de cada objeto, empurrada para longe do sol pela altura do tipo (a mesma conta do teste), entra na máscara de sombra da camada de luz, junto da sombra das paredes. Assim o token que entra na sombra da árvore também escurece. As copas fazem a sombra pela forma guardada.
- **Duas saídas novas**, copiadas do canvas WebGL como as de hoje: **objetos de baixo** (onde hoje fica a camada `below`, acima das paredes e abaixo das tochas, baús e névoa) e **objetos de cima** (as copas, acima dos tokens e abaixo da luz). Só são refeitas quando algo muda (objetos, visão, luz) ou quando há planta balançando na tela.
- **Copa com token embaixo** fica meio transparente e parada, como hoje.
- **Ordem:** dentro de cada saída, a ordem da lista de objetos da cena (o último posto fica por cima), como hoje.
- **Névoa e jogadores:** nada muda; o servidor já não manda ao jogador o objeto coberto pela névoa, então o passo só desenha o que recebeu. *Ver como jogador* idem.
- **Sem luz de cena** (camada de luz desligada): os objetos saem com a luz relativa e sem sombra, como as paredes nesse caso.
- **Relevo:** a altura do chão no centro do objeto (`reliefSampler`, a mesma das escadas) é a base do objeto: a sombra parte dela e cai no chão mais baixo do lado. Objeto em cima do patamar não "afunda" na face do penhasco.

### Os 28 tipos

Agrupados pelo jeito de desenhar (cada grupo reaproveita a receita do teste):

| Grupo | Tipos | Receita |
|---|---|---|
| Copas | árvore, arbusto, flores, palmeira | bolas de folha sobrepostas, aquarela de grama, vento; flores com pontinhos de cor; palmeira com folhas longas em leque |
| Coníferas e capim | pinheiro, grama alta | andares em estrela com agulhas (pinheiro); tufos de folhas finas (grama alta), vento |
| Pedras | pedregulho, pedras, entulho | contorno irregular, facetas, rachaduras e musgo, aquarela de pedra |
| Madeira bruta | tronco caído, toco, cogumelos | casca e anéis, musgo; cogumelos com chapéu e pintas |
| Madeira trabalhada | barril, caixote, pilha de caixotes, pilha de tábuas, mesa, estante, cama, carroça, ponte (objeto), poço | tábuas com veio e frestas, aros e pregos de ferro; poço com pedra em volta e água escura |
| Pedra trabalhada | pilar, estátua, altar | blocos lavrados, aquarela de pedra clara, facetas |
| Tecido e outros | barraca, sacos, ossos | lona/juta com trama; ossos claros |

O desenho de cada tipo segue o que ele é hoje (as mesmas partes, a mesma escala e o mesmo `PROP_EXTENT`), só que na receita nova. Os 6 do teste já estão aprovados; os outros 22 passam por **uma página de teste de catálogo** antes de entrar no app *(chamada minha: o *Cenário* combinou "protótipo de cada peça antes", e o dono não precisa olhar peça por peça, só o catálogo de uma vez)*.

### Edição

- Os objetos continuam com um nó Konva cada, **invisível**, só para clique, arrasto e alças (a área de clique de hoje: o miolo do desenho). O desenho visível vem da placa de vídeo.
- Enquanto arrasta ou mexe nas alças, o passo desenha o objeto na posição, no tamanho e no giro do arrasto *(chamada minha: o construtor decide se é o nó que manda a posição ao passo a cada movimento, ou outra forma, desde que o objeto acompanhe o mouse sem atraso visível)*.
- O painel *Objetos* (ícones da lista) mostra os tipos no desenho novo quando há WebGL 2 *(chamada minha: ícone feito uma vez pela placa de vídeo e guardado como imagem)*.

### Sem WebGL 2 *(chamada minha)*

Fica o desenho de hoje (`propArt.ts` e companhia, no canvas 2D, com o vento de `PlantWind.tsx`), como já acontece com chão, paredes e pisos. Também com o chão em WebGL falhando (`groundFailed`).

### Grid hexagonal

Nada muda: os objetos têm posição livre em casas, e o passo usa a mesma conversão de casas para a tela que pontes e escadas.

## Página de teste

[objetos-teste.html](objetos-teste.html): árvore, pinheiro, arbusto, pedregulho, barril e carroça sobre o chão em aquarela, com dia, entardecer e luar com tocha, três zooms, vento parado, brisa e forte, *Variar* e *Hoje* (o desenho atual no mesmo lugar). Aprovado em 2026-11-21 ("super aprovado"; texturas "perfeitas"). Ajuste pedido: a sombra do entardecer estava comprida demais; ficou ~1/3 mais curta, no teste e no app (`sceneLight.ts`).

## Fica para o construtor

- Formato exato do atlas (tamanho das páginas, canais, quantos pontos por casa) e o teto de memória, medidos num mapa com 500–800 objetos.
- Quantas formas por quadro e a ordem (as da tela primeiro).
- Como o objeto arrastado chega ao passo.
- O desenho dos 22 tipos que faltam, dentro da receita e aprovado na página de catálogo.
- Medir antes de lançar: WASD com 500 objetos, pincel de espalhar uma floresta, abrir uma cena com floresta, primeira vez (compilação dos programas, como a água).
