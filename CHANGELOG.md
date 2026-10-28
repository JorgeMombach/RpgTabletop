# Changelog

Mudanças de cada versão do Jamal's Tabletop (antes chamado Simulador de Encontros). Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

A seção da versão vira o texto da GitHub Release. Antes de criar a tag `vX.Y.Z`, mova o que estiver em *Não lançado* para `## [X.Y.Z] - AAAA-MM-DD` e atualize `version` no `package.json`.

## [Não lançado]

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

[Não lançado]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.8.1...HEAD
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
