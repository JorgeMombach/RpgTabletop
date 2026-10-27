# Backlog — melhorias da mesa

Branch contínua (a 2.8.0 saiu de `feat/melhorias-da-mesa` com os blocos A–D; agora `feat/melhorias-da-mesa-2`, a partir da 2.8.1): melhorias, adições e correções que entram aos poucos, sem PR nem versão até haver um escopo bom para subir. Cada item pronto ganha `[x]` aqui e uma linha em `## [Não lançado]` no CHANGELOG; decisões que mudam a SPEC vão para lá no mesmo commit.

Regras que valem para tudo: o app registra, não aplica regras (ADR-06); permissões no servidor; dado novo sensível passa pelo filtro de `view.ts` com teste; tudo novo entra no arquivo de sessão (e no teste de proteção do save); textos novos já nascem traduzíveis (depois da base de i18n).

Ordem sugerida: a base primeiro (protege o resto), depois por assunto. Dá para trocar a ordem a qualquer momento.

## A. Base
- [x] **Teste de proteção do save:** preenche todos os campos de combatente, template, efeito, clima etc., salva, carrega e compara. Campo novo esquecido no arquivo de sessão faz o teste falhar. (`server/test/save-guard.test.ts`; já achou um bug: dono do estado de antes de Transformar não era religado ao carregar.)
- [x] **Base de i18n:** `client/src/i18n/` (catálogo pt-BR como fonte, en e es por cima, `t()`/`useT()`, idioma do navegador por padrão, menu de idioma na entrada, no topo e no menu do celular). Já traduzidos: tela de entrada, barra do topo, menu e abas do celular, botões das confirmações. O resto migra aos poucos (ver F).

## B. Ficha
- [x] **CA e atributos** em aliados, mobs, NPCs, conjurados e templates. Obrigatórios: vida, CA e bônus de iniciativa; opcionais: FOR, DES, CON, INT, SAB, CAR (modificador = ⌊(valor − 10) ÷ 2⌋, sem teto). Com DES preenchida, a iniciativa vem dela (sobrescrevível). CA e atributos de mob/NPC **escondidos dos jogadores** (filtro + teste). Arquivo antigo: CA vazia, mostrada "—".
- [x] **Testes de atributo pela ficha:** clicar em "SAB +3" rola d20 + 3 ("Thorin (Jorge) · Teste de SAB").
- [x] **Tamanho das criaturas:** Miúdo (divide a casa), Pequeno/Médio 1×1, Grande 2×2, Enorme 3×3, Imenso 4×4. Token cobre as casas; o servidor confere todas as casas ocupadas; régua conta da borda. Padrão Médio (arquivo antigo também).
- [x] **Vida temporária:** campo à parte; o dano consome primeiro.
- [x] **Testes contra a morte:** aliado a 0 de vida ganha 3 sucessos / 3 falhas e botão de rolar o d20 (só marca; a mesa decide).
- [x] **Recursos por descanso:** contadores livres ("Fúria 3/3", "Ki 5/5") com descanso curto/longo enchendo.
- [x] **Rolagens salvas:** "Espada longa: +5 / 1d8+3" guardado no personagem e rolado com um clique.
- [x] **Inventário e moedas** simples (PO, PP, PC), só registro.

## C. Combate
- [x] **Jogador passa a vez:** botão para quem está na vez (dono do personagem ou do conjurado); o servidor avança como o *Próximo turno*; log "Thorin (Jorge) passou a vez".
- [x] **Atrasar a vez:** "agir depois de…" e reentrar na ordem.
- [x] **Ações do turno:** Ação, Ação bônus, Movimento e Reação marcáveis, zerando na vez de cada um.
- [x] **Lembrete de Concentração:** quem concentra e toma dano recebe o aviso "Teste de Concentração: CD X" (metade do dano, mínimo 10). Só lembra.
- [x] **Grupos de mobs na iniciativa:** "Goblin 1–6" numa linha só.
- [x] **Chefes:** ações lendárias, resistências lendárias e habilidades de Recarga (d6 no começo do turno), só para o mestre.
- [x] **Alcance / aura visível:** círculo leve em volta do token (ex.: 10 ft, aura de 30 ft).

## D. Mapa
- [x] **Colocar no mapa pelo celular:** *Colocar no mapa* na Ficha troca para a aba Mapa e espera o toque onde entra (modo de posicionar dos conjurados, com régua). Serve para personagem e invocações.
- [x] **Ping:** segurar o clique/dedo num ponto faz um círculo pulsar para todos, com o nome de quem marcou.
- [x] **Desenho livre** do mestre (setas, círculos, marcações).
- [x] **Portas e paredes simples** (linhas que bloqueiam visualmente; prepara a névoa de guerra).
- [x] **Vários mapas na sessão:** o mestre prepara e troca com um clique, cada mapa com os seus tokens.

## E. Mestre
- [x] **Mostrar para a mesa:** imagem ou texto (carta, retrato, mapa do tesouro) que abre na tela de todos.
- ~~**Encontros prontos:**~~ coberto pelas cenas (bloco D): cada cena já guarda mapa, mobs, posições e clima. Não precisa de outra coisa.
- [x] **Notas privadas do mestre** por mob/NPC (e aliados).
- [x] **Descrição pública** de mob/NPC (e no template), que todos veem: "Avanthir, o Sábio — dragão ancião de neve…".
- [x] **Rolagem secreta por um jogador:** o mestre rola (ex.: Percepção) com o modificador do personagem sem o jogador ver.

## F. Produto
- [ ] **Sobre / Créditos:** versão, licenças de terceiros (biblioteca e sons dos dados, MIT; fontes, OFL; ícones Tabler, MIT…) e crédito do SRD 5.1 (CC-BY 4.0) se usarmos texto dele. Nada de "D&D" e outras marcas da Wizards no app.
- [ ] **i18n completo: inglês e espanhol.** Migrar os textos do client para o catálogo; mensagens de erro do servidor viram códigos traduzidos no client; escolha do idioma (padrão: o do navegador).

## G. Névoa de guerra
- [ ] **Névoa de guerra:** o mapa começa coberto para os jogadores e o mestre revela por áreas (retângulo, pincel, cômodo entre paredes) e cobre de novo. O mestre vê tudo, com a névoa translúcida. Tokens debaixo da névoa não vão para os jogadores (como os ocultos). Uma névoa por cena, no arquivo de sessão. Usa as paredes do bloco D para revelar "o cômodo".

## H. Ajustes do que já existe (vindos do jogo)
- [x] **Ping sem atrapalhar o arrasto:** hoje segurar para arrastar a visão ou um token também dispara ping. Arrastar cancela o ping; no computador o ping passa a ser Alt+clique (ou botão do meio), e segurar parado fica só para o toque.
- [x] **Numeração dos mobs pelos nomes em uso:** template e *Invocar* (antes *Conjurar*) numeram cada um por conta própria e repetem nomes ("Zumbi 1" duas vezes). O número novo continua do maior "Zumbi N" que já existe.
- [x] **Iniciativa rolada uma vez só:** o jogador rola a própria iniciativa uma vez por combate; rolar de novo ou mudar o valor fica com o mestre.
- [x] **Cor do alcance/aura** escolhível (hoje é a cor do token).
- [x] **"Conjurar" vira "Invocar"** em toda a interface (botões, avisos, log, README).
- [x] **Descanso curto/longo: quem faz:** cada jogador no próprio personagem (com confirmação, só fora de combate, no log) e o mestre *Descanso para todos*.

## I. Regras da mesa (opções que o mestre liga)
- [x] **Movimento por turno:** em combate, cada um só move o próprio token na sua vez; fora de combate, livre; o mestre sempre. Validado no servidor. Muda o "movimento livre" do ADR-06 para uma opção da mesa.
- [x] **Invocar só na sua vez** quando estiver em combate.
- [x] **Lembrete de escuridão:** com a luz do clima em *Noite* ou *Luar*, aviso para quem não tem visão no escuro (marca "Visão no escuro" na ficha). Só informa.

## J. Interface
- [x] **Painel do mestre em abas:** a coluna da esquerda está poluída; separar em abas (ex.: Combate, Mapa e cenas, Ambiente (clima e som), Mesa (bestiário, jogadores, sessão, convite)).
- [x] **Recolher as colunas por completo:** botão na borda (e arrastar até o fim) para esconder a coluna e dar o espaço ao mapa; bom no iPad.
- [x] **Log de dados em outra janela:** abrir o log numa janela própria para arrastar para outro monitor (no navegador e no app do mestre).

## K. Combate avançado
- [ ] **Chefe com fases:** várias barras de vida em sequência (fase 1, 2, 3…); zerou uma, começa a próxima com aviso no log (e, se quiser, nome e CA novos).
- [x] **Efeitos que andam com o token:** um efeito de área preso a um combatente (ex.: espírito protetor do clérigo) acompanha o token quando ele anda.

## Depois (pago ou entregável próprio)
- Hospedagem ou túnel para jogar sem VPN (tem custo de servidor).
- Assinatura do executável no Windows e no Mac (certificados pagos).

## Ideias novas
(entram aqui conforme surgirem e sobem para a seção certa quando decididas)
