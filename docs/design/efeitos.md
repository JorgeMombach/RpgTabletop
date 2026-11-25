# Efeitos de área na placa de vídeo

Combinado em 2026-11-24, com o dono do projeto, na branch `feat/objetos`. É a **etapa 4, parte 1** da troca de motor do mapa (1. [objetos](objetos.md), 2. [sombra por objeto](sombras.md) e 3. [névoa](nevoa.md), feitas; **4. efeitos e clima**: parte 1 os efeitos de área, parte 2 o clima vivendo no mapa). Tudo sai numa versão só. Teste aprovado em [efeitos-teste.html](efeitos-teste.html) (código em [efeitos-teste.ts](efeitos-teste.ts)).

## Por quê

O mapa está indo inteiro para o padrão de nitidez do chão. Os efeitos de hoje (`EffectShape.tsx`, `effectFx.ts`, `effectTextures.ts`) destoam e pesam:

- **Ladrilhos repetidos:** cada área é desenhada no Konva com ladrilhos de ruído de 256 px e partículas numa lista que o processador anima a cada quadro.
- **Recorte borrado:** a borda vem de uma máscara borrada refeita no processador.
- **Peso:** na página de teste, 5,8 ms por quadro com 8 áreas.
- **Não mexem na luz:** à noite o fogo não ilumina nada, e a escuridão é só uma mancha preta.

O dono quer os efeitos bonitos e **cuidando do desempenho** ("cuide da performance; no futuro vou querer atacar esse ponto ainda").

## O que é

Um passo de efeitos no renderizador do chão:
- **Recorte:** cada área tem uma máscara feita uma vez (a forma rasterizada, com níveis menores para a borda macia).
- **Desenho:** um shader por tipo, desenhado numa caixa justa em volta da forma.
- **Partículas:** fagulhas, bolhas, raios e luzinhas são calculadas no próprio shader a partir do tempo, sem lista no processador.
- **Luz:** os efeitos que iluminam de verdade viram fontes de luz no passo da luz, e a escuridão apaga a luz.

### Metas

- **Cada efeito faz o que faria de verdade com a luz** (decisão do dono: "depende do efeito, se ele naturalmente iluminar, então sim"):

  | Efeito | Na luz do mapa |
  |---|---|
  | Fogo | ilumina, laranja tremulando |
  | Luz sagrada | ilumina, dourada calma |
  | Eletricidade | ilumina, azulada piscando |
  | Gás tóxico, ácido | brilho fraco, só de perto *(chamada minha)* |
  | Escuridão | **apaga** a luz dentro dela, inclusive a de tochas |
  | Os outros | não mexem na luz |

  A luz dos efeitos é barrada pelas paredes. Objetos e tokens fazem sombra dela como da tocha, a partir do meio da área.
- **O visual aprovado na página de teste**, tipo por tipo (fogo, água, gelo, gás tóxico, escuridão, teia, luz sagrada, eletricidade):
  - **Fogo:** "fogo, não lava". Labaredas altas e finas subindo rápido, com buracos onde o chão aparece; amarelo só no miolo; chão chamuscado ralo, fagulhas e fumaça na beira.
  - **Luz sagrada:** como a de hoje, pedida pelo dono. Riscos de luz girando no chão, seis luzinhas com rastro rondando a borda e brilho que respira no meio. A ronda é a elipse da caixa da forma, então funciona em qualquer formato.
  - **Gelo:** superfície lisa e translúcida, reflexo na diagonal, rachaduras longas, geada na borda e brilho em cruz que pisca.
  - **Teia:** de desenho, "a do D&D". Teias com 8 raios e anéis retos que cedem, espalhadas a cada ~2,4 casas, ligadas por fios, com sombrinha.
- **Desempenho**, medido na página no tamanho dela (1200 × 750):

  | Situação | Tempo da placa por quadro |
  |---|---|
  | Efeitos novos, 8 áreas | ~1 ms |
  | Efeitos novos, 40 áreas (pior caso) | ~3,5 ms |
  | Efeitos de hoje, 8 áreas | 5,8 ms |

  Nenhum trabalho por quadro no processador além de mandar os números de cada área.
- **"Reduzir efeitos"** e aparelho lento: o tempo para (o efeito fica parado, a luz não tremula).

### Não metas

- **O clima:** é a parte 2.
- **Regras, duração, transformar e conjurador:** nada muda. É só desenho (ADR-06).
- **Interface:** a ferramenta de efeitos, o pincel por casas e o nome ao passar o mouse (`EffectTip`) ficam como estão.
- **Sem WebGL 2:** o desenho de hoje (`EffectShape`) continua.

### Anti-metas

- Fogo com cara de lava, um líquido em chamas no chão.
- Teia com cara de vidro trincado ou de mira.
- Os efeitos pesando mais que os de hoje, ou o mapa engasgando com muitas áreas.
- Luz de efeito atravessando parede.

## Caminhos considerados

- **Um passo de efeitos na placa**, com as partículas no shader. **Escolhido pelo dono** ("vamos de 1"). Aguenta muitas áreas, e as partículas entram na luz e na névoa da placa.
- **Superfície na placa e partículas no processador.** Descartado: com muitas áreas o processador volta a pesar, e as partículas ficam fora da luz e da névoa.

## Como fica

- **Máscara de cada área** *(chamada minha)*:
  - **Formato:** textura RGBA8 com 8 px por casa sobre a caixa da forma mais 6 casas de folga (para a luz), com níveis menores.
  - **Quando é feita:** uma vez, quando o efeito muda (forma, posição, casas pintadas, grade).
  - **De onde vêm as formas:**
    - esfera e cilindro: círculo;
    - cone, linha e cubo: o polígono de `areaPolygon`;
    - pintura por casas: os quadrados ou hexes de cada casa.
  - **Leitura:** um nível menor e 4 leituras em volta (sem os blocos do nível menor numa máscara pequena).
- **Desenho:**
  - **Caixa:** a forma mais 1,5 casa de folga, com o shader do tipo (um programa por tipo, compilado quando o tipo aparece, como os objetos).
  - **Uniforms:** a caixa da máscara, o meio e a meia caixa da forma (a ronda da luz sagrada), o tempo, uma semente por efeito e a cor do efeito.
- **Cor do efeito** *(chamada minha)*: a cor padrão do tipo desenha como na página. Uma cor trocada pelo mestre tinge o desenho pela luminância, e "Personalizado" usa a cor direto.
- **Saída e ordem das camadas:** uma imagem de saída do chão (`effects`, cor pré-multiplicada), no lugar da camada dos efeitos de hoje: acima do chão e do grid, abaixo dos tokens e da névoa. Quem brilha sozinho não sai à parte *(chamada minha)*: a luz que ele mesmo acende deixa a área dele clara à noite.
- **Luz:**
  - **Quem ilumina:** no passo da luz, cada efeito que ilumina (tabela das metas) é um leque de `lightPolygon` a partir do meio da área, parado nas paredes.
  - **Alcance:**

    | Efeito | Alcance em volta |
    |---|---|
    | Fogo, luz sagrada | 5 casas |
    | Eletricidade | 4 casas |
    | Gás tóxico, ácido | 2 casas |

  - **Força da luz:** perto, a área desfocada; mais longe, a queda com a distância ao meio menos o raio da área (sem blocos).
  - **Tremido:** fogo tremula, eletricidade pisca, sagrada é calma.
  - **Sombra de objetos e tokens:** a marcha do mapa de alturas da tocha, a partir do meio da área, com a chama a 1 casa e o raio da área como "portador" ignorado.
  - **Escuridão:** multiplica o mapa de luz por `1 − 0,93 × área` depois das luzes.
  - **Força pela cena:** a luz dos efeitos segue a da cena, como a tocha: quase nada de dia.
- **Desligado** (só o mestre vê): o desenho parado e apagado (30%); o tracejado continua no Konva.
- **Efeito que acompanha um token:** o arrasto desloca a caixa e a máscara (sem refazer a máscara).
- **Animação:** os efeitos na tela pedem quadros, como a água. Quando só eles animam, um caminho curto refaz só a imagem dos efeitos (como a névoa). A luz deles tremendo usa o caminho da luz que já existe.

## Os outros 10 tipos

Ácido, solo molhado, vapor, lama, chão chamuscado, graxa, plantas, raízes, névoa e personalizado seguem o mesmo esquema. Eles ganham um desenho no mesmo padrão e entram na página de teste para o dono aprovar **antes** de ir para o app. É a primeira tarefa do plano, com uma parada para a aprovação.

## Página de teste

[efeitos-teste.html](efeitos-teste.html):
- **Cena:** fogo perto de uma parede, água por casas pintadas, gelo, gás em cone, escuridão, teia, luz sagrada e eletricidade em linha.
- **Opções:** *Novos* ou *Hoje*, dia ou noite, 8 tipos ou 40 áreas (pior caso), zoom. O contador mostra quadros por segundo e ms da placa por quadro.
- **Aprovada em 2026-11-24**, depois dos ajustes:
  - fogo "parece lava";
  - luz sagrada "removeu a parte que ficava girandinha";
  - gelo "não gostei muito";
  - teia "parece vidro trincado".

## Fica para o construtor

- Onde a máscara de cada efeito mora (no passo dos efeitos, por id) e quando é refeita.
- Como os efeitos que iluminam chegam ao passo da luz: a lista de fontes de área junto das tochas.
- O hex nas casas pintadas e nos centros das áreas, pela geometria (`gridGeometry`).
- Medir no teste do dono antes de lançar (roteiro em `docs/pendencias.md`).
