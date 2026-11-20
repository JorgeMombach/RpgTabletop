# Escadas

Combinado em 2026-11-19, com o dono do projeto, na branch `feat/campanha`. Última parte do terceiro projeto de "construção" do mapa (1. [paredes](paredes.md), feito; 2. [relevo](relevo.md), feito; **3. estruturas**: [pisos](pisos.md), feito; [pontes e píer](pontes.md), feito; **escadas**). Teste aprovado: `docs/design/escadas-teste.html` (a segunda versão, com a escada de mão ancorada, o poço da escada descendo com paredes retas e a curva no meio da subida). Os valores visuais saem dela.

## Por quê

O *Relevo* tem patamares de −2 a +3, mas entre dois níveis só há penhasco (escarpa) ou rampa (suave): não há como mostrar o caminho que sobe o penhasco. E dentro das construções não há como marcar a subida para o andar de cima ou a descida para o porão, que são outra cena. O dono quer escadas no mesmo padrão do resto do chão (Full HD em qualquer zoom, desenhadas pela placa de vídeo, com a luz da cena) que:

- **no relevo**, acompanhem a altura de verdade: cortem o penhasco ou a encosta, com degraus onde o chão sobe e patamar onde fica plano;
- **dentro de construções**, só existam e deixem claro para onde vão, terminando "cortadas" (o andar de cima e o porão são outra cena).

## O que é

Uma ferramenta **Escada** no painel *Construir*, com três formatos:

- **Escada** (reta, com curvas): o mestre clica no pé, clica em cada ponto onde ela vira e dá dois cliques no topo; a escada passa pelos pontos com as viradas arredondadas. Só pé e topo = escada reta.
- **Caracol**: degraus em leque em volta de um pilar, para torre e masmorra. Sempre solta (sobe ou desce para outra cena).
- **Escada de mão**: madeira, encostada no penhasco ou saindo de um alçapão (poço, celeiro, navio).

### Metas

- Dois materiais na escada e no caracol: **pedra** (degraus lavrados, mureta de blocos nas bordas) e **madeira** (tábuas, corrimão de pau com postes). A escada de mão é sempre de madeira.
- Largura da escada de **1, 2 ou 3 casas**.
- **No relevo, a altura sai sozinha:** a escada lê a altura do chão ao longo do caminho; onde ele sobe, degraus; onde fica plano por um trecho, **patamar**. Um ziguezague no penhasco sai com patamares nas viradas.
- **Pousada:** nas pontas a escada encosta no chão; onde passa acima do chão (subindo junto a uma face, ou sobre o fundo de um cânion), tem lateral de alvenaria ou de madeira até o chão, com a face clara do lado do sol e escura do outro, e sombra pela altura (a mesma conta das pontes).
- **Corta o penhasco:** onde a escada atravessa a face do penhasco, os degraus aparecem cavados na rocha, com a rocha dos dois lados.
- **Escada solta** (pé e topo no mesmo nível do relevo), com o sentido escolhido:
  - **sobe**: os degraus clareiam até uma borda cortada, com sombra embaixo dela;
  - **desce**: os degraus escurecem até um buraco escuro, com borda de alçapão.
- **Caracol** sobe ou desce do mesmo jeito (o fim do giro clareia até a borda cortada, ou escurece até o poço).
- **Escada de mão**: encostada numa face do relevo, liga o pé ao topo; solta, sai de um alçapão (desce) ou some na borda cortada (sobe).
- Luz da cena (dia, entardecer, luar, noite) e nitidez em qualquer zoom.
- Colocar, editar (mover pontos, acrescentar e tirar pontos, trocar formato, material, largura e sentido), apagar, *Desfazer*; cada cena com as suas, arquivo de sessão, *Limpar campo* apaga.
- Todos veem as escadas (por baixo da névoa, como o chão).

### Não metas

- Não muda régua, visão, movimento nem névoa: é só visual (ADR-06). Token na escada é só desenho; o selo de elevação continua manual.
- Não faz andares: o andar de cima e o porão são outra cena. Clicar na escada **não** troca de cena.
- Não liga a escada ao relevo: se o relevo muda, a escada fica onde foi posta (degraus, patamares e sombra se ajustam sozinhos ao que estiver embaixo).
- Não faz rampa sem degraus, escada rolante de masmorra, escada quebrada.

### Anti-metas (seria um fracasso mesmo funcionando)

- Escada que parece **flutuar** ou **colada** por cima do penhasco (o erro da primeira versão das pontes).
- Degraus que não batem com o relevo: degrau no plano, rampa lisa onde o chão sobe.
- Curva com degraus tortos ou esticados (os degraus têm que seguir a curva, em leque na parte de dentro).
- Cara de imagem colada ou de baixa resolução.

## Caminhos considerados

Para desenhar a curva:

- **A. Clique a clique, com cantos arredondados (escolhido).** Como o caminho da correnteza: clique em cada ponto de virada, dois cliques no topo; alças em cada ponto depois. Controle exato e combina com o relevo irregular.
- B. Arrastar com uma alça de curvatura: o mais rápido, mas só uma curva (sem ziguezague nem "S", que fazem falta no penhasco).
- C. Mão livre: natural, mas difícil de acertar e de corrigir; degraus num traço tremido ficam feios.

Para desenhar: peça nova do mapa, desenhada pela placa de vídeo num passo do renderizador do chão, como as pontes (o objeto pronto no processador não tem a luz do chão nem a nitidez combinada).

## Como fica

### Dados

- `stairs: Stair[]` por cena: `{ id, shape: "path" | "spiral" | "ladder", points: { x, y }[], width: 1 | 2 | 3, material: "stone" | "wood", exit: "up" | "down" }`, em casas *(nomes ficam para o construtor; a forma é chamada minha)*:
  - **escada**: `points` é o caminho, do pé ao topo (a linha do meio), de 2 a 16 pontos;
  - **caracol**: `points` = [centro, ponto da borda]; a direção dá onde fica o primeiro degrau; o diâmetro (**1, 2 ou 3 casas**) fica em `width`, escolhido pelo arraste (distância encaixada) e trocável no painel depois (o ponto da borda continua só dando a direção) *(chamada minha)*;
  - **escada de mão**: `points` = [pé, topo], comprimento de 1 a 4 casas, largura fixa (meia casa);
  - `exit` só vale para a escada solta; no relevo, quem decide é a altura;
  - escada de mão ignora `material` (sempre madeira).
- Limites: até **64 escadas** por cena; caminho de **1 a 40 casas** no total *(chamadas minhas, como as pontes)*.
- Escada nova vai no fim da lista; as de cima na lista aparecem por cima. As escadas ficam **por cima das pontes** *(chamada minha)*.

### Ações (servidor valida tudo, só o mestre)

- `stair:add`, `stair:update` (qualquer campo de uma escada), `stair:remove` (ids). *Desfazer* no cliente com essas mesmas ações.
- Recusas em português, como modelo traduzido (`serverText.ts`): caminho curto ou longo demais, pontos demais, limite da cena, escada que não existe, dado inválido.
- No estado da cena, no arquivo de sessão (ida e volta) e em `MAP_ONLY`; sai com *Limpar campo*; trocar o grid **não apaga** (como as pontes).

### Interface

- Ferramenta **Escada** no painel *Construir* (ícone Tabler e atalho escolhidos na implementação), com:
  - formato *Escada / Caracol / De mão*;
  - material *Pedra / Madeira* (some na de mão);
  - largura *1 / 2 / 3* (na escada) ou diâmetro *1 / 2 / 3* (no caracol; o mesmo campo `width`);
  - sentido *Sobe / Desce* (com a dica de que no relevo a altura decide);
  - *Desfazer* e uma dica com os cliques.
- **Escada:** clique no pé (num lugar sem escada; em cima de uma escada, o clique escolhe — **Shift+clique** começa uma nova mesmo ali) *(chamada minha)*, clique em cada virada, **dois cliques** (ou Enter) no topo; Esc cancela; Backspace tira o último ponto enquanto desenha. A prévia mostra a escada enquanto desenha.
- **Caracol:** clique no centro e arraste até a borda (diâmetro e primeiro degrau). **De mão:** clique no pé e arraste até o topo, como a ponte.
- Os pontos **encaixam no meio das casas e nas linhas** (meia casa); com **Shift** solto, ficam livres (como as alças das pontes) *(chamada minha)*.
- **Editar:** com a ferramenta aberta, clique simples numa escada escolhe; a escolhida mostra alças nos pontos (arrastar move). Na escada **escolhida**: clique no meio de um trecho dela acrescenta um ponto ali; clique direito numa alça tira o ponto (mínimo 2). O painel troca o resto. Delete apaga a escada.
- Textos novos no `pt-BR.ts`, traduzidos em `en.ts` e `es.ts`.

### Desenho (placa de vídeo)

- Um passo novo no renderizador do chão, **por cima da camada do relevo e das pontes**, por baixo das paredes, objetos e tokens. Camada guardada como a das pontes (refeita quando a visão, as escadas, a água, o relevo ou a luz mudam).
- **Caminho da escada:** a linha de pontos com as viradas arredondadas (raio que caiba nos dois trechos); os degraus ficam perpendiculares à linha e, na curva, em leque (mais estreitos do lado de dentro).
- **Altura ao longo do caminho** *(chamada minha)*:
  - a altura do chão é lida do relevo (o mesmo campo de altura que o relevo usa) ao longo da linha do meio;
  - **a escada segue o chão** (combinado): num vale, desce até o fundo e sobe do outro lado; num morro, sobe e desce. Para atravessar o vão por cima existe a ponte;
  - a escada é o perfil do chão **"em escada"**: onde a altura sobe, degraus de altura fixa (alguns por nível); onde ela fica plana por mais de ~1 casa, patamar;
  - **lance mais deitado que o penhasco** (aprovado no teste): cada lance ocupa pelo menos **2,2 casas por nível**, centrado na subida do chão; em cima ele fica **cavado** no patamar (rocha dos dois lados; num morro suave, barranco de terra), embaixo fica **construído** (lateral de alvenaria ou madeira e sombra). É o que tira a cara de colada;
  - **10 degraus por nível**, todos iguais no lance; as paredes cavadas, a lateral e a sombra seguem a rampa do lance (lisa), não os degraus;
  - a escada nunca desce abaixo do chão; onde fica acima dele, aparece a lateral até o chão e a sombra deslocada pelo sol (a mesma conta das pontes, `shadowCells × 1,6` por nível).
- **Quando é solta** *(chamada minha)*: se a altura do chão varia menos de **0,25 nível** em todo o caminho. Basta um morro ou penhasco no meio para ela seguir o relevo.
- O desenho não depende de qual ponta foi clicada primeiro no relevo: a escada só segue o chão. Na solta, o sentido *Sobe/Desce* vale a partir do pé (o primeiro clique).
- **Patamar de madeira** com tábuas atravessadas (na curva, em leque, como os degraus); patamar de pedra em lajes.
- **Escada solta:** degraus iguais ao longo do caminho, como se subisse ou descesse ~1 nível; a ponta final clareia e acaba numa borda cortada com sombra (sobe) ou escurece até um buraco com borda de alçapão (desce). Na que desce, as paredes do poço são retas e finas (~0,1 casa) e o escurecer é do próprio desenho da escada (é ele que diz "desce"); a luz da cena é a do mapa.
- **Escada de mão no relevo** (aprovado no teste): o pé fica na base da face, assentado no chão (mancha de contato), e o topo passa da borda com dois ganchos de ferro; abre um pouco para cima; halo escuro de contato com a rocha e sombra rente. Solta: dentro de um alçapão com a tampa aberta ao lado, escurecendo para o fundo.
- **Luz e sombras de fora:** a escada vem antes do passo de luz do mapa, que multiplica tudo por cima (sombra do relevo e tochas sem nada novo). Não bloqueia a luz das tochas.
- **Detalhe** como na página de teste aprovada: espelho de cada degrau mais escuro que o piso (luz pela direção), aresta do degrau clara, pedra com blocos e juntas, madeira com veio; mureta ou corrimão nas bordas; na rocha cortada, a rocha dos dois lados.

### Grid hexagonal

Funciona no hex como as pontes (pontos em casas da malha quadrada por baixo; encaixe na malha quadrada).

### Sem WebGL 2 *(chamada minha)*

Desenho simples no processador: o caminho em cor chapada do material com os degraus riscados; caracol como círculo com raios; escada de mão como dois trilhos com travessas.

## Página de teste

`docs/design/escadas-teste.html`, sozinha (WebGL 2, como as das pontes), com a luz da cena trocável. Mostra:

1. escada de pedra em ziguezague subindo um penhasco de 2 níveis, com patamares;
2. escada de madeira em curva subindo uma encosta suave;
3. escada cortando o penhasco de frente (degraus cavados na rocha);
4. dentro de um cômodo: escada reta solta subindo (borda cortada) e outra descendo (alçapão);
5. caracol subindo e caracol descendo;
6. escada de mão encostada no penhasco e outra saindo de um alçapão.

## Fica para o construtor

- Nomes dos campos, ações, chaves de texto, ícone e atalho.
- Como passar o caminho à placa (uniforms ou textura) e como amostrar a altura ao longo dele.
- Quantos degraus por nível, raio das viradas, cores, ruído e proporções, desde que fiquem iguais à página de teste aprovada.
- Como desenhar as alças e a prévia (Konva por cima, como as pontes).
