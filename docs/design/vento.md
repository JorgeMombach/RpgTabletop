# Vento nas plantas (criação de mapa, mapa vivo, parte 1)

Combinado em 2026-11-16, em brainstorm com o dono do projeto, na branch `feat/campanha`. É a primeira parte do "mapa vivo" (entrega 3 da criação de mapa; o terreno pintado foi a 1). Água animada (rios, espuma) fica para outra parte, com desenho próprio.

Teste que decidiu o visual e o movimento: [`vento-teste.html`](vento-teste.html), cópia da página aprovada (`Árvores vivas: teste`). É a referência do algoritmo, não código para colar: a coluna "Hoje (parada)" dependia de um pacote do teste que não foi copiado, e a grama de fundo vem de `client/public/terreno/grass_01.webp`.

## Por quê

O dono quer o mapa vivo, como nos mapas animados que viu (2-Minute Tabletop, Nimblehold): árvores e plantas mexendo com o vento. O caminho foi decidido em testes:

- **Blender (modelo 3D fotografado de cima): descartado.** O volume virou "brócolis".
- **Ilustração com traço de tinta (copa em nuvem, contorno escuro): descartada para as copas.** Também pareceu brócolis; o dono prefere a árvore de hoje, que "parece árvore". A **palmeira** desse teste foi aprovada e entra.
- **Escolhido: o desenho de folhas de hoje, separado em camadas que balançam.** Aprovado no teste.

## Objetivos

- **Árvore, arbusto e flores** (já existem) balançam com o vento: a copa separada em duas camadas, a de cima atrasa um pouco e vai mais longe que a de baixo (folhagem escorregando sobre folhagem), a sombra no chão acompanha a de baixo. Algumas folhas claras "piscam" (viram para a luz e voltam), mais na rajada.
- **A rajada atravessa o mapa:** o tempo de cada planta é atrasado pela posição dela (como no teste: `t - x/(8 casas) - y/(20 casas)`), então vizinhas balançam quase juntas, como uma onda de vento, e não cada uma no seu ritmo.
- **Três objetos novos que balançam:**
  - **Pinheiro** (`pine`): andares de agulhas soltas com borda irregular, cada andar com sombra sobre o de baixo, luz em cima à esquerda; os andares de cima balançam mais. Desenho do teste (`layeredPine`).
  - **Palmeira** (`palm`): folhas recortadas com nervura e contorno escuro, do teste (`drawPalm`), balançando inteira.
  - **Grama alta** (`tallGrass`): tufo de folhas finas visto de cima (riscos curvos saindo do meio), no tom da paleta de folhas. Só as pontas balançam: base numa camada parada, pontas na camada que se mexe. Desenho novo, decidido no navegador com o dono.
- **Pincel de espalhar:** a *Floresta* passa a ter pinheiros; conjunto novo **Campo** (grama alta, flores, um ou outro arbusto e pedra).
- **Cogumelos não balançam** (são duros; balançando ficaria estranho).

## De onde vem o vento

- Sempre uma **brisa leve** (força 1, a do teste com o controle no meio).
- Quando o clima da cena (E26, `WeatherState`) é de vento — **vento com folhas, nevasca, tempestade de areia, tempestade** — as plantas balançam mais forte: força `1 + intensidade` do clima. A direção segue o sinal de `wind` do clima (negativo = para a esquerda); sem clima, ou com `wind` 0, para a direita.
- Nenhum controle novo para o mestre.

## Fora do escopo

- Água animada, rios, espuma: parte seguinte do mapa vivo.
- Redesenhar os objetos que não são plantas.
- Vento interagindo com tokens, efeitos ou partículas do clima.
- Som de vento nas folhas.

## Para não fazer (falharia mesmo funcionando)

- **Mudar a cara das árvores que já estão nos mapas.** A árvore, o arbusto e as flores com uma semente têm que sair idênticos aos de hoje, parados. Atenção: no teste, a escolha das folhas que piscam consome números do mesmo sorteio das folhas (`random() < 0.08`), o que muda o resto do desenho; no app, essa escolha usa um sorteio à parte.
- **Mesa engasgando:** o mapa com uma floresta grande (300 árvores) continua fluido para arrastar, dar zoom e mover tokens, no notebook do mestre e no celular do jogador.
- **Plantas em sincronia perfeita** (todas iguais ao mesmo tempo) ou **cada uma num ritmo sem relação** (parece tremedeira).
- **Balanço que gira com o objeto:** o vento é do mapa. Uma árvore girada 90° balança na mesma direção que a vizinha.
- **Mandar o vento pela rede:** cada tela calcula pelo próprio relógio; o estado não muda.

## Restrições

- Mapa em Konva (`react-konva`); objetos em `client/src/map/MapProps.tsx` (`PropNode`, um `Image` por objeto com a imagem guardada de `propImage`), desenhos em `propArt.ts`/`propArtMore.ts`.
- Edição de objetos continua igual: arrastar (Shift encaixa), alças de tamanho e giro (`Transformer`), clique no miolo (`hitFunc`), copa meio transparente com token embaixo (`faded`).
- **Reduzir efeitos** ligado: tudo parado, como hoje (uma imagem por objeto).
- O ícone do catálogo (`PropIcon`) e a imagem parada usam o mesmo desenho das camadas, juntas; o desenho em camadas é a fonte, não uma cópia.
- Objeto novo = `PROP_KINDS`, `PROP_DEFAULTS`, rótulo em `pt-BR.ts`/`en.ts`/`es.ts`, `PROP_EXTENT`, `ROOM` do pincel; o servidor já valida pelo `PROP_KINDS` e o arquivo de sessão já guarda qualquer objeto (`parseProp`).
- Sem `any` nem cast forçado; comentários em português, na densidade do arquivo.

## Abordagens (para o desenho no mapa)

- **A. Cada planta vira um grupo de 2 ou 3 imagens (sombra, copa de baixo, copa de cima) mexidas por um relógio único (escolhida).** Reaproveita a edição de hoje no mesmo nó (arrastar, alças, transparência). Custo: ~3 imagens por planta redesenhadas por quadro; contido limitando os quadros e animando só o que está na tela.
- B. Uma pintura única (`Shape`) desenhando todas as plantas por quadro, como os efeitos: mais leve com muitas plantas, mas a edição teria que ser imitada por uma camada invisível por fora (mais código, risco de desencontro).

## Decidido

- **Objetos padrão dos novos** (camada, visão, pé): pinheiro por cima dos tokens, atrapalha a visão, pé 0,25; palmeira por cima dos tokens, não atrapalha, pé 0,15; grama alta por baixo, não atrapalha, pé 0,3. *(Chamada minha; o dono pode trocar.)*
- **Campo** no pincel: grama alta (peso 6), flores (2), arbusto (1), pedras (0,3). *(Chamada minha.)*
- **Folhas que piscam:** só na camada de cima, ~8% das folhas claras (tons 2 e 3), cor `#b5dc78`, como no teste.
- **Quadros:** a animação das plantas roda no máximo a 30 por segundo e para quando a aba some ou não há planta visível.
- **Aparelho que não aguenta: o vento desliga sozinho (decisão do dono).** Se a tela começar a perder quadros com as plantas animadas, o vento para naquele aparelho (fica como no *Reduzir efeitos*, só para as plantas). Cada aparelho decide por si: um jogador pode ver as plantas paradas enquanto outro vê balançando; o conteúdo do mapa é o mesmo. O limite exato (quantos quadros perdidos, por quanto tempo, se volta a tentar) fica com quem implementa, medido no navegador.
- **"Igual a hoje, parada" é igual ao olho, não pixel a pixel.** A imagem parada (Reduzir efeitos, ícone do catálogo) é desenhada numa imagem só, juntando as camadas; o que importa é a mesma árvore (mesmas folhas, mesmas cores, mesmo tamanho), não o serrilhado. *(Chamada minha.)*
- **Com a ferramenta Objetos ativa, as plantas ficam paradas.** Assim as alças e o clique não "escorregam" do desenho enquanto o mestre escolhe, arrasta ou gira. *(Chamada minha.)*
- **Arbusto e flores em camadas:** no arbusto, as frutinhas vão na camada de cima (junto com os blocos de cima); nas flores, folhas e hastes ficam na camada de baixo e as flores (miolo e pétalas) na de cima. A ordem do sorteio do desenho não muda. *(Chamada minha.)*

## Fica com quem implementa

- Desenho exato da grama alta e o tamanho/força finais do balanço de cada tipo: no navegador, com o dono olhando.
- Como compor o grupo com o giro do objeto (o vento no espaço do mapa, o desenho girado) sem quebrar as alças do `Transformer`.
- Como guardar as camadas em cache (hoje `propImage` guarda até 600 imagens; com camadas são até 3 por planta) e o limite de memória.
- Como medir "só o que está na tela" (recorte pela visão do palco).
