# Pendências da branch `feat/campanha`

Roteiro para a rodada de testes e correções antes de lançar a versão. Duas partes:

- **Para testar antes de lançar:** o que foi feito e ainda não foi visto no navegador pelo dono. Cresce a cada entrega.
- **Pendências pequenas:** defeitos e acabamentos achados nas revisões finais de cada entrega e deixados para depois (nenhum quebra o uso). Cada um tem a área e onde mexer.

Ao corrigir ou testar um item, marque `[x]` (ou apague a linha) no mesmo PR.

## Para testar antes de lançar

### Diário da campanha
- [ ] Mestre cria entradas (sessão, missão, NPC, lugar), nota secreta, libera e recolhe; jogador lê pelo livro no topo (também no celular) e recebe o aviso.

### Grid hexagonal
- [ ] Trocar *Quadrado* / *Hex ↕* / *Hex ↔* no painel *Mapa*, com a confirmação quando apaga paredes, névoa ou pinturas.
- [ ] Tokens (inclusive criaturas grandes), régua, calibração, áreas de magia, pincel de efeitos e pincel de objetos no hex.
- [ ] Paredes e portas nos vértices e meios de lado; névoa (pincel, retângulo, *Cômodo*), visão dos personagens, explorado e "visto por último" no hex.

### Terreno pintado
- [ ] Pintar os 8 terrenos, mistura entre eles, *Borracha*, *Desfazer*, *Apagar tudo*; por cima da imagem do mapa e sem imagem; no hex; trocar de cena e carregar arquivo.

### Efeitos do mapa
- [ ] Fogo, raízes e eletrificado redesenhados (área parada, área que anda com o token, área fina).

### Vento nas plantas
- [ ] Árvore, arbusto, flores, pinheiro, palmeira e grama alta balançando; cogumelos e o resto parados.
- [ ] Clima *Vento com folhas* (vento para a esquerda e para a direita): balanço mais forte e para o lado do vento.
- [ ] Token embaixo da copa: copa meio transparente e parada.
- [ ] Ferramenta *Objetos* aberta e *Reduzir efeitos*: tudo parado.
- [ ] *Espalhar* com *Floresta* (tem pinheiros) e *Campo*; floresta grande (300 árvores): arrastar e dar zoom fluidos.

### Água animada
- [ ] Rio e lago pintados sobre grama, sobre a imagem de um battlemap e sobre a mesa vazia: barranco para dentro, nada coberto fora do pintado.
- [ ] *Correnteza*: riscar, *Apagar linha*, *Desfazer*; rio correndo no sentido da linha; linha contra outra e linha em terra.
- [ ] *Pedras* e *Pedregulho* no rio: espuma e esteira.
- [ ] Arrastar e dar zoom (a água presa ao terreno), grid hex, mapa grande com vários lagos.
- [ ] Trocar de cena e carregar arquivo de sessão.
- [ ] Jogador (entrando pelo IP da rede): vê a água correr, não vê as linhas.
- [ ] *Reduzir efeitos*: água parada.

### Terreno na placa de vídeo (renderizador do chão)
- [ ] Mesmo terreno de antes (cores, borda irregular, detalhe), nítido em zoom bem perto e bem longe; detalhe repetindo a cada 16 casas sem saltar aos olhos.
- [ ] Pincel: a passada aparece na hora, em resolução cheia; pincel de água mostra a aquarela até soltar e vira água animada depois.
- [ ] Mapa grande com terreno: aparece de uma vez; arrastar e dar zoom fluidos.
- [ ] Grid hex e celular (jogador entrando pelo IP da rede): o terreno acompanha o grid.
- [ ] Trocar de cena e carregar arquivo: terreno e água da cena certa.
- [ ] Reserva: com WebGL desligado no navegador, o terreno aparece como antes.

### Luz (dia, noite, tochas e sombras)
- [ ] Dia, entardecer, noite e luar: aparência de cada um e a troca entre eles (inclusive com a *Hora do jogo* avançando).
- [ ] Sombras do sol e da lua nas paredes, com borda macia; janela faz sombra curta.
- [ ] Tochas fixas e de token param nas paredes e portas fechadas, passam por porta aberta e janela; tremulam e mudam de cor.
- [ ] Chama nova nos três desenhos de tocha (fincada, de ferro, braseiro) e no selo do token; tamanho de ~0,75 casa.
- [ ] Arrastar tocha ou token com tocha: a luz e a chama acompanham.
- [ ] Mestre com brilho mínimo na noite; *Ver como jogador* mostra o escuro de verdade; jogador (pelo IP da rede) vê escuro.
- [ ] Chuva e outros climas escurecem à noite; relâmpago continua clareando.
- [ ] Névoa cobre a chama das tochas escondidas.
- [ ] *Reduzir efeitos*: tochas sem tremular.
- [ ] Reserva: com WebGL desligado no navegador, véu e brilho de antes.
- [ ] Desempenho: mapa com muitas paredes e tochas (arrastar e zoom fluidos); editar parede em cena enorme dá um tranco de ~0,4 s (aceito).

### Paredes emendadas, janela e telhado
- [ ] Emenda: quadrado de 4 paredes, T, cruzamento, traço sobreposto, diagonais e paredes no grid hex viram uma peça só; desenhos ou espessuras diferentes só se encostam.
- [ ] Mapas antigos (arquivo de sessão de antes) abrem emendados.
- [ ] Ferramenta *Paredes*: os 5 ícones dos modos (parede, porta, janela, trocar desenho, borracha) cabem com a coluna na largura mínima; dica com o nome em cada um.
- [ ] Janela: traçar por cima de parede abre o vão; *Desfazer* volta a parede inteira; escolher e fechar a persiana; clique com *Mover* abre e fecha; apagar.
- [ ] Porta traçada por cima de parede: com a porta aberta, o jogador vê pelo vão (antes não via).
- [ ] Jogador com névoa: janela aberta deixa ver, fechada corta; *Cômodo* da névoa para na janela.
- [ ] Telhado invisível: de dia, cômodo fechado sem sombra e um pouco mais escuro (bem de leve); cercado com cerca continua com sombra; sol pela janela aberta no chão (comprido no entardecer, azulado no luar); jogador só ganha o telhado depois de ver todas as paredes do cômodo.
- [ ] Desempenho: pan e zoom com muitas paredes; trocar de degrau de zoom numa cena enorme dá um tranco de ~0,3 s a mais que antes (montagem das imagens das paredes).

### Relevo (etapa 1)
- [ ] Ferramenta *Relevo* (N): níveis −2..+3, *Escarpa* e *Suave*, tamanho, *Desfazer*, *Aplainar tudo*; cabe na coluna na largura mínima.
- [ ] Penhasco de escarpa: rocha em camadas, borda clara, contorno fino de perto e de longe; patamar dentro de patamar; baixada (−1, −2).
- [ ] Encosta suave: morro arredondado, sem anéis nem raios; colina com um lado em escarpa e o outro suave, sem risco no meio.
- [ ] Luz: dia, entardecer (sombra comprida), luar e noite; trocar a luz troca a sombra devagar; dentro de cômodo fechado, sem sombra.
- [ ] Relevo atravessando vários pedaços (8 × 8 casas): a face e a sombra emendam sem costura.
- [ ] Sobre a imagem do mapa (sem terreno pintado): a face aparece, o topo continua a imagem. Face sobre a água animada (rio no fundo do cânion).
- [ ] Pintar relevo num mapa grande e arrastar logo depois: sem engasgo; o relevo aparece uma fração de segundo depois (cálculo no Worker).
- [ ] Muitos pedaços com relevo (mais de 64): fica menos nítido de perto, sem sumir.
- [ ] Celular/tablet (jogador pelo IP da rede): o relevo aparece, com menos detalhe.
- [ ] Jogador vê o relevo (sob a névoa como o resto do chão); troca de cena e arquivo de sessão.
- [ ] Sem WebGL: chão plano, sem erro.

### Chão, água, areia e dunas em Full HD (relevo, etapa 3)
- [ ] Os nove terrenos de perto (zoom máximo) e de longe: folhas, grão, pedrinhas, lajes e calçamento nítidos, sem chiado ao arrastar; borda entre terrenos como antes.
- [ ] Areia: botão no *Terreno* (cor do botão), pintar, apagar, desfazer; sem WebGL, a aquarela cor de areia.
- [ ] Dunas: *Relevo › Dunas*, alturas 1 a 3 e 0 apaga; não muda o nível; dia, entardecer (sombra comprida) e luar; duna atravessando pedaços sem costura; desfazer.
- [ ] Água: lago e rio com correnteza e pedras, de perto e de longe; barranco nítido, faixa molhada, brilhos, bolhas; sem manchas pretas; arrastar e dar zoom sem engasgo.
- [ ] Poeira das dunas: com vento (folhas, nevasca, tempestade) sutil e com a tempestade de areia forte, correndo pelo campo todo no sentido do vento do clima; só onde há duna; para com *Reduzir efeitos*; de perto, grãos voando; desempenho com muitas dunas na tela.
- [ ] Primeira vez de cada terreno na cena: aparece um instante depois (programa compilando), sem travar.
- [ ] Tela de alta densidade (Retina, celular): chão, água e paredes nítidos; desempenho ok.
- [ ] Mapa antigo (arquivo de sessão de antes): abre igual, com o chão novo.

### Paredes, portas e janela na placa de vídeo (relevo, etapa 2)
- [ ] Os 11 desenhos em quina (L), T, diagonal e ponta solta: sem emenda nem dente; de longe e bem de perto (zoom máximo), nítidos.
- [ ] Parede de desenhos diferentes encostando (pedra com tijolo, madeira com paliçada): sem buraco no canto.
- [ ] Porta fechada, aberta (clique com *Mover*), dupla; trancada e secreta (só o mestre vê as marcas); portão da cerca e da grade; janela aberta e com persiana.
- [ ] Escolher porta/janela (contorno branco no vão) e mudar o estado no painel *Paredes*.
- [ ] *Trocar desenho* (prévia ao passar) e *Desfazer*; apagar parede; desenhar parede nova (a prévia do traço continua no desenho antigo).
- [ ] Luz: dia, entardecer, luar e noite; a sombra no chão continua a das paredes; dentro de cômodo fechado, sem sombra.
- [ ] Primeira parede de um desenho na cena: aparece um instante depois (programa compilando), sem travar a tela.
- [ ] Jogador: sem marcas do mestre, sem porta secreta; *Ver como jogador*.
- [ ] Celular/tablet (jogador pelo IP da rede): paredes aparecem, sem engasgo.
- [ ] Muitas paredes (masmorra grande) e água animada na tela: sem queda de quadros.
- [ ] Sem WebGL: o desenho de antes, emendado, sem erro.

### Escadas (estruturas, parte 3)
- [ ] Ferramenta *Escada* (Y): os três formatos, pedra e madeira, largura/diâmetro 1/2/3, *Sobe/Desce*; escada clique a clique (dois cliques ou Enter no topo, Backspace, Esc), caracol e de mão arrastando; meia casa e Shift livre; cabe na coluna na largura mínima.
- [ ] Escolher: alças nos pontos, clique num trecho acrescenta ponto, botão direito na alça tira (mínimo 2), trocar formato/material/largura/sentido pelo painel, Delete, *Desfazer* de cada passo; clique em outra escada escolhe; Shift+clique começa uma nova em cima; escada com menos de 1 casa mostra o aviso.
- [ ] No relevo: ziguezague subindo dois níveis de escarpa (cavada em rocha em cima, lateral embaixo, patamar na virada); curva numa encosta suave (barranco, leque); vale (desce e sobe) e morro (sobe e desce); desenhada do topo para o pé.
- [ ] A parede cavada e a lateral na escarpa ficam estreitas (≤ ~0,14 casa, a conta aprovada): ver se basta ou se alarga.
- [ ] Solta: subindo (corte com hachura) e descendo (escurece, moldura) dentro de um cômodo; pintar relevo embaixo dela: passa a seguir o chão.
- [ ] Caracol de pedra subindo e de madeira descendo (diâmetros 1, 2 e 3); de mão encostada num penhasco de 1 nível (ganchos, pé assentado) e saindo de um alçapão (tampa ao lado).
- [ ] Luz: dia, entardecer (sombra longa lisa), luar e noite; perto e longe; tocha ilumina.
- [ ] Primeira escada de cada formato (escolhido antes na ferramenta): sem trava.
- [ ] Jogador vê as escadas (sob a névoa); troca de cena; arquivo de sessão (e antigo sem escadas); *Limpar campo*; trocar o grid mantém.
- [ ] Sem WebGL: escada chapada (degraus riscados, caracol com raios, de mão com trilhos), sem erro.

- [ ] Pintar relevo com 3 ou 4 escadas longas por cima: o pincel não trava (o perfil é refeito só no fim da pincelada).
- Menores da revisão (decidir se valem):
  - [ ] Lateral construída e parede cavada cortadas a 1 casa da borda (`out_ > 1.0` no stairShader): só aparece se a parede for alargada; as pontas da escada construída acima do chão ficam abertas.

### Pontes e píer (estruturas, parte 2)
- [ ] Ferramenta *Ponte* (U): os três tipos, largura 1/2/3, arrastar de margem a margem (meia casa; Shift livre), clicar para escolher, alças nas pontas, Delete, *Desfazer*; cabe na coluna na largura mínima.
- [ ] Ponte sobre o rio pintado: pousa nas margens (cabeceira, caminho, contato), sombra só sobre a água; de perto e de longe.
- [ ] Ponte de corda sobre um cânion do *Relevo*: sombra lá no fundo, seguindo a barriga; pontas em níveis diferentes (rampa); morro no meio (não corta o chão).
- [ ] Luz: dia, entardecer, luar e noite; ponte dentro da sombra do penhasco escurece; tocha ilumina.
- [ ] Primeira ponte de cada tipo (escolhido antes na ferramenta): sem trava; a pedra compila em ~3 s na placa integrada.
- [ ] Píer: piso de tábuas da margem para a água (estacas e espuma só sobre a água), plataforma em T, laje sobre a água (cais), tapete sobre a água (sem mudança); mapa salvo antes ganha as estacas.
- [ ] Jogador vê as pontes (sob a névoa); troca de cena; arquivo de sessão (e antigo sem pontes); *Limpar campo*; trocar o grid mantém.
- [ ] Sem WebGL: ponte chapada com tábuas riscadas, sem erro.

### Pisos (estruturas, parte 1)
- [ ] Ferramenta *Piso* (K): os seis materiais, sentido das tábuas, *Cômodo*, *Retângulo* (Shift: meia casa), *Pincel*, *Borracha*, *Desfazer*, *Apagar tudo*; cabe na coluna na largura mínima.
- [ ] *Cômodo*: sala de pedra, de madeira, com canto diagonal, pátio de cerca/paliçada/muralha; clique fora de lugar fechado mostra o aviso; cômodo dentro de cômodo fica de fora.
- [ ] Materiais encostando (tábua com laje, tapete por cima da laje): sem emenda; barra do tapete e medalhão; sujeira na borda do piso.
- [ ] De perto (zoom máximo) e bem de longe: nítido, sem chiado ao arrastar. *Não visto no app pelo agente.*
- [ ] Piso sobre encosta suave (pega a luz) e encosto no penhasco (a face cobre); piso sobre a água. *Não visto no app pelo agente.*
- [ ] Luz: dia, entardecer, luar e noite.
- [ ] Retângulo solto: cantos levemente arredondados (cerca de 1/8 de casa) — conferir se agrada.
- [ ] Primeira vez de cada material na cena: aparece um instante depois (programa compilando), sem travar.
- [ ] Jogador vê o piso; troca de cena; arquivo de sessão (e arquivo antigo sem piso); *Limpar campo*; trocar o grid apaga (aviso na troca).
- [ ] Hex: o piso pinta e desenha (padrão na grade quadrada).
- [ ] Celular/tablet (jogador pelo IP da rede): o piso aparece.
- [ ] Sem WebGL: cores chapadas, sem erro.

### Correções do teste de 2026-11-18 (desempenho, paredes livres, correnteza, terreno)
- [ ] Desempenho: abrir o app (compilado e dev), pintar água, pôr muitas árvores e objetos, traçar paredes e portas: sem travar; primeira água de uma sessão nova com no máximo uma pausa curta.
- [ ] Primeira parede de cada desenho, primeiro piso de cada material e primeiro terreno de cada tipo (escolhidos na ferramenta antes): sem pausa no traço.
- [ ] Paredes livres: ponta gruda na ponta e no corpo de outra parede (inclusive diagonal); Ctrl solta onde quiser; o cômodo fecha e o piso enche só ele.
- [ ] Correnteza: clique a clique, duplo clique e Enter terminam, Esc cancela (sem sair da ferramenta); arrastar risca à mão; continuar pela ponta (fim e começo); desfazer.
- [ ] Terreno em retângulo: cantos nas casas (Shift: meia casa), borracha em retângulo, prévia, desfazer; lado máximo 64 casas.
- [ ] Pincel do terreno: pinta do tamanho do círculo, uma passada cobre (força 1), força menor carrega aos poucos; borda fina; mapas antigos com a borda um pouco menos irregular; sem engasgo num mapa grande.

## Pendências pequenas

### Pontes e píer ([docs/design/pontes.md](design/pontes.md))
- [ ] Nível das pontas lido do ponto fino mais perto (processador) e o chão interpolado (placa): no relevo suave pode sobrar um fio de sombra na ponta em terra (`bridgePass.ts` `setBridges`).
- [ ] Na sombra da ponte, o chão é lido no pixel e não no ponto da ponte que tapa o sol: em chão irregular, o comprimento da sombra erra um pouco (`bridgeShader.ts`, laço da sombra).
- [ ] Estacas do píer: 16 leituras por pixel em todo pixel de tábua e de água perto dele, a cada redesenho; sair cedo quando não há piso de tábuas por perto (`floorShader.ts` `postDistance`).
- [ ] A ponte de pedra compila em ~3 s na placa integrada (o calçamento aparece no tabuleiro e na cabeceira: duas cópias do voronoi).

### Pisos ([docs/design/pisos.md](design/pisos.md))
- [ ] Piso pintado atrás de porta secreta mostra o formato da sala sem névoa (vai inteiro para os jogadores, como terreno e relevo).
- [ ] Sem WebGL (`FloorLayer`), o piso passa 1/8 de casa da linha da parede (quadradinhos de ±1/8).
- [ ] Barra do tapete pelo ponto mais perto: em tapete com borda diagonal sai em degraus.

### Chão, água, areia e dunas ([docs/design/relevo.md](design/relevo.md))
- [ ] Sem compilação em paralelo, até 3 programas compilam no mesmo quadro (terreno, paredes, poeira: um por cache).
- [ ] O relógio da poeira volta a zero a cada 30 min: o desenho dos fiapos pula uma vez nesse instante.
- [ ] A superfície da água ainda usa o relógio sem voltar a zero (sessões muito longas podem perder detalhe fino).

### Paredes na placa de vídeo ([docs/design/relevo.md](design/relevo.md))
- [ ] Grade de ferro na espessura padrão (0,18) fica fina de longe (barras com menos de 1 px a 40 px por casa).
- [ ] Tinta do lado do chão às vezes com 0 a 1 px (vem das derivadas em grupos de 2 × 2 pixels); a borda de dentro da parede é que garante o contorno.
- [ ] Porta aberta escolhida: o contorno branco marca o vão, não a folha.
- [ ] Casa com mais de 8 paredes por perto: ficam as 8 mais próximas do centro; uma nona pode sumir num canto da casa.
- [ ] Densidade da tela acima de 2 (alguns celulares, 3): chão, água e paredes saem a 2 × (`MAX_PIXEL_RATIO`).
- [ ] Os shaders compilados não são apagados depois de ligados (`glKit.ts`, também no `linkProgram` de antes); o contexto morre junto com o renderizador.
- [ ] Porta secreta vista pelo mestre aparece como uma lasca fina de pedra (a espessura da folha, não a da parede).
- [ ] Sem compilação em paralelo no navegador, a tela trava um instante (1–2 s) a cada desenho de parede novo que aparece.

### Relevo ([docs/design/relevo.md](design/relevo.md))
- [ ] Margem do relevo passou a 12 casas (sombra do entardecer inteira): cada pincelada de relevo dá ~4× mais conta no Worker (pedaço ~1,4× e 5 × 5 pedaços em vez de 3 × 3). Conferir num mapa grande se o relevo novo demora a aparecer.
- [ ] Altura de um pedaço leva ~10 a ~50 ms com a margem de 12 casas (no Worker); o alvo era 5 ms (`relief.ts`).
- [ ] Calibrar o comprimento da sombra (um nível = 1,6 × a sombra de uma parede) e a força da luz das encostas à noite.
- [ ] Com o atlas cheio nas três resoluções, pedaço sem lugar fica plano; um lugar que se liberta depois não recalcula sozinho, e a resolução não volta a subir quando o relevo diminui (só recarregando) (`reliefPass.ts`).
- [ ] Trocar a luz de novo no meio da mistura da sombra pula para a anterior; pedaço pintado durante a troca mostra a sombra antiga até todos ficarem prontos (`reliefPass.ts`).
- [ ] Aplainar com *Suave* ligado (nível 0 suave) não apaga o pedaço (conta no limite de 400); a dica poderia dizer "aplainar = 0 Escarpa".
- [ ] A sombra do relevo é cara de calcular (256² × 80 passos); numa troca de luz grande em placa integrada, os quadros lentos podem ligar o detector de aparelho lento e parar água e plantas.
- [ ] Memória das alturas no processador: ~109 KB por pedaço (até ~50 MB no limite de pedaços).

### Paredes emendadas ([docs/design/paredes.md](design/paredes.md))
- [ ] Mapa com mais de ~700 cadeias (muitos cruzamentos de desenhos diferentes) pode refazer as imagens a todo quadro (`wallChainArt.ts`: o teto é de pixels, mas o que está na tela pode passar dele).
- [ ] Quina muito fechada no traço livre (ângulo interno abaixo de ~35°): o lado de dentro do contorno se cruza (`wallChainArt.ts`, chanfrar em vez de limitar o bico).
- [ ] Emenda por arredondamento (0,001 casa), não por distância: traço livre que quase encosta (0,01) não emenda; sobreposição quase alinhada vira um X raso (`wallJoin.ts`).
- [ ] Janela: o *Cômodo* da névoa conta toda janela, mas o telhado ignora janela com desenho vazado, e janela com desenho vazado nunca bloqueia mesmo fechada (`fog.ts`/`wallJoin.ts`: ignorar o desenho na janela).
- [ ] A textura de um cômodo pode "pular" depois de *Desfazer* (a cadeia começa noutro ponto conforme a ordem das paredes; `wallJoin.ts`: começar pelo menor ponto).
- [ ] A conta da emenda (O(n²)) roda duas vezes por mudança de paredes (cadeias e cômodos) e de novo na prévia de *Trocar desenho*.
- [ ] Montar as imagens das paredes ao trocar de degrau de zoom ficou mais lento (600 paredes: ~0,8 s; antes ~0,14 s), porque cada pedaço de tira pinta o trecho inteiro.

### Luz ([docs/design/luz.md](design/luz.md))
- [ ] O corpo da tocha fixa é desenhado por cima da chama nova (a camada das chamas fica embaixo de `MapTorchLayer`): conferir de olho, principalmente a bacia do braseiro (`BattleMap.tsx`).
- [ ] Chuva e neve escurecem pela luz de destino, não pela que está no meio da troca: pulam enquanto o mapa escurece devagar (`weatherDim` em `BattleMap.tsx`).
- [ ] Tocha na tela redesenha o chão a 30 quadros por segundo também de dia (a chama tremula; a luz da tocha de dia quase não aparece): decidir se de dia a chama pode ficar parada (`GroundRenderer.flickering`).
- [ ] O texto do desenho diz que com névoa "nada aparece" depois de uma porta secreta, mas a camada da luz fica acima da névoa: a poça de luz aparece sobre a névoa (`docs/design/luz.md`; ajustar o texto).
- [ ] O desenho diz que o mapa de luz já recebe a altura do chão; ainda não recebe (fica para o relevo).
- [ ] No primeiro instante com o chão em WebGL, a película e o brilho antigos já saíram e o mapa de luz ainda não chegou: um piscar claro à noite ao abrir o mapa (`BattleMap.tsx`, `groundLit`).
- [ ] Se só o shader da luz falhar, o chão inteiro volta para o desenho antigo (terreno junto).

### Água animada ([docs/design/agua.md](design/agua.md))
- [ ] Longe da origem do mapa (a partir de ~50–100 casas), as oitavas finas do ruído do shader perdem precisão (`waterShader.ts`, `hash`).
- [ ] `dFdx`/`dFdy` depois de `return` antecipado e dentro de `if` no shader da água: possíveis pixels soltos na margem (`waterShader.ts`).
- [ ] Pedras no rio têm só espuma e esteira, não a cúpula no relevo da água que o desenho pedia (`waterShader.ts`, `heightAt`).

### Renderizador do chão ([docs/design/renderizador-chao.md](design/renderizador-chao.md))
- [ ] Mudar a densidade da tela (arrastar a janela para outro monitor) não redesenha o chão até a próxima mudança de visão (`GroundLayer.tsx`).
- [ ] `terrainShader.ts` usa 8 e 16 fixos em vez de `TERRAIN_CHUNK_CELLS` e `DETAIL_PERIOD`.
- [ ] Hash do ruído da borda faz `uint(x)` de inteiro negativo (terreno à esquerda/acima da origem): o ANGLE preserva os bits, mas a GLSL ES 3.00 não garante (`terrainShader.ts`).
- [ ] `dispose` do chão não apaga programas, buffers e framebuffers (o `loseContext` libera tudo; só registro).
- [ ] Conferir de olho: detalhe com zoom bem longe pode sair um pouco mais escuro (mipmap de textura com alfa não pré-multiplicado; não reproduzido na medição).

### Vento nas plantas ([docs/design/vento.md](design/vento.md))
- [ ] Mudar o clima (até só a luz de dia/noite) recria a animação e as plantas dão um pulinho no balanço (`PlantWind.tsx`: `frame.time` volta a 0).
- [ ] Grama alta com vento põe todas as pontas sobre todas as bases; parada, elas se alternam folha a folha (`plantArt.ts`).
- [ ] Sombra borrada da palmeira (`ctx.filter`) não funciona no Safari: sai nítida (`plantArt.ts`).

### Terreno pintado ([docs/design/terreno.md](design/terreno.md))
- [ ] Pedaço sem dados próprios não é desenhado: depois da *Borracha*, a faixa de 1/4 de casa até o vizinho da direita/de baixo fica cortada reta (`renderChunk.ts` / `TerrainLayer.tsx`).

### Grid hexagonal ([docs/design/grid-hex.md](design/grid-hex.md))
- [ ] `maskKey` da névoa sem o grid (`Fog.tsx`): só pesa trocando entre cena quadrada e hex com o revelado idêntico.
- [ ] O canvas da máscara da névoa pode passar do limite do iOS numa área revelada enorme (já era assim no quadrado).

### Diário da campanha ([docs/design/diario.md](design/diario.md))
- [ ] `.journal-secret` usa cores fixas do protótipo (`#231a14`, `#6b4b2f`) em vez de variáveis `--mantine-*`.
