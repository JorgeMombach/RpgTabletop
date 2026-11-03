# Baús com loot (Fase 6)

Desenho aprovado em 2026-11-03, em brainstorm com o dono do projeto. Entra no pacote depois da 2.11.0 (branch `fix/correcoes-rolagem-efeitos`). O pincel de efeitos, também da Fase 6, tem desenho próprio e fica de fora daqui.

## Objetivo

O mestre esconde baús pelo mapa com loot dentro. Os jogadores abrem, escolhem com calma o que querem e, quando mais de um quer a mesma coisa, o próprio sistema rola d20 para decidir (como o "rolar para levar" de MMOs). O que cada um leva vai direto para a ficha: moedas, itens e armas, que podem ser empunhadas e passam a aparecer nos ataques.

Continua valendo o ADR-06: o app registra, não aplica regra. Armadura não muda a CA sozinha; o d20 aqui é sorteio de loot, não regra de jogo.

## 1. O baú no mapa

Objeto novo da cena, como as tochas fixas: `battle.chests`, uma lista por cena, que vai no arquivo de sessão.

- Ocupa **uma casa** e tem **nome** ("Baú do capitão"). Desenho por protótipo aprovado antes (fechado, aberto e vazio; cadeado pequeno quando trancado).
- **Névoa:** baú coberto não vai para os jogadores (como tochas e efeitos).
- **Invisível:** só o mestre vê (desenhado meio transparente e tracejado, como a porta secreta). O mestre revela quando quiser.
- **Trancado:** o jogador que clica recebe "Está trancado."; só o mestre destranca.
- **Abrir:** clicar num baú visível e destrancado abre para todos (seção 3). A contagem só acontece na primeira abertura; depois, quem reabre vê o que sobrou e pega direto.
- **Vazio:** continua no mapa, aberto. O mestre pode pôr mais loot ou apagar o baú.
- **Segredo:** antes da primeira abertura, o jogador não recebe a lista do loot (filtro em `server/src/view.ts`, com teste).
- **Quem recebe:** o personagem principal do jogador (nunca um invocado). Toda entrega vai para o log: "Lia levou Machado de batalha do Baú do capitão (d20: 17 contra 9)."

Ferramenta nova do mestre na barra do mapa (como *Tochas*): clicar no mapa põe um baú; clicar num baú abre a edição; arrastar muda de casa; borracha e Ctrl+Z como nas tochas (`mapHistory`).

## 2. Loot e ficha

### O que o mestre põe no baú

Janela de edição do baú: nome, trancado, invisível e a lista de loot, em três tipos:

| Tipo | Campos | Vai para |
|---|---|---|
| Moedas | as cinco da ficha (pl, po, pe, pp, pc) | moedas do personagem (soma) |
| Item | nome, quantidade, nota | aba Itens |
| Arma | nome, quantidade, bônus de ataque, dano, nota | aba Itens, como arma |

Armaduras e capas são **Item**, com a nota dizendo o efeito ("CA 16").

### Item que vira arma (pré-requisito, útil sozinho)

- `InventoryItem` ganha `bonus?`, `damage?` (o par de um ataque) e `wielded?`.
- Item com bônus ou dano é uma arma: na aba Itens mostra "+5 · 1d8+3" e o botão **Empunhar** / **Guardar**. O jogador também pode transformar um item seu em arma preenchendo os campos.
- **Empunhada**, aparece na aba **Ataques** e nos ataques rápidos do painel **Dados** (acerto, dano, crítico, nome no log), junto dos ataques salvos. Guardada, some de lá e continua no inventário. Apagar o item tira dos ataques.
- Ataques salvos à mão e os vindos do template do bestiário continuam como estão.
- Ao levar algo igual (mesmo nome, nota e números) a um item que já existe, só soma a quantidade.

## 3. A abertura

O servidor é a autoridade: hora de fim da contagem, interesses, d20 e entregas.

1. **Abrir:** a janela de loot abre na tela de todos os conectados (nome, loot, barra de contagem). Quem fecha reabre clicando no baú.
2. **Contagem** (segundos configuráveis): cada item tem **Quero** (liga e desliga); todos veem quem quer o quê. Ninguém leva nada. O mestre pode **Encerrar contagem** antes.
3. **Fim da contagem**, item por item:
   - um interessado: leva tudo;
   - vários: cada um rola um d20 (servidor; empate rola de novo entre os empatados).
     - Item ou arma em pilha: unidades distribuídas uma a uma, em rodízio pela ordem do d20 (3 poções, d20 Lia 17, Kael 9: Lia 2, Kael 1).
     - Moedas: divididas igual entre os interessados; a sobra da divisão vai para o maior d20.
   - A janela mostra o resultado por alguns segundos ("Machado: Lia 17 · Kael 9 → Lia"); cada entrega vai para o log.
4. **Depois:** o que ninguém quis fica com **Pegar** (quem clicar primeiro leva; em pilha, escolhe quantas unidades).
5. **Mestre, a qualquer momento** (inclusive durante a contagem): **Dar para…** (personagem e quantidade). O que ele dá sai da disputa.

### Configuração

*Configurações → Mesa*: "Tempo para escolher o loot", em segundos (padrão 20; 0 = sem contagem, Pegar direto). Vai no arquivo de sessão.

### Casos de borda

- Jogador desconectado não marca interesse, então não entra na disputa.
- Salvar no meio da contagem: o arquivo leva o baú e o loot, não a disputa; ao carregar, o baú está aberto, no modo Pegar.
- Trocar de cena no meio da contagem: a disputa é cancelada do mesmo jeito.
- Loot que mudou (o mestre deu um item) durante a contagem: os interesses naquele item somem.

## 4. Entrega

Ordem dentro da Fase 6:

1. Item que vira arma e se empunha (seção 2).
2. Protótipo: desenho do baú (2 a 3 opções, nos estados) e a janela de loot (contagem, Quero, d20, Pegar, Dar para…), também em 375 px.
3. Baú no mapa: ferramenta, trancado, invisível, edição do loot, névoa, arquivo de sessão.
4. Abertura: contagem, Quero, d20, Pegar, Dar para…, configuração do tempo.
5. Pincel de efeitos (desenho à parte).

### Testes (servidor)

- Permissões: jogador não cria, edita, destranca nem revela baú; não abre trancado; não recebe o invisível nem o coberto pela névoa; não recebe o loot antes da primeira abertura.
- Contagem: Pegar recusado durante a contagem; Quero só durante; Encerrar contagem só o mestre.
- Disputa: um interessado; vários com d20; empate; rodízio das pilhas; divisão das moedas com sobra.
- Dar para… durante a contagem tira o item da disputa.
- Entregas: moedas somam; item igual soma quantidade; arma chega como item com bônus e dano.
- Arma empunhada aparece nos ataques do personagem; guardada ou apagada, não.
- Arquivo de sessão: ida e volta de baús, loot e itens-arma (`save-guard` com `Required<…>`); arquivo salvo no meio da contagem volta no modo Pegar.
