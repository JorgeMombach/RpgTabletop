# Changelog

Mudanças de cada versão do Jamal's Tabletop (antes chamado Simulador de Encontros). Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

A seção da versão vira o texto da GitHub Release. Antes de criar a tag `vX.Y.Z`, mova o que estiver em *Não lançado* para `## [X.Y.Z] - AAAA-MM-DD` e atualize `version` no `package.json`.

## [Não lançado]

### Adicionado
- **Tochas fixas no mapa:** a ferramenta *Tochas* (tecla L, só do mestre) deixa pôr tochas em qualquer ponto do mapa, sem encaixar no grid, em três desenhos à escolha: tocha fincada, tocha de ferro e braseiro. É só escolher o desenho e clicar no mapa, ou arrastar o desenho até lá; depois, arrastar a tocha muda o lugar, e a borracha ou *Apagar todas* tiram. A luz é a mesma da tocha dos tokens (20 ft fortes e mais 20 de meia-luz, tremulando): clareia a noite e, com a visão dos personagens, é vista de longe. Coberta pela névoa, os jogadores não a recebem. É de cada cena e vai no arquivo de sessão.

### Corrigido
- **Coluna da esquerda empurrava o mapa:** ao arrastar, recolher ou abrir a coluna da esquerda, o mapa andava junto. Agora ele fica parado na tela e a coluna passa por cima, como já acontecia na da direita.
- **NPC já encontrado:** com a visão dos personagens, o NPC que o grupo já viu continua à vista com o próprio token, sem virar "?", mesmo sem ninguém por perto. Ele some para os jogadores quando o mestre cobre o lugar (ou *Cobrir tudo*) ou o oculta. O "?" fica só para os mobs.
- **Travadinhas ao abrir portas:** mesmo sem névoa, cada mudança no mapa redesenhava todos os painéis e a imagem do mapa, o que engasgava a tela nos aparelhos mais fracos. Agora mudar porta, parede, desenho ou névoa só redesenha o que mudou no mapa.
- **Travadinhas com a névoa ligada:** a tela congelava por um instante nos outros aparelhos quando a névoa liberava parte do mapa, quando uma porta abria e a cada mudança na mesa, porque a máscara da névoa era refeita inteira a cada envio. Agora ela só é refeita quando o que se vê muda, e essa conta ficou bem mais leve.
- **Dados 3D que não apareciam:** se um dos sons dos dados não terminasse de carregar (celular em economia de bateria ou de dados, arquivo que empacava), nenhum dado aparecia nem soava até recarregar a página. Agora os dados rolam mesmo sem o som, e o que faltou tenta carregar de novo no próximo toque na tela.

## [2.10.0] - 2026-10-29

### Adicionado
- **Efeito Luz sagrada:** efeito de mapa novo (em *Fixar como efeito*), no espírito dos *Espíritos Guardiões*: brilho dourado no meio da área, riscos de luz girando no chão, fagulhas subindo e seis luzinhas cor de chama rondando perto da borda, com rastro, o que ajuda a ver até onde a área vai. Com *Anda junto com quem conjurou*, acompanha o token.
- **Setas dos jogadores:** a ferramenta *Setas* (tecla B) deixa o jogador desenhar setas no mapa para a mesa ver ("vou por aqui"), na cor que escolher. Cada um apaga as próprias (borracha, *Desfazer* ou *Apagar minhas setas*) e o mestre apaga as de todos; com mais de 10, a mais antiga do jogador some. Vão no arquivo de sessão.
- **Botão Levantar:** personagem caído ganha o botão *Levantar* ao lado do "Caído" no painel *Selecionado* e no menu do token: volta com 1 de vida e zera os testes contra a morte. Curar continua levantando com o valor da cura.
- **Alcance da visão por cena:** com a névoa e a *Visão dos personagens* ligadas, o mestre escolhe ao lado até onde os personagens enxergam nesta cena: 30, 60 ou 120 ft (igual para todos), ou *Pela luz do clima*, como antes (dia 120 ft, noite 20, com tocha e visão no escuro). Em mapa grande e aberto, o alcance fixo evita que o grupo veja o mapa inteiro. Vai no arquivo de sessão.
- **Números de dano e cura no mapa:** quando a vida de um token muda, sobe dele um número, "−12" em vermelho ou "+8" em verde, e no dano o token treme e pisca vermelho. Vale para todo mundo, inclusive nos mobs: o jogador vê quanto o goblin levou, nunca a vida dele. Mob oculto ou coberto pela névoa não mostra nada para os jogadores. Troca de fase do chefe não vira "cura".
- **Ataques salvos na aba Dados:** os ataques salvos na ficha (Selecionado → Ataques) aparecem no painel *Dados* como botões "Ataques de Thorin": um clique rola o ataque (com a vantagem ou desvantagem escolhida e as travas de turno) e deixa o dano pronto no campo de baixo, com o crítico marcado se sair 20. Para o mestre, valem os ataques de quem está em *Rolar como*.
- **Cartão Preparar a mesa:** numa sessão nova, o mestre vê no topo da aba *Combate* os três passos para montar a mesa (Mapa, Monstros, Convidar jogadores), com progresso. Clicar num passo abre a aba e o painel certos (que piscam); os passos se marcam sozinhos e o cartão some quando a mesa está pronta, ou com *Pular*. *Usar só o grid* dispensa a imagem do mapa.
- **Atalhos de teclado:** a tecla **?** (ou o botão de teclado na barra do topo) abre a lista. Ferramentas do mapa por letra (V mover, R régua, A área, P ping, B desenho ou setas; o mestre também W paredes e F névoa), +/− e 0 para o zoom e enquadrar; no token selecionado, D e C abrem o menu já no dano ou na cura, K nas condições, Enter abre o menu, setas andam uma casa, T tocha, H esconde (mestre), Del remove e Esc tira a seleção; N e Shift+N passam o turno (mestre). Os tooltips das ferramentas e o menu do token mostram as letras. Nada dispara com o foco num campo de texto.
- **Menu de contexto no token:** botão direito num token (no celular, tocar e segurar) abre um menu com a vida rápida (digite o valor: Enter aplica dano, Shift+Enter cura), as condições em medalhões (clicar liga e desliga; embaixo, outra condição com rodadas), ver no painel, tocha, esconder dos jogadores (mestre), tirar do mapa e remover. O jogador vê as ações só nos próprios personagens.
- **Tela de entrada nova:** o fundo é o tapete de couro da mesa à luz de uma vela (luz quente que oscila, bordas no escuro e fagulhas subindo). O cartão virou uma placa de couro com cantoneiras nos quatro cantos, o d20 flutua com um halo, o título ganhou um degradê de ouro e o papel (Mestre ou Jogador) aparece numa fita. A arte própria de fundo (`login-bg`) continua valendo. Com *Reduzir efeitos*, nada anima.
- **Avisos no estilo do jogo:** os avisos rápidos viraram uma placa de couro com cantoneiras e um medalhão com ícone na cor do tipo: bronze (aviso), verde-cobre (confirmação, novo: sessão salva ou carregada, mapa enviado, som adicionado) e sangue (erro, que treme ao chegar). Entram subindo e têm um fio que mostra o tempo até sumir, parado enquanto o mouse está em cima. O "Desfazer" ganhou ícone.
- **Estados vazios:** painéis e listas sem conteúdo mostram um medalhão com o ícone do assunto, um título curto (ex.: "Nada selecionado", "Sem combate") e a orientação de sempre, numa área tracejada; nas listas pequenas (mobs, NPCs, log, ataques, itens, sons) numa linha só.
- **Painéis com cara de couro:** os painéis ganharam textura de couro (grão fino e manchas de uso), moldura dupla com um filete de bronze por dentro, rebites nos cantos e um filete duplo depois do título; as colunas, o mesmo grão mais fraco. As divisórias com nome viraram uma linha de bronze com o nome em Cinzel entre losangos.
- **Microanimações na interface:** botões afundam ao clicar e o principal tem relevo e um reflexo ao passar o mouse; nas listas, um filete de bronze aparece à esquerda no hover, quem entra desliza e a vez nova pisca de leve; o número da vida pula e pisca em vermelho (dano) ou verde (cura); o selo da rodada gira quando muda. *Reduzir efeitos* (e a opção do sistema de reduzir movimento) desliga todas.
- **Trilha de iniciativa no mapa:** durante o combate, uma faixa no topo do mapa mostra a ordem com os tokens do próprio mapa. A vez vem primeiro, maior, com halo dourado e o nome numa placa de ouro; depois quem vem em seguida e, passado o marcador da próxima rodada, apagados, os que já agiram. Grupo de mobs iguais aparece empilhado com "×3"; quem atrasou a vez ganha uma ampulheta; cada um tem a barrinha de vida (o jogador não vê a dos mobs). Clicar num token da trilha seleciona e leva a câmera até ele. A faixa tem largura máxima: com muita gente, o fim mostra "+N", que abre (passando o mouse ou tocando) a ordem inteira numa lista simples a partir da vez, com os seus personagens destacados e "Sua vez daqui a N". Mob oculto não aparece.
- **Partículas das condições:** além do medalhão, quatro condições ganharam uma animação leve em volta do token: bolhas verdes que sobem e estouram (*Envenenado*), estrelinhas girando em cima da cabeça (*Atordoado*), corações subindo (*Enfeitiçado*) e "Z" saindo do token (*Inconsciente*). Com *Reduzir efeitos*, nada aparece.
- **Crítico e falha no d20:** no 20 natural o resultado no mapa fica dourado, com um brilho que pulsa, o número salta com um reflexo e solta faíscas; no 1 natural a placa treme, pisca em vermelho e racha, e o número "cai". No log, a linha ganha um filete dourado ou vermelho e o d20 pintado; o crítico recém-rolado tem um reflexo que passa uma vez. O 20 natural passou do verde-cobre para o dourado. Com *Reduzir efeitos*, ficam só as cores.
- **Começo da vez:** quando a vez passa, o token de quem joga solta uma onda dourada. A opção **Câmera segue a vez** (na barra do mapa, de cada um e desligada por padrão) faz o mapa deslizar até quem está jogando a cada troca de turno.
- **Tokens com moldura de metal:** todo token no mapa ganhou uma moldura forjada com rebites e relevo: bronze nos aliados, ferro nos mobs e prata nos NPCs (o formato continua dizendo o lado), e a cor do token aparece numa faixa fina por dentro. Na vez, o token ganha um halo quente e um contorno aceso com luzes girando; selecionado, um tracejado que anda em volta; caído, o retrato fica cinza com uma caveira. Com *Reduzir efeitos*, nada anima.
- **Placas de nome no mapa:** ao passar o mouse, selecionar ou arrastar um token, o nome aparece numa plaquinha de metal embaixo dele (bronze nos aliados, ferro nos mobs, prata nos NPCs, menor nos pets e invocados); assim tokens lado a lado não ficam com os nomes um por cima do outro. O chefe mostra o nome sempre, numa fita de pergaminho com filetes de ouro e rubis. Mobs repetidos (Goblin 1, 2, 3…) mostram sempre o número num escudinho dentro do token, no canto de cima à esquerda, e o nome inteiro na placa ao passar o mouse. O texto flutuante do hover agora mostra só "(oculto)" e a distância ao arrastar.
- **Condições com ícone no token:** cada condição aparece num medalhão com ícone (frasco de veneno, estrelinhas de atordoado, algemas, olhos vendados…) em arco pelo lado direito do token, no lugar do selo com o número. Concentração tem o aro azul; condição digitada à mão ganha um brilho. Se não couber, o último medalhão mostra "+2". Nomes e rodadas ficam no painel *Selecionado* (o texto das condições saiu de cima do token).
- **Barra de vida com cara de jogo:** no mapa, nas listas e no painel, a barra virou uma pílula de calha funda com fio de bronze, marcas a cada 25% e losangos nas pontas. Ao tomar dano, a vida desce rápido e o pedaço perdido fica claro por um instante antes de sumir devagar (dano fantasma); a cura dá um brilho verde; a vida temporária aparece como um escudo azul listrado. O chefe tem barra própria: placa de ferro escuro com pontas em chanfro, filete de ouro, vida em carmesim e rubis. Com *Reduzir efeitos*, nada anima.
- **Mesa em volta do mapa:** o que fica fora da imagem do mapa virou uma mesa, e o mapa fica "pousado" nela com sombra projetada e a borda levemente escurecida, como papel na mesa. Três mesas por cena, no painel *Mapa*: **madeira escura** (padrão), **tapete de couro** (com costura em volta do mapa) e **ardósia**. O grid continua sobre a mesa, para os tokens fora da imagem. A área do mapa ganhou uma **vinheta** (bordas escurecidas, luz de cena no centro). Vinheta e borda do mapa somem com *Reduzir efeitos*. Vai no arquivo de sessão.
- **Paredes e portas com textura:** as paredes ganharam desenho de verdade, em três estilos escolhidos por cena nas opções da ferramenta *Paredes*: **pedra lavrada** (blocos em duas fiadas, para masmorra e castelo), **rocha bruta** (contorno irregular com rachaduras, para caverna e ruína) e **madeira** (tábuas com veios e esteios pregados, para casa e paliçada). As portas são de madeira vista de cima, com cintas de ferro, rebites e argola, entre batentes que acompanham o estilo da parede; aberta, a folha gira na dobradiça e um arco pontilhado mostra o caminho. O mestre vê a trancada com um cadeado vermelho e a secreta translúcida com contorno violeta. A espessura é proporcional ao tamanho do quadrado. Vai no arquivo de sessão.
- **Espessura das paredes:** nas opções da ferramenta *Paredes*, o controle *Espessura* define a grossura das próximas paredes e portas, de 0,1 até 1 quadrado (muralha grossa por fora, paredes finas por dentro). Cada parede guarda a sua, inclusive no *Desfazer* e no arquivo de sessão. A névoa e a visão continuam bloqueando pela linha do meio da parede.
- **Portas duplas:** duas portas em linha que se encostam numa ponta viram uma porta dupla: as dobradiças ficam nas pontas de fora e as duas folhas abrem para o mesmo lado, cada uma para a sua ponta.
- **Paredes em traço livre:** na ferramenta *Paredes*, a opção *Livre* deixa as pontas da parede (ou porta) em qualquer ponto do mapa, não só nos cantos do grid; *Nos cantos* continua como antes. A névoa, o cômodo e a visão dos personagens respeitam as paredes livres do mesmo jeito.
- **Desfazer nas paredes:** o botão *Desfazer* (ou Ctrl+Z com a ferramenta *Paredes*) volta a última parede ou porta colocada, ou traz de volta a última apagada com a borracha (com o estado da porta). Guarda até 50 passos neste navegador; *Apagar todas* não entra.
- **Chefe:** no formulário de mob, NPC e template, a marca *Chefe* dá ao token uma moldura de carta de jogo: ferro escuro com um arco gótico no alto, um filete de ouro que corre a borda e se enrola em volutas nas quinas, rubis lapidados e uma caveira de ouro embaixo. Todos veem a moldura (as fases continuam só com o mestre). Vai no arquivo de sessão.
- **Pôr mobs sem sair do combate:** o botão **+** no painel *Mobs* (aba Combate) abre o bestiário numa janela, com as mesmas opções da aba Mesa (quantidade, *+ Mobs*, *+ NPC*, ocultos, avulso e template). Ao adicionar, a janela fecha e os mobs novos aparecem na lista, prontos para arrastar ao mapa.
- **Faixa para quem chega com o combate andando:** o jogador cujo personagem está sem iniciativa ou fora do mapa vê no topo da ficha "O combate já começou", com os botões que faltam (*Rolar iniciativa*, *Colocar no mapa*). A faixa some quando os dois estiverem feitos.

### Alterado
- **Limpar campo mudou de lugar:** saiu da barra do topo (onde ficava ao lado dos controles do dia a dia) e foi para a aba *Mesa*, no painel *Sessão*, junto de Salvar e Carregar. Continua pedindo confirmação.
- **Painel Selecionado mais enxuto:** as ações de menos uso (tirar ou colocar no mapa, invocar, tocha, alcance e ocultar) ficaram num menu **Mais**; o **Remover** ficou sozinho do outro lado, longe do clique distraído. O alcance abre a mesma janelinha de antes.
- O botão *Reduzir o clima* virou **Reduzir efeitos** e fica sempre na barra do mapa: além do clima, ele para as animações do mapa (números, onda da vez, brilhos, fumaça da névoa, partículas).
- **Tokens um pouco menores** (76% da casa em vez de 86%): com a moldura, a barra de vida e os selos, cada token cabe na própria casa e tokens vizinhos não se encostam mais. O tamanho no grid não muda: uma criatura média continua ocupando uma casa. Tudo em volta do token (barra de vida, medalhões de condição, selos, placa de nome, textos) acompanha o tamanho do quadrado do grid, sem tamanho mínimo: com o quadrado pequeno, use o zoom para ver de perto.
- O painel *Mobs na batalha* passou a se chamar só *Mobs*, como *NPCs* e *Aliados*.
- **Borracha de verdade:** no desenho e nas paredes, a borracha apaga só por onde passa, arrastando (um círculo mostra o tamanho dela). O traço livre e a parede são cortados; seta, círculo e porta tocados somem inteiros. No desenho, o tamanho da borracha é escolhido no lugar da espessura (pequena, média, grande). Nas paredes, *Desfazer* volta a passada inteira.
- Em português, **"round" virou "rodada"** em toda a interface (iniciativa, trilha, condições e efeitos com duração, barra do topo). Rodada é a volta inteira da iniciativa; turno continua sendo a vez de cada um.
- **Casa do grid até 1000 px** (antes 400), para mapas muito grandes; o controle do tamanho ficou em escala que dá precisão nas casas pequenas e alcance nas enormes.
- **Tablet e celular:** *Destacar o log* deixa o log flutuando sobre a mesa em vez de abrir outra aba do navegador.
- Enquanto os dados 3D de uma iniciativa rolam, o número dela fica escondido (um dado girando no lugar) no painel *Iniciativa* e na trilha: o mestre não vê o resultado antes da animação.

### Corrigido
- **Cobrir tudo** na névoa escondia os inimigos mas deixava um "?" no lugar de cada um (só sumiam no segundo clique). Agora some tudo de uma vez; cobrir com o pincel ou o cômodo também não deixa mais "?".
- **Mob ou NPC caído:** só o mestre via a caveira; agora todos veem que caiu (sem receber a vida).
- Depois de trocar de cena (ou com a conexão caindo no meio do envio), um jogador podia ficar sem a imagem do mapa até recarregar a página. Agora o app percebe que a imagem ficou para trás e pede de novo; imagem que o tablet não consegue abrir é tentada outra vez.
- Efeito fixo num token e o alcance (aura) só acompanhavam depois de soltar o token; agora andam junto enquanto ele é arrastado.
- Janelas (como o *Sobre*): o título e o X desciam junto com o texto ao rolar; agora ficam presos no topo.

## [2.9.0] - 2026-10-28

### Adicionado
- **Sobre:** clicar na versão, ao lado do nome no topo (no celular, *Sobre* no menu ☰), abre a janela com versão, autor, o que o app é, os créditos e licenças das bibliotecas, fontes e ícones usados, e a nota de que o projeto é independente, sem ligação com editoras de RPG.
- **Visto por último aqui:** com a *Visão dos personagens* da névoa ligada, um inimigo que sai da vista do grupo (porta que fecha, ele que anda para o escuro, o aliado que se afasta) deixa um **?** vermelho pulsando, com o nome dele, no último lugar em que foi visto. A marca fica legível até à noite. Ela some quando alguém volta a ver aquele lugar (esteja o inimigo lá ou não), quando ele reaparece, sai da batalha ou é ocultado pelo mestre. O mestre vê a marca mais apagada. *Cobrir tudo* limpa as marcas, e elas vão no arquivo de sessão.
- **Tochas:** aliados, NPCs e mobs podem acender uma tocha pelo botão *Tocha* no painel *Selecionado*. O jogador acende a do próprio personagem e o mestre, a de qualquer um. O token ganha um selo com uma chama tremulando, a lista mostra um ícone de chama e o mapa ganha um brilho quente e tremulante: 20 ft de luz forte e mais 20 de meia-luz. À noite (e no luar ou no entardecer) a tocha **ilumina de verdade**, porque o escurecimento do clima se abre em volta dela. Com a *Visão dos personagens* da névoa ligada, quem segura a tocha enxerga 40 ft no escuro, e a área iluminada por qualquer tocha, até a de um inimigo, aparece de longe para quem tem linha de visão até ela: um goblin com tocha no fim do corredor escuro é visto. Mob oculto não ilumina, para não se entregar. Vai no arquivo de sessão.
- **Visual da névoa de guerra:** a névoa é fumaça de verdade, em duas camadas que derivam devagar em direções diferentes. Para os jogadores é uma escuridão densa com reflexos violeta; para o mestre, uma bruma cinza translúcida. A borda entre o que se vê e o que está coberto ficou esfumaçada e irregular, com fiapos que avançam um pouco além das casas, em vez de quadrados. O formato não treme ao pintar nem ao andar. A área explorada é a mesma fumaça, mais rala. Com *Reduzir o clima* a fumaça fica parada.
- **Névoa de guerra (parte 3, visão dos personagens):** na ferramenta *Névoa*, a opção *Visão dos personagens* faz cada aliado no mapa revelar em volta dele. Paredes e portas fechadas bloqueiam a linha de visão: abriu a porta, enxerga para dentro pelo vão. O raio vem da luz do clima: dia 120 ft, entardecer 60, luar 30 e noite 20 (a tocha); com *Visão no escuro*, 60 ft no escuro. O que algum aliado já viu fica **explorado**: o mapa, as paredes e os efeitos continuam à mostra, escurecidos, mas sem os inimigos de agora, que só aparecem enquanto alguém está vendo. A visão é da mesa toda (o que um vê, todos veem). O que o mestre revela à mão continua sempre visível, e *Cobrir* e *Cobrir tudo* apagam também o explorado. Vai no arquivo de sessão.
- **Névoa de guerra (parte 2, revelar o cômodo):** na ferramenta *Névoa*, o modo *Cômodo* revela (ou cobre) com um clique tudo o que está dentro da sala, até as paredes e as portas fechadas. Vale também para paredes diagonais. Porta aberta deixa passar para o outro lado. Se a área não fecha, o app avisa em vez de revelar o mapa inteiro.
- **Névoa de guerra (parte 1, pintada pelo mestre):** ferramenta *Névoa* na barra do mapa. Com *Névoa nesta cena* ligada, o mapa começa todo coberto para os jogadores, e o mestre revela ou cobre arrastando com o pincel (1×1, 3×3 ou 5×5 casas) ou com um retângulo. *Revelar o mapa* abre todas as casas da imagem e *Cobrir tudo* fecha de novo. O mestre vê através da névoa, como uma bruma cinza. Os jogadores veem escuro, e mobs, NPCs, efeitos, desenhos e paredes que estão inteiros na parte coberta nem chegam a eles. Os aliados sempre aparecem. Cada cena tem a sua névoa, que vai no arquivo de sessão; *Limpar campo* desliga.
- **Chefe com fases:** no formulário de mob, NPC ou template do bestiário, o mestre acrescenta fases (*+ Fase*, até 5 além da primeira), cada uma com a vida e, se quiser, nome e CA novos. Quando a vida da fase atual zera, a próxima começa com vida cheia (o dano que sobrou não passa) e o log avisa: "Avanthir passou para a fase 2: agora é Avanthir Enfurecido." O mestre vê "Fase 2 de 3" e as barras que ainda vêm no painel *Selecionado*; os jogadores veem só "fase 2" na lista, nunca a vida das fases. Vai no arquivo de sessão.
- **Efeitos que andam com o token:** ao fixar uma área como efeito, marque *Anda junto com quem conjurou* e a área acompanha o token dele quando ele anda, mantendo a mesma posição em relação a ele (aura do paladino, *Espíritos Guardiões*, um cone saindo dele). No painel *Efeitos no mapa*, o botão de corrente prende ou solta um efeito já fixado. Tirar o token do mapa e pôr de volta não leva o efeito junto. Vai no arquivo de sessão.
- **Regras da mesa:** painel novo na aba *Mesa* do mestre, com opções desligadas por padrão. **Movimento só na sua vez**: em combate, cada jogador só move (e coloca ou tira do mapa) os próprios tokens na vez dele, ou na vez de um invocado dele; fora de combate continua livre. **Invocar só na sua vez**: em combate, o jogador só invoca na vez dele. **Lembrete de escuridão**: com a luz em *Noite* ou *Luar*, o jogador cujo personagem não tem a marca nova **Visão no escuro** (no formulário do personagem) vê um aviso no mapa, que pode fechar até a luz mudar; o mestre vê quem está sem no painel *Clima*. Só informa. O mestre nunca é travado, a trava é conferida no servidor e o log avisa quando uma regra é ligada ou desligada. Vão no arquivo de sessão.
- **Mostrar para a mesa:** na aba *Mesa*, o mestre escreve um título e um texto e/ou escolhe uma imagem (carta, retrato, mapa do tesouro) e clica *Mostrar para todos*: abre por cima da mesa na tela de cada um (e no celular). Cada um fecha o seu e pode reabrir pelo botão *Ver o que o mestre mostrou* no topo; *Parar de mostrar* fecha para todos. Quem entra no meio também vê. O log avisa "O mestre mostrou: Carta do barão."
- **Rolagem secreta por um jogador:** na ficha de um personagem, o mestre clica num atributo e escolhe *Rolar à vista* ou *Rolar em segredo*. Em segredo, o teste (d20 + modificador do personagem) vai para o log só do mestre, marcado "Secreto" (ex.: Percepção sem o jogador saber que algo está escondido).
- **Descrição e notas do mestre:** todo combatente e todo template do bestiário têm uma **descrição** que todos veem ao clicar nele ("Avanthir, o Sábio: dragão ancião de neve…"), e o mestre tem **notas do mestre** (segredos, táticas), que os jogadores nunca recebem, nem o dono do personagem. Criar do bestiário leva a descrição e as notas do template para o mob ou NPC. As notas que o bestiário já tinha viraram as notas do mestre. Vão no arquivo de sessão.
- **Log de rolagens fora da mesa:** o botão do log no painel *Dados* abre o log direto numa janela própria, ao lado da mesa, para arrastar a outro monitor. O log fica num lugar só: com ele fora, a mesa mostra só *Trazer de volta*. Fechar a janela de fora (ou *Voltar para a mesa* nela) traz o log de volta ao painel. Se o navegador bloquear pop-ups, o log abre flutuando dentro da mesa, e arrastar essa janela para fora tenta de novo. Ela entra sozinha com o mesmo nome, atualiza ao vivo e não toca som nem repete avisos. Funciona no navegador e no app do mestre (fechar a mesa fecha a janela do log junto).
- **Recolher as colunas laterais:** botão com seta no meio da borda de cada coluna esconde a coluna inteira e dá o espaço ao mapa (o mesmo botão abre de volta). Arrastar a borda até o fim também recolhe: passando do limite, a coluna fica apagada na largura mínima e recolhe ao soltar (sem ficar abrindo e fechando durante o arrasto). Puxar a borda de uma coluna recolhida abre. Fica guardado no navegador; nada do que estava nos painéis se perde.
- **Cor do alcance/aura:** no popover do *Alcance*, escolha a cor do círculo (a do token, que é o padrão, ou bronze, vermelho, azul, verde e pergaminho). Com o círculo já no mapa, a cor muda na hora. Vai no arquivo de sessão.

### Alterado
- **Inglês e espanhol, parte 4 (log):** os avisos automáticos do log e dos avisos rápidos ("Regra da mesa ligada…", "Orc passou para a fase 2", "Thorin fez um descanso longo", condições e efeitos que acabam, invocados que somem, reação, transformações…) e os rótulos das rolagens automáticas (*Iniciativa*, *Reação*, *Ataque*, *Secreto*, recarga) aparecem no idioma de quem lê, e o autor "Mesa" e "Mestre" também. Cada um lê no próprio idioma, ao mesmo tempo. Logs de arquivos salvos antes disso continuam em português.
- **Inglês e espanhol, parte 3 (recusas do servidor):** as mensagens de erro que vêm do servidor ("Essa casa já está ocupada por Orc.", "Não é a sua vez.", "Arquivo inválido: mapa."…) aparecem no idioma de quem joga, com os nomes e números no lugar. São cerca de 180 mensagens e 140 rótulos traduzidos.
- **Inglês e espanhol, parte 2 (mapa, ambiente e mesa):** a barra e as ferramentas do mapa (régua, área, ping), os painéis *Mapa*, *Clima*, *Som*, *Efeitos no mapa*, *Sessão* e *Convidar jogadores*, as janelas de fixar e transformar efeito, *Limpar campo*, o volume, o aviso ao fechar o app, o log flutuante e os avisos de imagem e arquivo aparecem no idioma escolhido. Os nomes das listas também: tipos de efeito (Fogo, Teia…), climas, luzes e sons gerados. Um efeito novo sem nome ganha o nome do tipo no idioma de quem o fixou.
- **Inglês e espanhol, parte 1 (combate):** Iniciativa, Dados (inclusive pedidos de rolagem, reação e rolagens fora de combate), Selecionado, Condições, Magia, Invocar, Mobs, NPCs, Aliados, Bestiário, *Na sessão* e o log de rolagens aparecem no idioma escolhido. Os nomes das condições da lista também: quem escolhe *Prone* grava *Caído*, e cada um vê no próprio idioma. O que a mesa digita (nomes, notas, condições livres) continua como foi escrito.
- **Coluna do mestre em abas:** a coluna da esquerda do mestre virou quatro abas: *Combate* (iniciativa, mobs, NPCs, aliados, efeitos), *Mapa* (cenas e mapa), *Ambiente* (clima e som) e *Mesa* (bestiário, jogadores, sessão e convite). A aba não troca sozinha: se a vez mudar com outra aba aberta, *Combate* ganha um ponto. A aba escolhida fica guardada no navegador. Para os jogadores nada muda.
- **Descanso curto e longo:** pedem confirmação, ficam bloqueados para os jogadores durante o combate e aparecem no log ("Thorin (Ana) fez um descanso longo."). O mestre ganhou *Descanso* no painel *Aliados*, para dar o descanso curto ou longo a todos os aliados de uma vez.
- **"Conjurar" virou "Invocar":** o botão do painel *Selecionado* e os textos sobre criaturas chamadas (familiar, esqueletos…) passam a falar em *invocar*, *invocado* e *invocador*. "Quem conjurou" continua nos efeitos de magia no mapa (lá é lançar a magia).
- **Ping:** ganhou um botão próprio na barra do mapa (toque ou clique no ponto e a ferramenta volta para *Mover*); no computador, também Alt+clique ou o botão do meio do mouse. Segurar parado não pinga mais, nem no mouse nem no dedo: brigava com arrastar a visão e os tokens.

### Corrigido
- **Iniciativa rolada uma vez só:** o jogador podia rolar a própria iniciativa de novo quantas vezes quisesse, até no meio do combate, e mudar a ordem. Agora rola (ou digita o dado físico) uma vez; depois, mudar ou rolar de novo é com o mestre, ou com *Iniciativa de novo*, que zera todas e libera uma nova rolagem para cada um.
- **Nomes repetidos de mobs:** o bestiário e o *Invocar* numeravam cada um por conta própria e criavam dois "Zumbi 1". Agora o número continua do maior em uso na mesa (em qualquer cena): com Zumbi 1 a 3 invocados, o bestiário cria Zumbi 4 e 5.

## [2.8.1] - 2026-10-26

### Corrigido
- **iPhone e iPad:** música, ambiente e efeitos da mesa não tocavam com a chave de silencioso ligada (só o barulho dos dados soava). Agora o som da mesa toca como mídia, igual a um player de música (iOS 17 ou mais novo).

## [2.8.0] - 2026-10-26

Melhorias da mesa: ficha mais completa, combate mais fluido, mapa com cenas, desenho, paredes e portas, e o começo da tradução para inglês e espanhol. Arquivos de sessão salvos nesta versão só abrem na 2.8 ou mais nova.

### Adicionado
**Ficha**
- **CA e atributos** em aliados, mobs, NPCs, conjurados e no bestiário. Vida, CA e bônus de iniciativa são obrigatórios; FOR, DES, CON, INT, SAB e CAR são opcionais, com o modificador calculado (10 = +0, 12 = +1, 20 = +5). Com DES preenchida, o bônus de iniciativa acompanha o modificador dela (dá para mudar à mão). Jogadores não veem a CA nem os atributos de inimigos e NPCs.
- **Tamanho das criaturas:** Miúdo, Pequeno, Médio, Grande (2×2), Enorme (3×3) e Imenso (4×4), no formulário e no bestiário. O token cobre as casas, ninguém entra no espaço de uma criatura grande e ela não pousa em cima de ninguém; o miúdo divide a casa (fica no canto dela). Ao posicionar um conjurado, a régua mede da borda de quem conjurou.
- **Ficha em abas** no painel *Selecionado*: Magia, Recursos, Ataques e Itens (mob e NPC: Recursos e Ataques, só para o mestre). É pessoal: outros jogadores não veem.
  - **Recursos com usos** ("Fúria 3/3", "Ki 5/5"), que voltam no descanso curto, no longo ou só à mão, com os botões *Descanso curto* e *Descanso longo* (vida cheia, slots e recursos de volta, sem vida temporária). O *Restaurar tudo* virou *Descanso longo*.
  - **Ataques salvos** ("Machado grande +5 / 1d12+3"): um clique rola o ataque, o dano ou o dano de crítico.
  - **Inventário** com quantidade e nota, e **moedas** (PL, PO, PE, PP, PC).
- **Vida temporária:** botão *Temp.* na vida (o valor substitui o anterior, não soma). O dano tira dela primeiro; aparece como "+5 temp." e num trecho claro da barra de vida. Jogadores não veem a dos inimigos.
- **Testes contra a morte:** personagem com 0 de vida ganha três marcas de sucesso e três de falha (quem joga marca) e o botão *Rolar teste contra a morte*. Voltar a ter vida zera as marcas.
- **Teste de atributo pela ficha:** clicar num atributo rola d20 + modificador no log ("Thorin (Ana) · Teste de SAB").

**Combate**
- **A vez de cada um** (painel *Iniciativa*, para quem está na vez e para o mestre):
  - **Passar a vez:** o jogador encerra a própria vez e o turno avança ("Thorin (Ana) passou a vez" no log).
  - **Atrasar:** agir mais tarde no mesmo round, depois de alguém que ainda vai agir; o começo do turno (condições, efeitos) não desconta duas vezes.
  - **Ações do turno:** Ação, Ação bônus, Movimento e Reação para marcar o que já gastou; zeram no começo da vez seguinte.
- **Grupos de mobs na iniciativa:** mobs do mesmo template com a mesma iniciativa (como na *rolagem por template*) viram uma linha só, "Goblin 1–6", e **agem na mesma vez**: o *Próximo turno* passa pelo grupo inteiro, o começo da vez vale para cada um e *Atrasar* leva todos juntos. A linha abre para ver e editar cada um.
- **Lembrete de Concentração:** quem está com *Concentração* e toma dano gera o aviso "Teste de Concentração para Lia: CD 13" (metade do dano, mínimo 10), no log e na tela. De mob ou NPC, só o mestre vê. Só lembra: quem joga rola e decide.
- **Chefes:** recursos que voltam **no começo da vez** (ações lendárias) e com **recarga no d6** ("Sopro de fogo, recarga 5–6": no começo da vez do chefe, se estiver gasto, o app rola o d6 oculto e devolve o uso com 5 ou 6). Resistência lendária usa a volta no descanso longo.
- **Alcance / aura:** botão *Alcance* no painel *Selecionado* (5, 10, 15, 30 ft ou outro valor) desenha um círculo leve em volta do token, a partir da borda dele, visível para todos. Enquanto o token é arrastado, o círculo fica onde ele estava. Só visual: o app não confere quem está dentro.

**Mapa**
- **Vários mapas (cenas):** painel *Cenas* (só o mestre) para preparar outros mapas e trocar com um clique. Cada cena guarda imagem e grid, mobs, NPCs, efeitos, desenhos, paredes, clima e onde os aliados estavam; trocar guarda a atual como está e carrega a outra (só fora de combate; a iniciativa zera). Cena nova começa vazia com o mesmo grid. As cenas vão no arquivo de sessão; arquivos antigos abrem como uma cena só. O formato do arquivo passa a ser o 2: a 2.7 recusa abrir um arquivo da 2.8 (pede para atualizar) em vez de perder as outras cenas.
- **Desenho do mestre no mapa:** ferramenta *Desenho* (só o mestre) com traço livre, seta e círculo, cinco cores e três espessuras. Fica no mapa para todos até ser apagado (*Borracha* num desenho, *Desfazer* o último ou *Apagar tudo*), vai no arquivo de sessão e sai com *Limpar campo*. Com *Só eu vejo*, o desenho fica tracejado e os jogadores não recebem (anotação de armadilha, porta secreta).
- **Paredes e portas:** ferramenta *Paredes* (só o mestre) traça paredes e portas nas linhas do grid, de canto a canto. Qualquer um abre e fecha uma porta com um clique (ferramenta *Mover*); o mestre pode **trancar** (só ele abre) ou deixar **secreta** (os jogadores não veem até ele revelar). Só visual: não bloqueia movimento. Vão no arquivo de sessão e saem com *Limpar campo*.
- **Ping no mapa:** segure o clique ou o dedo parado num ponto (ou use Alt+clique) e ondas pulsam ali por uns segundos para todos, com o nome de quem marcou. O seu aparece em bronze; o dos outros, em azul.
- **Colocar no mapa pelo celular:** *Colocar no mapa* na Ficha troca para a aba Mapa; o primeiro toque marca a casa e o segundo confirma (*Cancelar* no aviso). Conjurados com *Escolher no mapa* também vão direto para o Mapa, com a régua até quem conjurou.

**Idioma**
- **Idioma da interface:** português, inglês ou espanhol, escolhido no ícone de idioma (tela de entrada, barra do topo e menu do celular); começa no idioma do navegador e vale só para quem escolheu. A tradução está começando: a tela de entrada, a barra do topo, o celular e as telas novas desta versão; o resto segue em português por enquanto.

### Alterado
- Com o mapa estreito (colunas laterais largas), a barra de ferramentas do mapa mostra só os ícones, para caber inteira.

### Corrigido
- Ao carregar uma sessão salva, um efeito transformado com *Quando acabar, volta a ser…* perdia o dono ao voltar ao estado anterior (o jogador deixava de controlá-lo).

## [2.7.0] - 2026-10-26

### Adicionado
- **Barulho dos dados:** ao rolar, os dados batem na mesa e uns nos outros, no ritmo da animação. Segue o volume de efeitos da mesa e o seu volume geral (mudo = sem barulho).

### Alterado
- Efeitos sonoros mais realistas: **trovão** (estalo que rasga e ronco que rola), **explosão**, **golpe de espada** (lâmina cortando o ar e o aço tinindo), **flecha** (o voo passando e o baque na madeira), **magia**, **raio elétrico** e **moedas**. Cada toque sai um pouco diferente.
- Ambiente **Tempestade**: trovões mais espaçados, uns perto e outros longe (mais baixos e abafados).

### Corrigido
- Tocar o ambiente sugerido pelo painel *Clima* não atualizava o seletor de *Ambiente* no painel *Som*.

## [2.6.0] - 2026-10-26

### Adicionado
- **Tela de celular e tablet para jogadores:** abas embaixo (Mapa, Ficha, Dados, Combate), topo compacto com "Sua vez!", abas na lateral com o celular deitado e opção de trocar para a tela de computador. O mestre continua na tela de computador. (E23)
- **Mapa no toque:** dois dedos aproximam e afastam (também no tablet deitado); régua e área funcionam com o dedo. (E23)

### Corrigido
- No iPhone, tocar na tela agora também libera o som da mesa. (E23)

## [2.5.0] - 2026-10-25

### Adicionado
- **Clima no mapa:** painel *Clima* do mestre com chuva, chuva forte, tempestade com relâmpagos (clarão e trovão juntos para todos), granizo, neve, nevasca, névoa, vento com folhas, tempestade de areia, cinzas, brasas, calor, vagalumes, luzes mágicas, esporos, pétalas e chuva de sangue, com intensidade e vento; luz da cena (dia, entardecer, noite, luar); sugestão do ambiente sonoro que combina. Botão para reduzir o clima em computadores mais fracos. (E26)
- **Rolagens fora de combate:** o mestre escolhe se os jogadores rolam livres, só quando ele pedir (o *Pedir rolagem* agora funciona fora de combate, ex.: "Percepção") ou se as rolagens ficam travadas. (E26)
- **Antispam de dados:** o jogador espera os próprios dados pararem antes de rolar de novo. (E26)

### Alterado
- O log mostra quem rolou sempre como **personagem (jogador)**: "Thorin (Jorge)", "Goblin 2 (Mestre)"; o mesmo nos dados 3D, na iniciativa e nos avisos. (E26)
- *Rolar como* do mestre já vem com o combatente **selecionado** no mapa (senão, o da vez; senão, Mestre). (E26)
- O log espera os dados 3D pararem para mostrar o resultado ("Rolando…" até lá). (E26)

### Corrigido
- O nome de um token no mapa ficava escondido atrás do token vizinho ao passar o mouse. (E26)

## [2.4.0] - 2026-10-25

### Adicionado
- **Som da mesa:** no painel *Som*, o mestre toca **música** e **ambiente** em loop (juntos, com troca suave) e **efeitos** de uma vez, e todo mundo ouve no próprio navegador, no mesmo ponto. (E25)
- **Sons gerados pelo app**, sem arquivo nenhum: chuva, tempestade, vento, fogueira, caverna, mar, riacho, noite (grilos), masmorra e batimento cardíaco; efeitos de trovão, explosão, golpe de espada, sino, gongo, tambores, flecha, magia, raio elétrico e moedas. (E25)
- **Pasta de sons do mestre:** músicas e efeitos próprios (MP3, OGG, WAV, M4A, FLAC…) em *Documentos/Jamal's Tabletop/Sons*, adicionados pelo painel ou copiados direto para a pasta. Opção `--sounds-dir` / `SOUNDS_DIR` para o servidor e o Docker. (E25)
- **Volume de cada um:** alto-falante na barra do topo com volume geral e mudo, só no seu computador (o mestre controla o volume de cada som para a mesa). (E25)
- Efeito no mapa **Ácido**: poça borbulhando que corrói o chão; sugestões de transformação para gás tóxico e solo molhado. (E25)

## [2.3.0] - 2026-10-25

### Adicionado
- **Transformar efeitos (mudança de estado):** no painel *Efeitos no mapa*, a mesma área muda de tipo: graxa ou teia pegam fogo, água ou solo molhado ficam eletrificados, gelo derrete, fogo apagado vira vapor… As transformações comuns aparecem primeiro, mas qualquer uma vale. Qualquer jogador transforma um efeito que está vendo (é a magia dele) e passa a controlá-lo; o log registra. Com *Quando acabar, volta a ser…*, o estado novo dura o tempo dado e depois a área volta ao que era (ex.: água eletrificada por 1 round). (E24)
- Efeitos novos: **Solo molhado** (piso encharcado com poças e pingos), **Eletrificado** (raios estalando), **Vapor**, **Lama** (com bolhas), **Chão chamuscado** (fuligem e brasas fracas; bom para depois do fogo) e **Gás tóxico** (névoa verde). (E24)

### Alterado
- **Efeitos do mapa animados e mais realistas:** fogo com chamas, fagulhas e fumaça; água com ondas e reflexos; névoa e vapor em camadas que se movem; brilho de óleo na graxa, orvalho na teia, folhas ao vento, cintilação no gelo, escuridão girando. A borda agora se esfuma em vez de cortar seco, com uma linha bem fraca marcando o limite exato da área. (E24)
- Ordem dos próximos entregáveis: Som (E25) vem antes de Celular e tablet (E23).

## [2.2.0] - 2026-10-25

### Adicionado
- **Dados rolando no centro do mapa:** cada rolagem rola em 3D, para todos que podem vê-la, e para no resultado sorteado pelo servidor, com o total em destaque por cima (20 e 1 naturais marcados). Os dados saem **na cor do token de quem rolou** (o personagem do jogador, o combatente do *Rolar como*; o mestre, em bronze). Rolagem oculta do mestre só anima na tela dele. *Animar rolagens*, no painel *Dados*, desliga só no seu navegador. (E22)
- **Log de rolagens destacável:** o botão ao lado de *Animar rolagens* abre o log numa janela que dá para arrastar e redimensionar; minimizar devolve o log ao painel *Dados*. A posição fica lembrada no navegador. (E22)

## [2.1.0] - 2026-10-25

### Adicionado
- **Mobs e NPCs ocultos** (furtividade, sala escura): só o mestre vê o token (translúcido, contorno tracejado); os jogadores não recebem nada dele. Ficam fora da iniciativa até o mestre revelar (olho na lista ou *Revelar* no painel *Selecionado*); revelados com a iniciativa em andamento, rolam e entram na ordem sem mudar a vez. Dá para criar já oculto (*Já entra oculto*, *Adicionar ocultos* no template). (E21)
- **Animais:** marca *Animal* no template, mob, NPC ou personagem mostra uma pata no token e na lista. Animal hostil continua mob (quadrado) e neutro continua NPC (hexágono). (E21)

- **Conjurados** (familiar, esqueletos, animais conjurados…): *Conjurar* no painel *Selecionado* cria um ou vários do lado de quem conjurou, ao lado dele ou onde você clicar no mapa (com a distância em pés até o conjurador), menores e com uma varinha. **Duração opcional** em rounds, contada no turno de quem conjurou: ao zerar, o conjurado some. Quem controla o conjurador controla os conjurados (o jogador move o familiar do personagem dele). Têm iniciativa própria, saem junto quando o conjurador é removido (o *Desfazer* traz todos) e, se marcados *Depende de concentração*, somem quando ele perde a Concentração. (E21)

### Alterado
- **Iniciativa só de quem está em campo:** *Rolar mobs e NPCs* virou *Rolar mobs em campo* e rola só os mobs no mapa e visíveis. NPCs (aliados ou neutros) entram quando o mestre rolar a de cada um. *Iniciativa de novo* rola os mobs em campo e os NPCs que já lutavam. (E21)

## [2.0.1] - 2026-10-25

### Corrigido
- **macOS:** o app aparecia como `jamals-tabletop.app` em vez de **Jamal's Tabletop**, e o comando de liberar a primeira abertura (`xattr`) do README não achava o app. O disco do `.dmg` também passa a se chamar "Jamal's Tabletop". Instruções de primeira abertura atualizadas para o macOS recente (o "botão direito → Abrir" não libera mais).
- **Windows:** abrir o `.exe` de novo com o app já aberto (ou ainda abrindo) apagava arquivos da mesa em uso; a imagem do mapa, entre outras coisas, parava de funcionar até fechar tudo. Agora um dado aparece na tela enquanto o `.exe` prepara o app (sem ele, parecia que o clique não tinha funcionado) e abrir de novo avisa que o app já está aberto, sem estragar a mesa.

### Alterado
- O app guarda as preferências (largura das colunas, painéis recolhidos, último nome usado…) numa pasta chamada *Jamal's Tabletop* (antes *@rpg/desktop*): na primeira abertura da 2.0.1 elas voltam ao padrão.

## [2.0.0] - 2026-10-24

A Fase 3 inteira: **app do mestre com janela própria**, **visual novo** ("Grimório sombrio"), NPCs e condições, dados no combate com trava por turno, áreas e efeitos de magia no mapa e **salvar/carregar sessão**.

**Por que 2.0:** o executável de console foi substituído por um app com janela, com arquivos de nomes e formatos novos (`.exe` portátil, `.dmg`, `.AppImage`), e a interface mudou por completo. A atualização não perde nada: até aqui nenhuma sessão era salva. Quem usa Docker só troca a tag da imagem.

### Alterado
- **O executável virou um app com janela própria** (Electron): dois cliques abrem o Jamal's Tabletop já na mesa, sem console nem navegador. Windows `.exe` portátil, macOS `.dmg`, Linux `.AppImage`. O executável antigo (Node SEA) foi descontinuado; Docker continua igual. (E12)
- **Visual novo, "Grimório sombrio":** paleta de tinta, couro e bronze com verde-cobre e sangue; painéis como placas com cantoneiras de bronze; títulos em Cinzel e texto em Alegreya Sans; ícones desenhados (Tabler) no lugar dos emoji. A tela de entrada e a marca do topo continuam, agora em bronze. Guia em `docs/design/guia-visual.md`. (E20)
- Tokens ganharam um contorno escuro fino, para se destacarem sobre efeitos (fogo, graxa…) e mapas de qualquer cor; o anel de seleção/turno ficou um pouco mais afastado. (E19)
- Rolagens do mestre agora são **ocultas por padrão** (desmarque "Rolagem oculta" para mostrar). (E16)
- Colunas laterais com no mínimo 260 px (antes 220): abaixo disso a iniciativa só mostrava a inicial do nome. Barra de rolagem das colunas mais fina. (E15)
- Botão do mestre no painel Aliados passa a "+ Aliado" (NPCs neutros têm seção própria); no bestiário, "+ Adicionar" virou "+ Mobs", ao lado de "+ NPC". (E15)
- O app agora se chama **Jamal's Tabletop**; os executáveis passam a `jamals-tabletop-<versão>-<sistema>-<arch>`, com "Jorge Mombach" como fabricante nas propriedades do `.exe` no Windows. (E13)
- Cada jogador cria **um personagem só**; para mudar nome, vida máxima ou mod. DES, use **✎ Editar**, agora no topo do painel *Selecionado*. O mestre continua criando quantos aliados quiser. (E13)
- Abreviações (DES, ft, Qtd., níveis de slot…) mostram explicação ao passar o mouse. (E13)
- Confirmações (remover personagem, encerrar combate, excluir template…) agora abrem uma janela do próprio app em vez do aviso do navegador. (E14)

### Adicionado
- **QR code** no painel *Convidar jogadores*: o jogador aponta a câmera do celular e entra. (E12)
- **Fechar o app com alterações não salvas** pergunta antes: *Salvar e sair* (grava o arquivo da sessão, por padrão em *Documentos/Jamal's Tabletop*), *Sair sem salvar* ou *Cancelar*. (E12)
- **Salvar e carregar sessão** (painel *Sessão*, mestre): baixa um arquivo `.json` com mapa, personagens, bestiário, mobs/NPCs, combate, condições, efeitos e log; carregar mostra um resumo e pede confirmação. Jogadores reencontram os personagens entrando com o mesmo nome. Arquivo inválido ou de versão mais nova é recusado com mensagem clara. (E18)
- Lembrete de salvar: o painel *Sessão* mostra "Não salvo" quando algo mudou desde o último salvamento, e fechar a aba do mestre nesse estado pede confirmação. (E18)
- **Efeitos persistentes no mapa:** *📌 Fixar como efeito* na ferramenta Área, com texturas próprias (Fogo, Água e Névoa animados; Graxa, Teia, Plantas, Raízes, Gelo, Escuridão) ou uma cor; ficam abaixo dos tokens. Duração em rounds contada no turno de quem conjurou, aviso ao acabar, vínculo com a *Concentração* do conjurador e painel *Efeitos no mapa* para ligar, desligar e remover. (E19)
- **Áreas de magia no mapa** (ferramenta *✦ Área*): cone, esfera, cilindro, linha e cubo com tamanho em pés, visíveis para todos como a régua. (E17)
- **Girar a imagem do mapa** em passos de 90° e **mudar o tamanho dela** (10%–400%) sem mexer no grid nem nos tokens. (E17)
- **Dados no combate:** blocos de *Ataque* (d20 + bônus, vantagem/desvantagem) e *Dano*; 20 natural no ataque aparece como "Crítico!" e marca *Crítico* no dano, que dobra os dados. O log agrupa as rolagens por turno ("Round 2 · Goblin 2"). (E16)
- **Trava por turno:** em combate, o jogador só rola na própria vez. Fora dela, rola quando o mestre faz um **pedido de rolagem** (ex.: "Resistência DES", uma vez por jogador, para todos ou alguns) ou ao usar a **Reação** (1 por round, até o turno mudar). O servidor recusa o resto com o motivo. (E16)
- **Rolar como:** a rolagem do mestre sai com o nome do mob/NPC da vez ("Goblin 2"); dá para trocar para outro combatente ou "Mestre". (E16)
- **Iniciativa de novo** (mestre): zera as iniciativas, rola mobs e NPCs e pausa o combate no mesmo round até os jogadores rolarem; *Retomar* continua o round. (E16)
- **NPCs neutros** (mestre): seção própria, criados avulsos ou pelo bestiário (botão *+ NPC* no template); token em hexágono; entram na iniciativa (o *Rolar mobs e NPCs* rola para eles também); jogadores os veem no mapa e na iniciativa, mas não a vida. (E15)
- **Condições** em qualquer combatente (lista do 5e + texto livre), com duração opcional em rounds que desconta no início do turno de quem tem; ao acabar, aviso para todos e registro no log. Aparecem no *Selecionado*, na iniciativa e como selo no token. O jogador põe e tira as do próprio personagem. (E15)
- **Visual novo e padronizado** (biblioteca Mantine): botões, campos, avisos e confirmações com o mesmo estilo em todo o app; fontes embutidas (funcionam sem internet). (E14)
- **Painéis laterais com largura ajustável:** arraste a borda entre a coluna e o mapa (duplo clique volta ao padrão; a largura fica salva no navegador). O mapa nunca fica com menos de 480 px. (E14)
- **Tamanho mínimo da tela (1024 × 640 px):** em janelas menores a página ganha barra de rolagem em vez de espremer os painéis. (E14)
- **Tela de entrada com arte:** emblema de d20 e fundo temático. (E14)
- Botão **Sair** na barra do topo: sai da sessão ou troca de nome sem perder o personagem, e o navegador para de entrar sozinho. (E13)
- README: como o jogador troca para a rede do mestre no Tailscale e o que fazer quando a página fica carregando para sempre. (E13)

### Removido
- Executável de console (Node SEA) e a janela preta com os endereços: o app com janela substitui os dois; os endereços e o link de mestre ficam no painel *Convidar jogadores*. (E12)

### Corrigido
- Dois tokens podiam ficar na mesma casa; agora o servidor recusa ("Essa casa já está ocupada por …") e, ao soltar da lista numa casa ocupada, o token vai para a livre mais perto. (E17)
- Contorno de seleção/turno deslocado nos tokens de inimigo. (E13)
- Painéis laterais cortando botões e textos (ex.: linhas da iniciativa, "Iniciar combate"). (E13)
- Slider de deslocamento do grid que, no final, fazia o grid voltar ao início. (E13)
- Mobs de template com nome longo perdiam o número ("Goblin 1" e "Goblin 2" ficavam iguais): agora o nome é encurtado antes do número. (E13)

## [1.1.0] - 2026-10-23

Primeira versão distribuída: quem vai mestrar só baixa e abre.

### Adicionado
- **Executável** para Windows, Linux e macOS (Node SEA): dois cliques sobem a sessão e abrem o navegador do mestre; nada para instalar. Ícone e versão nas propriedades do arquivo no Windows. (E10)
- **Imagem Docker** no GitHub Container Registry, com healthcheck e usuário sem privilégios. (E9)
- **Link de mestre** (`/?gm=<chave>`): entrar como mestre de outro dispositivo ou no Docker. Chave fixa com `GM_KEY`. (E8)
- Opções por variável de ambiente ou argumento: `--port`, `--max-players`, `--no-open`, `--gm-key`, `--no-gm-loopback`, `--public-urls`, `--no-detect-addresses`, `--help`. (E8)
- Endpoint `/healthz` e versão do app visível na interface e no console. (E8)
- Releases automáticas: uma tag gera os executáveis, a imagem e as notas. (E11)

### Alterado
- Porta ocupada não derruba mais o servidor: ele usa a próxima livre e avisa. (E8)
- `npm start` roda o servidor empacotado (`dist/server.cjs`); requer `npm run build` antes. (E8)
- No Docker, os endereços de convite vêm de `PUBLIC_URLS` em vez dos IPs internos do container. (E9)

### Corrigido
- O link "abrir como mestre em outro dispositivo" (console e painel) usava `localhost`, que não abre em outro aparelho. (E9/E10)

## [1.0.0] - 2026-10-23

Primeira versão jogável (E1–E7), rodando pelo código-fonte com Node.

### Adicionado
- Sessão local com o mestre como host; jogadores entram pelo navegador (LAN ou VPN), até 6 por padrão, com reconexão.
- Combatentes: bestiário com templates, N mobs de uma vez, aliados dos jogadores; vida controlada à mão (mestre nos mobs, cada jogador no seu personagem); remoção de mob com desfazer.
- Dados d4–d100 com quantidade, modificador, expressão livre, vantagem/desvantagem e log compartilhado (rolagem oculta do mestre).
- Mapa com upload, grid calibrável (1 quadrado = 5 ft), tokens com avatar, movimento livre e régua compartilhada.
- Iniciativa (d20 + DES) com desempate, turnos e rounds, entrada no meio do combate.
- Slots de magia e lista de magias de referência, com "recuperar slots" e "restaurar tudo".
- Limpar o campo de batalha mantendo jogadores e personagens.

[Não lançado]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.10.0...HEAD
[2.10.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.8.1...v2.9.0
[2.8.1]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/JorgeMombach/RpgTabletop/releases/tag/v1.0.0
