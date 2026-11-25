# Pendências das branches `feat/campanha` (2.14.0, lançada sem a rodada de testes) e `feat/objetos`

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

### Objetos na placa de vídeo (troca de motor, etapa 1; [docs/design/objetos.md](design/objetos.md))
- [ ] Os 28 tipos como nas páginas aprovadas ([objetos-teste.html](design/objetos-teste.html) e [objetos-catalogo-teste.html](design/objetos-catalogo-teste.html)): dia, entardecer, luar e noite com tocha; perto e longe nítidos; *Variar* troca o desenho; mapa salvo antes abre com os objetos no lugar.
- [ ] Sombra: de dia curta, no entardecer ~2 casas por parede (também nas paredes e no relevo); a dos maciços sai do pé, a das árvores liga pelo tronco; carroça e pedregulho sem sombra em cima de si; token na sombra da árvore escurece; sem lua, nada.
- [ ] Vento: árvore, arbusto, pinheiro, palmeira, grama alta e flores balançam (mais forte com clima de vento); parados com *Objetos* aberta, com *Reduzir efeitos* e no aparelho lento; copa com token embaixo fica transparente e parada.
- [ ] Edição: escolher, arrastar (Shift encaixa), alças de tamanho e giro (o desenho acompanha), Delete, Ctrl+C / Ctrl+V, *Desfazer*, *Acima/Abaixo*, *Bloqueia a visão*; pincel *Espalhar* (todos os conjuntos) e *Apagar*.
- [ ] Relevo: objeto em cima do patamar aparece por cima da face; perto do penhasco nada some.
- [ ] Ícones do painel *Objetos* no desenho novo (o antigo aparece um instante na primeira vez).
- [ ] Sem WebGL 2 (ou chão desligado): os objetos voltam ao desenho antigo, com o vento antigo.
- [ ] **Desempenho (não medido: o navegador do agente roda em segundo plano):** no app compilado, com uma floresta de ~500 objetos (pincel *Espalhar*, 9×9, densidade cheia), andar no WASD sem engasgo; espalhar a floresta sem travar; uma cena com ~800 objetos afastada até ver todos (nada some); a primeira vez de cada tipo (compilação) sem pausa longa; comparar com a 2.14.0.

### Sombras de tochas, tokens e objetos (troca de motor, etapa 2; [docs/design/sombras.md](design/sombras.md))
- [ ] À noite: fogueira (braseiro) na floresta faz sombras longas atrás das árvores; tocha de ferro passa por cima de um caixote baixo; estante e estátua fazem sombra grande; tudo como em [sombras-teste.html](design/sombras-teste.html).
- [ ] Token com tocha andando e sendo arrastado: a sombra dos vizinhos gira e estica; sem anel escuro em volta dele; ele faz sombra do token ao lado.
- [ ] Token com tocha embaixo da árvore, do pinheiro e da palmeira: a luz passa por baixo da copa e ilumina em volta (só o tronco faz uma sombra fina); sem ponto escuro no tronco. Token grande com tocha embaixo de árvore pequena: a copa faz sombra.
- [ ] De dia, nenhum leque de sombra de tocha; sombras curtas do sol em objetos e tokens; no entardecer, longas.
- [ ] Tokens sem a sombrinha antiga com o chão na placa; com o chão desligado (ou sem WebGL 2), a sombrinha volta.
- [ ] Copa alta sobre um barril: o barril escurece pela sombra da copa, a copa não escurece pela do barril.
- [ ] Objeto ou token logo fora da tela: a sombra dele entra na tela.
- [ ] **Desempenho (não medido pelo agente):** à noite, floresta de ~300 objetos, 10 tochas fixas e 4 tokens com tocha andando: sem engasgo no WASD nem ao arrastar token; comparar com a 2.14.0.

### Névoa de guerra na placa (troca de motor, etapa 3; [docs/design/nevoa.md](design/nevoa.md))
- [ ] Como jogador (outro dispositivo, ou *ver como* o jogador), névoa e visão dos personagens ligadas, cena com paredes, portas, pilares e objetos que bloqueiam: borda firme e reta rente às paredes (sem fumaça vazando parede adentro nem saindo de pilar fechado); fiapos onde a visão acaba no campo aberto; explorado escurecido e sem cor sob um véu de fumaça; tudo como em [nevoa-teste.html](design/nevoa-teste.html).
- [ ] Copa de árvore no nunca visto não aparece por cima da névoa; no explorado, escurecida.
- [ ] Mestre: bruma cinza translúcida (vê tudo por baixo).
- [ ] Arrastar e dar zoom no mapa: a névoa acompanha, sem atraso, rastro nem tela chapada.
- [ ] Pincel do mestre (revelar e cobrir, pincel, retângulo e cômodo): aparece na hora, antes da resposta do servidor, com a borda em fiapos.
- [ ] Névoa sem a visão dos personagens: só o revelado, com fiapos.
- [ ] Cena hex com a visão dos personagens: a borda segue os hexes; nada de meio hex visível que o servidor não mandou.
- [ ] *Reduzir efeitos*: a fumaça para (a névoa fica). Com o chão desligado (ou sem WebGL 2): a névoa de antes.
- [ ] **Desempenho (não medido pelo agente):** mapa grande com tudo explorado e a névoa ligada: arrastar e dar zoom sem engasgo; a fumaça andando sem pesar (comparar com a 2.14.0).

### Efeitos de área na placa (troca de motor, etapa 4, parte 1; [docs/design/efeitos.md](design/efeitos.md))
- [ ] Os 18 tipos de dia e à noite, como em [efeitos-teste.html](design/efeitos-teste.html): fogo "fogo, não lava", luz sagrada com as luzes girando, teia de desenho.
- [ ] À noite: fogo, luz sagrada e eletricidade iluminam em volta e a parede barra; objetos e tokens fazem sombra dessa luz; de dia quase não pesa; a escuridão apaga uma tocha dentro dela.
- [ ] Efeito que acompanha um token (Espíritos Guardiões): o desenho e a luz andam junto no arrasto.
- [ ] Pincel de efeitos (casas pintadas) no quadrado e no hex; cone, linha, cubo e esfera.
- [ ] Cor trocada pelo mestre tinge o efeito; com a cor padrão, o desenho é o da página.
- [ ] Efeito desligado (mestre): parado, apagado e tracejado; não ilumina nem escurece.
- [ ] Jogador: efeito na névoa não aparece (nem a luz dele).
- [ ] *Reduzir efeitos*: os efeitos param. Com o chão desligado (ou sem WebGL 2): o desenho de antes.
- [ ] **Desempenho (não medido no app pelo agente):** 40 áreas na tela, à noite, com fogo: sem engasgo (comparar com a 2.14.0).

### Clima vivendo no mapa (troca de motor, etapa 4, parte 2; [docs/design/clima.md](design/clima.md))
- [ ] Os 17 climas de dia e à noite, como em [clima-teste.html](design/clima-teste.html): o que cai anda com o mapa ao arrastar e dar zoom.
- [ ] A cobertura acumula aos poucos (máximo em 2 minutos) e recomeça ao trocar de clima; igual em dois navegadores.
- [ ] Cômodo fechado: não chove nem neva dentro; névoa rala lá dentro. Jogador que não conhece as paredes do cômodo: chove dentro (é o que ele sabe).
- [ ] Vento do clima: a chuva, a neve e as folhas no mesmo sentido em que as árvores balançam.
- [ ] Tempestade: o clarão e o trovão nos mesmos instantes para todos.
- [ ] Brasas, vagalumes, luzes mágicas e esporos brilham à noite; chuva, neve e névoa escurecem com a noite.
- [ ] *Reduzir efeitos*: metade das partículas e sem clarão. Chão desligado (ou sem WebGL 2): a película de antes.
- [ ] **Desempenho (não medido no app pelo agente):** chuva forte e nevasca num mapa grande, arrastando: sem engasgo (comparar com a 2.14.0).

### Ajustes rápidos (bloco 1; [docs/design/ajustes-rapidos.md](design/ajustes-rapidos.md))
- [ ] Terreno em retângulo: o círculo do pincel não aparece. Mouse indo para o painel: o círculo some (Terreno, Relevo e Piso).
- [ ] Água e água profunda: sem a opção de retângulo; voltando para grama, ela aparece de novo.
- [ ] Aba Construir: ícone e texto centralizados nos botões.
- [ ] Tochas menores (tocha e suporte de ferro em meia casa, braseiro 0,7); a luz sai da chama.
- [ ] Tocha, baú ou objeto em cima de parede: recusado com "Aí tem uma parede." e a peça volta ao lugar. Em cima de porta ou janela: pode. Estante encostada na parede: pode. Token: livre.
- [ ] Espalhar floresta cruzando uma parede: nenhuma árvore em cima dela.
- [ ] Floresta + passada de água no meio: as plantas dentro da água somem ao soltar, pedras ficam. Ctrl+Z: a água sai e as plantas voltam.

### Desempenho e estabilidade (bloco 2; [docs/design/desempenho.md](design/desempenho.md), medições em [docs/desempenho/](desempenho/README.md))
- [ ] Zoom num mapa cheio (floresta, relevo, tochas, chuva à noite): a 60 quadros, sem travar. Afastando rápido, o mapa cobre a tela inteira (sem retângulo com a mesa em volta). Ao parar, fica nítido.
- [ ] Zoom e logo depois clicar num token, arrastar o mapa, pôr uma tocha: tudo no lugar certo.
- [ ] Ferramenta Objetos aberta: clicar, arrastar e as alças dos objetos funcionam como antes.
- [ ] Deixar o fps cair (zoom rápido muitas vezes, relevo grande): a água e o vento continuam, ou voltam sozinhos em segundos.
- [ ] Relevo e dunas perto de uma floresta: sem travar; as árvores sobem com o relevo logo depois do traço.
- [ ] App instalado: mexer na água e no terreno por bastante tempo; acompanhar a memória no Gerenciador de Tarefas (não pode subir sem parar). Se o app fechar, mandar o `falhas.log` (pasta do app).
- [ ] **No app empacotado:** o zoom e a memória como no navegador (a medição do agente foi no navegador do app de desenvolvimento).

### Ponte, escadas e rios (bloco 3; [docs/design/estruturas-ajustes.md](design/estruturas-ajustes.md))
- [ ] Ponte de pedra de largura 1, 2 e 3: pilar quadrado de cada lado nas duas pontas, muretas retas, caminho de terra chegando (sem mancha clara). De dia, no entardecer e à noite (a sombra do pilar vai para o lado certo).
- [ ] Escadas de pedra e de madeira subindo um penhasco: degraus fáceis de ver, mais claros em cima; contorno separando do chão. Escada solta subindo (borda cortada) e descendo (alçapão) como antes, com os degraus marcados.
- [ ] Rio com o pincel mínimo (0,5): água no meio, margem estreita. Rio largo, lago e água funda: margem mais rasa e suave, sem degrau estranho na borda.
- [ ] Mexer na água (pintar, apagar, correnteza): sem engasgo novo (a meia largura é calculada no Worker).

### Fontes de luz (bloco 6; [docs/design/luzes.md](design/luzes.md))

- [ ] Os 10 modelos pelo painel *Tochas*, nas 5 cores: dia, entardecer, luar e noite; perto e longe nítidos; como na página aprovada ([luzes-teste.html](design/luzes-teste.html)).
- [ ] Luz colorida no chão (azul, verde, roxa, branca) e alcance de cada modelo (vela perto, fogueira longe).
- [ ] Arandela: prévia gruda na parede mais perto e vira para o lado do ponteiro; longe de parede, recusa com aviso; arrastar gruda de novo; apagar a parede (remover, borracha, limpar) tira a arandela; trocar de cena não.
- [ ] Arandela ilumina só o lado de dentro (cômodo fechado com uma em cada parede).
- [ ] Desfazer: pôr, arrastar (volta a direção) e borracha (volta com cor e direção).
- [ ] Névoa cobre corpo e chama das fontes escondidas; jogador não recebe a fonte atrás da névoa.
- [ ] *Reduzir efeitos*: chamas paradas. Sem WebGL 2: os desenhos de antes.
- [ ] Mapas salvos antes abrem com as mesmas tochas (sem cor = chama).
- [ ] Pendente conhecido: à noite a prévia da arandela aparece escurecida (fica na camada das tochas, abaixo da luz da cena).
- [ ] Pendente conhecido: no painel escuro, os ícones de ferro ficam pouco visíveis; lanterna e lamparina pequenas.
- [ ] Pendente conhecido: a fogueira branca sai bem estourada.

### Mar (bloco 5; [docs/design/mar.md](design/mar.md))

- [ ] Praia: pintar areia e mar ao lado; a onda sobe e desce na areia molhada, espuma na beira, raso turquesa escurecendo até o azul fundo longe da costa.
- [ ] Porto: mar com um píer de *Piso* (tábuas) saindo da areia; a entrada fica na areia e as estacas com espuma começam no mar. Saindo de chão sem pintura, a entrada também fica fora d'água (o mar da borda aberta não ganha estacas). Ponte sobre o mar pousa nas margens.
- [ ] Alto-mar: só mar; nenhuma margem nem espuma de arrebentação nas bordas, o mar some aos poucos onde a pintura acaba.
- [ ] Penhasco: mar junto a pedra e junto a um morro do *Relevo* (nível 1 ou mais); face cinza, onda batendo na base. Pintar relevo perto do mar: a costa muda uns instantes depois de soltar o pincel.
- [ ] Passagem de praia para pedra na mesma costa sem corte reto.
- [ ] Noite, *Reduzir efeitos* (parado) e com moldura ligada.
- [ ] Lago e rio continuam iguais em cena sem mar; mar encostado num lago não ganha margem entre os dois.
- [ ] Pendente conhecido: a areia pintada encostada no mar mostra uma linha fina mais escura na beira (a borda da aquarela do terreno por baixo).
- [ ] Pendente conhecido: objetos de planta em chão sem pintura onde o mar da borda aberta avança não somem (só a água pintada afoga plantas).

### Moldura e terrenos novos (bloco 4; [docs/design/moldura.md](design/moldura.md))
- [ ] Terra batida e neve no painel *Terreno*: pintar ao lado da água e da grama, de dia e à noite (a neve com montinhos e sombra azulada).
- [ ] Moldura: ligar no painel *Mapa*, mudar largura e altura (ao sair do campo ou Enter), trocar os quatro desenhos, *Ajustar à imagem* com uma imagem de mapa, desligar.
- [ ] Fora da moldura: a mesa (couro, madeira, ardósia) cobre o que estava lá; nada é apagado (desligar mostra de novo).
- [ ] Tentar pôr fora: token (volta ao lugar), objeto, tocha, baú, parede, ponte, escada, efeito de área, desenho; recusa "Fora da moldura.". Pincéis de terreno, relevo, piso e efeitos param na borda.
- [ ] Jogador pelo IP da rede: vê a moldura e não consegue mover o token para fora.
- [ ] Zoom e arrasto com a moldura ligada: sem engasgo novo; a moldura nítida de perto.

## Pendências pequenas

### Desempenho e estabilidade ([docs/design/desempenho.md](design/desempenho.md))
- [ ] **Primeiro zoom depois de abrir a cena:** 2 ou 3 quadros de ~350–450 ms (só na primeira vez; os zooms seguintes saem lisos). Não é o desenho da placa (medido com espera da placa: nenhuma etapa passa de 30 ms) nem compilação; parece a composição das telas 2D do navegador na primeira escala nova. Investigar no perfil do navegador.
- [ ] **Zoom: piores 5% em ~33 ms (meta era 25):** cada passo da rodinha ainda refaz o mapa no React (~20–30 ms). Caminho: no gesto, mexer só na escala do palco do Konva e passar a visão ao React ao parar.
- [ ] **Pintar água várias vezes seguidas:** cada traço de água dá quadros de ~100 ms (a forma da água recalculada). Uma vez só (primeira água) está dentro da meta.
- [ ] **Teste de desempenho:** editar arquivos de `client/src/bench/` ou de `shared/` no meio de uma medição recarrega a página ou reinicia o servidor de dev e a cena de teste fica para trás (apagar no painel de cenas).

### Sombras de tochas, tokens e objetos ([docs/design/sombras.md](design/sombras.md))
- [ ] Token voando faz sombra como se estivesse no chão (o mapa de alturas guarda só o topo).
- [ ] O relevo não entra no mapa de alturas: o objeto em cima do patamar faz sombra pela altura dele, sem descer o penhasco.
- [ ] Bem de perto, a faixa do mapa de alturas é cortada em 3/4 da tela por lado: a sombra de algo muito longe da tela não entra (`heightPass.ts`).
- [ ] Moldura de chefe mantém a sombra própria das peças de ouro (só a do anel comum saiu; `tokenArt.ts`).
- [ ] A copa começa a 1,7 casa (`CANOPY_BOTTOM`, × o tamanho da árvore se maior que 1): a tocha de token grande (2,3) entra na copa e escurece em volta dela; a copa fica sem sombra própria da tocha baixa (ilumina como o chão embaixo); token embaixo da copa vira coluna da altura da copa para as tochas.

### Névoa de guerra na placa ([docs/design/nevoa.md](design/nevoa.md))
- [ ] Na sombra diagonal de pilares e paredes, alguns trechos curtos da borda saem em degrau (a casa vista pela metade fica escondida: o servidor não a mandou).
- [ ] Chão aceso por um mob com tocha fora da vista: o servidor manda as casas, mas o cliente não sabe da tocha; fica na névoa até o mob aparecer.
- [ ] Parede que o jogador ainda não viu não chega a ele: ali, quem corta a visão são as casas do servidor.
- [ ] Arrastar um objeto que bloqueia refaz os triângulos da névoa (pode pesar num mapa enorme).

### Efeitos de área na placa ([docs/design/efeitos.md](design/efeitos.md))
- [ ] A sombra da luz de um efeito sai do meio da área (objeto ou token dentro da própria área não faz sombra dela).
- [ ] Fogo e luz sagrada não têm camada à parte acima da luz: à noite, é a luz que eles mesmos acendem que clareia a área.
- [ ] Efeito aceso pede o desenho inteiro do chão a cada quadro (a luz tremula com ele), como as tochas.

### Clima vivendo no mapa ([docs/design/clima.md](design/clima.md))
- [ ] A cobertura do chão não é guardada: trocar de clima (ou recarregar depois de muito tempo) recomeça do zero do início do clima.
- [ ] O clarão do relâmpago é um véu claro igual em toda a tela (não ilumina as paredes de um jeito diferente).
- [ ] Jogador sem as paredes de um cômodo vê chover dentro dele.

### Objetos na placa de vídeo ([docs/design/objetos.md](design/objetos.md))
- [ ] Atlas fixo de ~96 MB na placa (3 camadas de 2048² × 2 texturas), mesmo sem objetos na cena; se pesar no celular, criar só quando houver objeto (`propPass.ts`).
- [ ] Sombra de um objeto baixo pode escurecer uma copa alta por cima dela (a máscara não sabe a altura de quem recebe); fica para a etapa 2 (sombra por objeto).
- [ ] Árvore na beira do patamar faz a sombra curta lá embaixo (a base no relevo não alonga a sombra; ver `propPass.ts` `setProps`).
- [ ] Cordas, cajado e outras peças finas a muitas casas de altura podem mostrar a sombra em degraus de perto (28 amostras; `PROP_SHADOW_FRAGMENT`).
- [ ] Ícone do painel feito com `readPixels` (síncrono): 28 ícones na primeira abertura do painel; se travar, fazer aos poucos (`iconOf`).
- [ ] Com vento, planta em qualquer lugar da cena faz o chão pedir quadros (30 por segundo), mesmo fora da tela; dá para olhar só as da tela, como a água (`PropPass.swaying`).
- [ ] Ao trocar a resolução do atlas (muitos objetos na tela, depois poucos), as formas são refeitas 6 por quadro: numa floresta grande os objetos reaparecem aos poucos por ~1 a 2 s (`PropAtlas.tierFor`).

### Pontes e píer ([docs/design/pontes.md](design/pontes.md))
- [ ] Nível das pontas lido do ponto fino mais perto (processador) e o chão interpolado (placa): no relevo suave pode sobrar um fio de sombra na ponta em terra (`bridgePass.ts` `setBridges`).
- [ ] Na sombra da ponte, o chão é lido no pixel e não no ponto da ponte que tapa o sol: em chão irregular, o comprimento da sombra erra um pouco (`bridgeShader.ts`, laço da sombra).
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
- [ ] Casa com mais de 8 paredes por perto: ficam as 8 mais próximas do centro; uma nona pode sumir num canto da casa.
- [ ] Densidade da tela acima de 2 (alguns celulares, 3): chão, água e paredes saem a 2 × (`MAX_PIXEL_RATIO`).
- [ ] Porta secreta vista pelo mestre aparece como uma lasca fina de pedra (a espessura da folha, não a da parede).
- [ ] Sem compilação em paralelo no navegador, a tela trava um instante (1–2 s) a cada desenho de parede novo que aparece.

### Relevo ([docs/design/relevo.md](design/relevo.md))
- [ ] Margem do relevo passou a 12 casas (sombra do entardecer inteira): cada pincelada de relevo dá ~4× mais conta no Worker (pedaço ~1,4× e 5 × 5 pedaços em vez de 3 × 3). Conferir num mapa grande se o relevo novo demora a aparecer.
- [ ] Altura de um pedaço leva ~10 a ~50 ms com a margem de 12 casas (no Worker); o alvo era 5 ms (`relief.ts`).
- [ ] Calibrar o comprimento da sombra (um nível = 1,6 × a sombra de uma parede) e a força da luz das encostas à noite.
- [ ] Trocar a luz de novo no meio da mistura da sombra pula para a anterior; pedaço pintado durante a troca mostra a sombra antiga até todos ficarem prontos (`reliefPass.ts`).
- [ ] A sombra do relevo é cara de calcular (256² × 80 passos); numa troca de luz grande em placa integrada, os quadros lentos podem ligar o detector de aparelho lento e parar água e plantas.
- [ ] Memória das alturas no processador: ~109 KB por pedaço (até ~50 MB no limite de pedaços).

### Luz ([docs/design/luz.md](design/luz.md))
- [ ] O corpo da tocha fixa é desenhado por cima da chama nova (a camada das chamas fica embaixo de `MapTorchLayer`): conferir de olho, principalmente a bacia do braseiro (`BattleMap.tsx`).
- [ ] O texto do desenho diz que com névoa "nada aparece" depois de uma porta secreta, mas a camada da luz fica acima da névoa: a poça de luz aparece sobre a névoa (`docs/design/luz.md`; ajustar o texto).
- [ ] O desenho diz que o mapa de luz já recebe a altura do chão; ainda não recebe (fica para o relevo).
- [ ] No primeiro instante com o chão em WebGL, a película e o brilho antigos já saíram e o mapa de luz ainda não chegou: um piscar claro à noite ao abrir o mapa (`BattleMap.tsx`, `groundLit`).
- [ ] Se só o shader da luz falhar, o chão inteiro volta para o desenho antigo (terreno junto).

### Água animada ([docs/design/agua.md](design/agua.md))
- [ ] Longe da origem do mapa (a partir de ~50–100 casas), as oitavas finas do ruído do shader perdem precisão (`waterShader.ts`, `hash`).
- [ ] `dFdx`/`dFdy` depois de `return` antecipado e dentro de `if` no shader da água: possíveis pixels soltos na margem (`waterShader.ts`).

### Renderizador do chão ([docs/design/renderizador-chao.md](design/renderizador-chao.md))
- [ ] `terrainShader.ts` usa 8 e 16 fixos em vez de `TERRAIN_CHUNK_CELLS` e `DETAIL_PERIOD`.
- [ ] `dispose` do chão não apaga programas, buffers e framebuffers (o `loseContext` libera tudo; só registro).
- [ ] Conferir de olho: detalhe com zoom bem longe pode sair um pouco mais escuro (mipmap de textura com alfa não pré-multiplicado; não reproduzido na medição).

### Vento nas plantas ([docs/design/vento.md](design/vento.md))
- [ ] Grama alta com vento põe todas as pontas sobre todas as bases; parada, elas se alternam folha a folha (`plantArt.ts`).
- [ ] Sombra borrada da palmeira (`ctx.filter`) não funciona no Safari: sai nítida (`plantArt.ts`).

### Terreno pintado ([docs/design/terreno.md](design/terreno.md))
- [ ] Pedaço sem dados próprios não é desenhado: depois da *Borracha*, a faixa de 1/4 de casa até o vizinho da direita/de baixo fica cortada reta (`renderChunk.ts` / `TerrainLayer.tsx`).

### Grid hexagonal ([docs/design/grid-hex.md](design/grid-hex.md))
- [ ] O canvas da máscara da névoa pode passar do limite do iOS numa área revelada enorme (já era assim no quadrado).

### Diário da campanha ([docs/design/diario.md](design/diario.md))
