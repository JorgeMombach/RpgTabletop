# Pontes e píer

Combinado em 2026-11-19, com o dono do projeto, na branch `feat/campanha`. Segunda parte do terceiro projeto de "construção" do mapa (1. [paredes](paredes.md), feito; 2. [relevo](relevo.md), feito; **3. estruturas**: [pisos](pisos.md), feito; **pontes e píer**; depois escadas). Teste aprovado: `docs/design/pontes-teste.html` (a segunda versão, com as pontes pousadas nas margens).

## Por quê

O mestre monta vilas na beira do rio, estradas que cruzam riachos e cânions do *Relevo*. Hoje a única ponte é o objeto "ponte de tábuas" (*Objetos*): um desenho de tamanho fixo que não acompanha o rio, não pega a luz da cena como o chão e não tem altura. O píer é o *Piso* pintado sobre a água, um deck chapado. O dono quer pontes e píer no mesmo padrão do resto do chão (Full HD em qualquer zoom, desenhado pela placa de vídeo) e que **pareçam apoiados**: a primeira versão do teste foi recusada porque as pontes pareciam "voando em cima do mapa".

## O que é

Uma ferramenta **Ponte** no painel *Construir*: o mestre escolhe o tipo e a largura, clica numa margem e arrasta até a outra; a ponte estica do tamanho certo. O **píer** é o *Piso* de tábuas pintado sobre a água, que ganha sozinho as estacas, a sombra e a água escura embaixo.

### Metas

- Três tipos: **tábuas** (madeira, corrimão de pau com postes), **pedra em arco** (calçamento, muretas de blocos), **corda** (tábuas amarradas com folga, duas cordas com nós).
- Largura de **1, 2 ou 3 casas**.
- **Pousada no chão:** nas margens a ponte encosta no chão (altura zero); só sobre a água ou o vão ela sobe, e a sombra só aparece ali. Em volta de onde pousa, um escurecido de contato; nas pontas, um caminho gasto chegando.
- **Cabeceiras:** na pedra, as muretas se abrem em diagonal para dentro da margem e o calçamento continua até virar terra batida; nas tábuas, uma travessa grossa assentada em cada ponta; na corda, dois postes de amarração em cada ponta com a corda até o tabuleiro.
- **Altura pela cena:** sobre a água, a ponte fica um pouco acima (sombra curta na água); sobre um cânion do *Relevo*, a sombra cai lá no fundo, longe, e na corda segue a barriga das cordas.
- **Espessura:** a beirada do tabuleiro com face clara do lado do sol e escura do outro, mais forte onde há vão embaixo.
- **Píer:** onde o piso de tábuas fica sobre a água, aparecem estacas saindo um pouco das bordas (com espuma em volta), a água embaixo escurece e há uma sombra curta. O píer começa pousado na margem.
- Luz da cena (dia, entardecer, luar, noite) e nitidez em qualquer zoom, como o piso.
- Colocar, mover as pontas, trocar tipo e largura, apagar, *Desfazer*; cada cena com as suas, no arquivo de sessão, *Limpar campo* apaga.
- Todos veem as pontes (por baixo da névoa, como o chão).

### Não metas

- Não muda régua, visão, movimento nem névoa: é só visual (ADR-06). Token em cima da ponte é só desenho.
- Não faz ponte quebrada, ponte levadiça, degraus nem escadas (as escadas são o projeto seguinte).
- Não liga a ponte à água ou ao relevo: se o rio muda, a ponte fica onde foi posta (a altura e a sombra se ajustam sozinhas ao que estiver embaixo).
- O objeto "ponte de tábuas" continua existindo, sem mudança.

### Anti-metas (seria um fracasso mesmo funcionando)

- Ponte que parece **flutuar**: sombra deslocada também nas pontas, sem contato com o chão, sem cabeceira.
- Cara de imagem colada ou de baixa resolução.
- Píer que parece um tapete sobre a água.

## Caminhos considerados

- **A. Peça nova do mapa, desenhada na placa de vídeo (escolhido).** Cada ponte guardada como as paredes (pontas, largura, tipo), desenhada por um passo novo do renderizador do chão, com a luz da cena e a sombra pela altura do que está embaixo. O píer fica no passo do piso.
- **B. Esticar o objeto "ponte de tábuas".** Rápido, mas com a cara dos objetos (imagem pronta no processador), sem a luz do chão, com sombra falsa e menos nítida de perto: contraria o padrão de nitidez combinado.
- **C. Ponte como material do piso.** A ponte tem sentido, laterais, cabeceiras e (na corda) barriga; a grade fina do piso não sabe nada disso.

## Como fica

### Dados

- `bridges: Bridge[]` por cena: `{ id, from: { x, y }, to: { x, y }, width: 1 | 2 | 3, kind: "plank" | "stone" | "rope" }`, pontas em casas (a linha do meio do tabuleiro, de ponta a ponta).
- Limites: até **64 pontes** por cena; comprimento de **1 a 40 casas** *(chamadas minhas)*.
- Ponte nova vai no fim da lista (desenhada por cima das anteriores onde se cruzam).

### Ações (servidor valida tudo, só o mestre)

- `bridge:add` (pontas, largura, tipo), `bridge:update` (pontas, largura ou tipo de uma ponte), `bridge:remove` (ids). *Desfazer* no cliente com essas mesmas ações (como as paredes).
- Recusas em português, como modelo traduzido (`serverText.ts`): ponte curta ou longa demais, limite da cena, ponte que não existe, dado inválido.
- A ponte vai no estado da cena (como as paredes), no arquivo de sessão (ida e volta) e sai com *Limpar campo*. Trocar o grid **não apaga** as pontes *(chamada minha)*: são peças em casas, como os objetos.

### Interface

- Ferramenta **Ponte** no painel *Construir* (ícone Tabler e atalho escolhidos na implementação), com:
  - os três tipos em botões com amostra;
  - largura *1 / 2 / 3*;
  - *Desfazer* e uma dica.
- **Colocar:** clicar numa margem e arrastar até a outra; a prévia mostra a ponte enquanto arrasta. As pontas **encaixam no meio das casas e nas linhas** (meia casa), para a ponte de largura 1 ou 3 correr no meio das casas e a de 2 sobre a linha; com **Shift**, ficam livres *(chamada minha)*.
- **Editar:** com a ferramenta aberta, um clique simples numa ponte escolhe (arrastar sempre começa uma ponte nova, mesmo começando em cima de outra) *(chamada minha)*; a escolhida mostra alças nas pontas (arrastar move a ponta), o painel troca o tipo e a largura dela, e Delete apaga.
- Textos novos no `pt-BR.ts`, traduzidos em `en.ts` e `es.ts`.

### Desenho (placa de vídeo)

- Um passo novo no renderizador do chão, **por cima da camada do relevo** (a ponte passa por cima da face do penhasco) e por baixo das paredes, dos objetos e dos tokens. Camada guardada como a do piso (refeita quando a visão, as pontes, a água, o relevo ou a luz mudam).
- **Altura sob cada ponto do tabuleiro** *(chamada minha)*:
  - o **nível de cada ponta** é o nível do relevo no ponto da ponta (o mesmo campo de altura que o relevo usa); o tabuleiro vai em **rampa** de uma ponta à outra;
  - a altura do tabuleiro sobre o chão embaixo é a diferença entre a rampa e o chão ali; **nunca negativa**: se o chão sobe acima do tabuleiro (um morro no meio), a ponte acompanha o chão (altura zero, pousada), sem cortá-lo;
  - sobre a água (ponto com pelo menos metade de água no terreno), soma um pouco acima da água: tábuas ~0,3 casa, pedra ~0,55, corda ~0,12, píer ~0,2;
  - o chão embaixo vem dos dados que o renderizador já tem (o peso da água do terreno e a altura do relevo).
- **Luz e sombras de fora:** a ponte é desenhada antes do passo de luz do mapa, que multiplica tudo por cima: a sombra do relevo (penhasco) cai sobre o tabuleiro e as tochas o iluminam sem nada novo. A ponte não bloqueia a luz das tochas (como o piso) *(chamada minha)*.
- **Sombra:** no chão embaixo, deslocada pelo sol da cena na medida dessa altura (nas pontas, sem deslocamento); a corda deixa passar luz entre as tábuas. Contato: escurecido justo em volta de onde a ponte pousa.
- **Detalhe** como na página de teste: tábuas com veio e frestas (vê-se a água embaixo), vigas e postes; calçamento e muretas de blocos com aresta clara; tábuas velhas e cordas trançadas; cabeceiras e caminho gasto nas pontas. Luz relativa como o piso; de longe, o detalhe fino vira a média.
- **Píer** (no passo do piso): onde o piso de **tábuas** fica sobre a água (ponto com pelo menos metade de água no terreno), as estacas aparecem nos pontos da borda do piso, numa grade de 1 casa (saindo um pouco para fora), com espuma em volta, a água embaixo escurece e há sombra curta; sobre terra, o píer pousa (altura zero), pela mesma regra da ponte *(chamada minha)*. Vale também para os mapas salvos com piso de tábuas sobre a água: ganham as estacas sozinhos (combinado: "o píer é o *Piso*"). Piso de pedra, ladrilho ou mosaico sobre a água ganha uma borda de cais (face de pedra descendo até a água) em vez de estacas; o tapete fica como está.

### Grid hexagonal

As pontes funcionam no hex (pontas em casas da malha quadrada por baixo, como o piso); o encaixe das pontas usa a malha quadrada.

### Sem WebGL 2 *(chamada minha)*

Desenho simples no processador: o tabuleiro em cor chapada do tipo, com as tábuas riscadas, sem sombra nem cabeceira.

## Fica para o construtor

- Nomes dos campos, ações, chaves de texto, ícone e atalho.
- Como amostrar a água e o relevo embaixo do tabuleiro no shader, e o formato da lista de pontes na placa (uniform ou textura).
- Valores finos de cor, ruído e proporções, desde que fiquem iguais à página de teste aprovada.
- Como desenhar as alças e a prévia (Konva por cima, como as paredes).
