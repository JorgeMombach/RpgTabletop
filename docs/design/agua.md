# Água animada (criação de mapa, mapa vivo, parte 2)

Combinado em 2026-11-17, em brainstorm com o dono do projeto, na branch `feat/campanha`. Segunda parte do "mapa vivo" (a primeira foi o [vento nas plantas](vento.md)). Vem por cima do [terreno pintado](terreno.md).

Teste que decidiu o visual e o movimento: [`agua-teste.html`](agua-teste.html), cópia da página aprovada (*Água (shader): teste 2*). É a referência do shader e das contas, não código para colar: ela usa uma máscara desenhada à mão (rio em curva de Bézier, lago em elipse) e as texturas `grass_01`, `dirt_01` e `stone_01` de `client/public/terreno/` ao lado dela.

## Por quê

O dono quer um mapa com qualidade de jogo, como o Nimblehold e o 2-Minute Tabletop: tudo bonito, vivo e customizável. A água hoje é tinta de terreno parada (aquarela com reflexos desenhados). Ela deve **parecer água**: rio que corre, lago que ondula, e **profundidade** — a água numa baixada em relação à terra, com barranco, porque o relevo vem depois e a água já tem que estar pronta para ele.

A animação é a prioridade. Pode pesar mais na placa de vídeo; o dono liberou tecnologia nova para a parte de mapa.

## O que foi decidido nos testes

- **Shader WebGL**, não canvas 2D: correnteza, brilho, cáusticas, espuma e sombra calculados por pixel na placa de vídeo.
- **Correnteza sem "reset"**: o rio tem coordenadas próprias (quanto andou ao longo da linha e de que lado dela está); o desenho da água escorre nessa coordenada para sempre. A primeira tentativa (técnica de duas fases que se revezam) foi reprovada: "vem em pedaço, reseta, vem de novo".
- **Profundidade por altura**: cada ponto tem uma altura (grama em 0, barranco descendo, fundo da água mais baixo). Luz, sombra, cor do barranco e transparência da água saem dessa altura. A faixa de areia chapada da primeira tentativa foi reprovada ("parece que eu fiz no Paint").
- **Distância exata** até a margem, em boa resolução, com a beira tremida por ruído (sem degraus de pixel).

## Objetivos

- **Rio**: onde o mestre riscou uma **linha de correnteza**, a água corre no sentido da linha, seguindo as curvas. O meio corre mais que as margens (duas camadas de água, lenta e rápida, misturadas pela distância da linha). Superfície com redemoinhos suaves (ruído torcido por outro ruído). Espuma perto das margens e uma **esteira** rio abaixo de cada pedra. No fim da linha, a correnteza perde força e se abre (rio que deságua num lago).
- **Lago** (água longe de qualquer linha, sem nada a configurar): deriva lenta; de vez em quando uma ondinha nasce na margem e entra, sumindo.
- **Profundidade e barranco** (rio e lago): a água fica abaixo da terra. Na margem virada para a luz (luz de cima à esquerda, como o resto do mapa), o talude de terra aparece claro; do outro lado, escuro, e a terra joga **sombra** dentro d'água. Terra do barranco em camadas suaves, com a grama avançando irregular sobre a crista. O fundo raso aparece por baixo da água (a água emenda no barranco sem contorno) e escurece até turquesa funda no meio. *Água funda* (terreno `waterDark`) é mais funda que *Água*.
- **Superfície**: ondulação, poucos brilhos de luz, reflexo do céu, cáusticas no raso.
- **Ferramenta Correnteza (mestre)**: modo novo na ferramenta *Terreno*. Arrastando, risca uma linha no sentido em que a água corre (vista com setas enquanto a ferramenta está aberta; invisível no resto do tempo e para os jogadores). Borracha apaga as linhas tocadas. Desfazer (Ctrl+Z) como nas outras ferramentas do mapa.
- **Pedras no rio**: o objeto *Pedras* (`stones`) e o *Pedregulho* (`boulder`) postos sobre a água viram cúpulas no relevo da água: espuma em volta e esteira rio abaixo. *(Chamada minha: no teste as pedras eram parte da máscara; no app, os objetos já existem e o mestre já sabe pô-los.)*

## Fora do escopo

- Relevo (morros, buracos, penhascos): parte própria. Aqui só a água cria a baixada; o código deixa a altura pronta para o relevo somar.
- Cachoeiras, pontes automáticas, rio que nasce da borda do mapa com efeito especial, velocidade por linha.
- Água como regra de jogo (afogar, nadar, terreno difícil) — ADR-06.
- Reflexo de tokens e objetos na água, ondas quando um token anda na água.
- Trocar o motor do mapa inteiro para WebGL (abordagem C abaixo): previsto para o futuro, não agora.

## Para não fazer (falharia mesmo funcionando)

- Correnteza que pulsa, volta ou reseta; qualquer coisa que pule a cada quadro.
- Faixa de cor chapada como barranco; contorno marcado em volta da água.
- Mesa engasgando: a água não pode derrubar o desempenho de pan, zoom e movimento de token.
- Redesenhar a camada da mesa inteira (couro, imagem, terreno, grid) a cada quadro da água.
- Mandar dado novo a cada quadro pela rede: o movimento é calculado em cada tela.

## Restrições

- Mapa em Konva (`react-konva`). Hoje a primeira `Layer` de `BattleMap.tsx` tem, nesta ordem: mesa, imagem do mapa, `TerrainLayer`, borda, grid. A água fica **entre o terreno e o grid**, abaixo de efeitos, objetos, névoa e tokens.
- Terreno: grade fina de `TERRAIN_FINE = 4` pontos por casa, pedaços de 8 × 8 casas, um byte por terreno por ponto (`shared/src/terrain.ts`), canal próprio (evento `terrain`, não vai no `state:full`).
- *Reduzir efeitos*, detector de aparelho lento (`FrameWatch`, do vento) e navegador sem WebGL 2: a água fica **parada** (o mesmo desenho, um quadro só, sem animação); sem WebGL 2, a água é a tinta do terreno de hoje.
- Nada persistido além do que vai no arquivo de sessão (ADR-04). Linhas de correnteza vão na cena e no arquivo de sessão (ida e volta, `save-guard`).
- Permissões no servidor: só o mestre risca e apaga correnteza.
- Sem `any` nem cast forçado; textos em `pt-BR.ts`, `en.ts`, `es.ts`; recusas do servidor como modelo traduzido em `serverText.ts`.

## Abordagens

- A. Continuar no canvas 2D: sem nada novo, mas no limite do que já foi visto (cara de canvas) e caro por pixel.
- **B. Shader WebGL só para a água, dentro do mapa atual (escolhida).** Qualidade de jogo onde importa agora, prepara o relevo, não mexe no resto do mapa. O shader fica num módulo isolado, sem depender do Konva, para ir junto quando o mapa trocar de motor.
- C. Trocar o motor do mapa inteiro por WebGL (PixiJS ou similar): teto mais alto para tudo, mas reescreve o mapa inteiro antes de ver água. **O dono quer chegar nela depois**, para ter mais liberdade gráfica; a água é o primeiro pedaço.

## Decidido

- **Dado novo da cena**: `battle.currents: WaterCurrent[]`, com `WaterCurrent = { id: string; points: number[] }` (pares x, y em casas, centésimos, no sentido da correnteza; mínimo 2 pontos). Vai no `state:full` (é pequeno), em cada cena e no arquivo de sessão. Todos recebem (o jogador vê a água correr; a linha em si só aparece com a ferramenta). Limites *(chamada minha)*: 60 linhas por cena, 200 pontos por linha.
- **Ações**: `current:add { points }` e `current:remove { ids }`, só o mestre; desfazer pelo navegador do mestre, como desenhos e paredes.
- **Força da correnteza sem parâmetro**: a influência de uma linha vai até um pouco além da meia largura do rio naquele ponto (a distância até a margem medida na própria linha) e some depois disso; no último trecho da linha (~18%) a força cai até perto de zero. Água sem linha por perto = lago.
- **Contas puras no `shared`** (testadas em `server/test/`): máscara da água a partir dos pedaços do terreno (soma de `water` + `waterDark` acima de meio, com `waterDark` aprofundando), distância com sinal exata (Felzenszwalb, como no teste) e coordenadas do rio (ao longo, de que lado, força). O cliente roda essas contas fora do quadro (Web Worker ou em fatias) e só quando a água ou as linhas mudam.
- **Camadas**: o grid (e a borda) saem da primeira `Layer` para uma `Layer` logo acima; a água ganha a sua `Layer` entre as duas. Só a camada da água é redesenhada a cada quadro. *(Chamada minha.)*
- **Módulo isolado**: o renderizador WebGL recebe as texturas (distância, coordenadas do rio, materiais), a transformação da visão (pan e zoom) e o tempo, e desenha num canvas do tamanho da tela; a integração com o Konva é uma peça à parte.
- **Altura pronta para o relevo**: no shader, a altura de cada ponto é uma função (`heightAt`) que hoje só depende da distância até a água; luz, sombra e normal usam essa função. O relevo vai somar a sua altura aí, sem refazer a água.
- **Pedras**: objetos `stones` e `boulder` com o centro dentro da água entram como cúpulas no relevo da água (altura e raio a partir do tamanho do objeto); o desenho do objeto continua por cima.
- **O barranco entra na água pintada (decisão do dono).** O pincel de água marca a baixada inteira: da borda pintada, o barranco desce (uns 0,3 a 0,6 casa) até onde a água começa. Fora do que foi pintado, nada é coberto: a borda de fora do barranco se mistura com o que estiver ao lado (aquarela do terreno, imagem do mapa ou mesa), e a sombra que o barranco joga sobre a terra de fora, se houver, é só um escurecido transparente. Diferente do teste, em que o barranco avançava sobre a terra: no app, a altura 0 (a crista) fica na borda pintada, e a água visível começa a uma largura de barranco para dentro. Material do barranco: terra em camadas, como no teste, combinando com a aquarela de terra do terreno.
- **Pintando**: enquanto o mestre arrasta o pincel de água ou risca uma correnteza, a prévia é a de hoje (a aquarela do terreno, e a linha com setas); a água animada é refeita quando a passada termina (chega do servidor). *(Chamada minha: refazer tudo a cada movimento do mouse pediria um cálculo incremental sem ganho visível.)*
- **Com WebGL 2**, o `TerrainLayer` deixa de desenhar a aquarela da água (o shader desenha a água); sem WebGL 2, continua como hoje. *(Chamada minha.)*
- **Pedras**: só contam as de centro dentro da água. As linhas de correnteza não passam pelo filtro de `view.ts` (o terreno também não passa). *(Chamadas minhas.)*
- **Quadros**: no máximo 30 por segundo; só onde há água na tela; resolução limitada à densidade da tela até 1,5×. *(Chamada minha.)*

## Fica com quem implementa

- Resolução da distância e das coordenadas do rio (o teste usou 1 px de tela por pixel a zoom 1; no app, por casa, algo como 16 a 24 pontos por casa) e onde guardar quando o mapa é grande (só em volta da água).
- Como levar o canvas WebGL para a camada do Konva (imagem atualizada por quadro ou canvas próprio na pilha de camadas) mantendo pan e zoom sincronizados.
- Material do barranco e do fundo combinando com a aquarela do terreno de cada lado (grama, terra, pedra) — no teste o chão era só grama.
- Números finos (cores, velocidades, larguras, espuma): decididos no navegador, com o dono olhando, partindo dos do teste.
