# Changelog

Mudanças de cada versão do Jamal's Tabletop (antes chamado Simulador de Encontros). Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

A seção da versão vira o texto da GitHub Release. Antes de criar a tag `vX.Y.Z`, mova o que estiver em *Não lançado* para `## [X.Y.Z] - AAAA-MM-DD` e atualize `version` no `package.json`.

## [Não lançado]

### Adicionado
- **CA e atributos** em aliados, mobs, NPCs, conjurados e no bestiário. Vida, CA e bônus de iniciativa são obrigatórios; FOR, DES, CON, INT, SAB e CAR são opcionais, com o modificador calculado (10 = +0, 12 = +1, 20 = +5). Com DES preenchida, o bônus de iniciativa acompanha o modificador dela (dá para mudar à mão). Jogadores não veem a CA nem os atributos de inimigos e NPCs.
- **Tamanho das criaturas:** Miúdo, Pequeno, Médio, Grande (2×2), Enorme (3×3) e Imenso (4×4), no formulário e no bestiário. O token cobre as casas, ninguém entra no espaço de uma criatura grande e ela não pousa em cima de ninguém; o miúdo divide a casa (fica no canto dela). Ao posicionar um conjurado, a régua mede da borda de quem conjurou.
- **Vida temporária:** botão *Temp.* na vida (o valor substitui o anterior, não soma). O dano tira dela primeiro; aparece como "+5 temp." e num trecho claro da barra de vida. Jogadores não veem a dos inimigos.
- **Testes contra a morte:** personagem com 0 de vida ganha três marcas de sucesso e três de falha (quem joga marca) e o botão *Rolar teste contra a morte*. Voltar a ter vida zera as marcas.
- **Teste de atributo pela ficha:** clicar num atributo rola d20 + modificador no log ("Thorin (Ana) · Teste de SAB").
- **Idioma da interface:** português, inglês ou espanhol, escolhido no ícone de idioma (tela de entrada, barra do topo e menu do celular); começa no idioma do navegador e vale só para quem escolheu. A tradução está começando: por enquanto a tela de entrada, a barra do topo e o celular.

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

[Não lançado]: https://github.com/JorgeMombach/RpgTabletop/compare/v2.7.0...HEAD
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
