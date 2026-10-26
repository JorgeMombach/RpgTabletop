# Backlog — melhorias da mesa

Branch contínua `feat/melhorias-da-mesa` (a partir da 2.7.0): melhorias, adições e correções que entram aos poucos, sem PR nem versão até haver um escopo bom para subir. Cada item pronto ganha `[x]` aqui e uma linha em `## [Não lançado]` no CHANGELOG; decisões que mudam a SPEC vão para lá no mesmo commit.

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
- [ ] **Grupos de mobs na iniciativa:** "Goblin 1–6" numa linha só.
- [x] **Chefes:** ações lendárias, resistências lendárias e habilidades de Recarga (d6 no começo do turno), só para o mestre.
- [ ] **Alcance / aura visível:** círculo leve em volta do token (ex.: 10 ft, aura de 30 ft).

## D. Mapa
- [ ] **Colocar no mapa pelo celular:** *Colocar no mapa* na Ficha troca para a aba Mapa e espera o toque onde entra (modo de posicionar dos conjurados, com régua). Serve para personagem e invocações.
- [ ] **Ping:** segurar o clique/dedo num ponto faz um círculo pulsar para todos, com o nome de quem marcou.
- [ ] **Desenho livre** do mestre (setas, círculos, marcações).
- [ ] **Portas e paredes simples** (linhas que bloqueiam visualmente; prepara a névoa de guerra).
- [ ] **Vários mapas na sessão:** o mestre prepara e troca com um clique, cada mapa com os seus tokens.

## E. Mestre
- [ ] **Mostrar para a mesa:** imagem ou texto (carta, retrato, mapa do tesouro) que abre na tela de todos.
- [ ] **Encontros prontos:** salvar mobs, posições, clima e som de um encontro e carregar inteiro.
- [ ] **Notas privadas do mestre** por mob/NPC.
- [ ] **Rolagem secreta por um jogador:** o mestre rola (ex.: Percepção) com o modificador do personagem sem o jogador ver.

## F. Produto
- [ ] **Sobre / Créditos:** versão, licenças de terceiros (biblioteca e sons dos dados, MIT; fontes, OFL; ícones Tabler, MIT…) e crédito do SRD 5.1 (CC-BY 4.0) se usarmos texto dele. Nada de "D&D" e outras marcas da Wizards no app.
- [ ] **i18n completo: inglês e espanhol.** Migrar os textos do client para o catálogo; mensagens de erro do servidor viram códigos traduzidos no client; escolha do idioma (padrão: o do navegador).

## Depois (entregáveis próprios)
- Névoa de guerra (o mestre revela o mapa aos poucos).
- Hospedagem ou túnel para jogar sem VPN.
- Assinatura do executável (Windows e Mac).

## Ideias novas
(entram aqui conforme surgirem e sobem para a seção certa quando decididas)
