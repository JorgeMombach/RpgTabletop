# Diário da campanha (Passo 14)

Desenho aprovado em 2026-11-11, em brainstorm com o dono do projeto. Entra no próximo pacote (branch `feat/campanha`).

## Objetivo

Um **caderno do mestre** para a campanha: resumo das sessões, missões, NPCs, lugares. É sobretudo dele; de vez em quando ele libera uma entrada para os jogadores lerem ("o que aconteceu na sessão 3", "quais missões temos").

Continua valendo o ADR-06: o diário registra, não aplica nada no jogo (missão concluída não dá recompensa, NPC anotado não cria combatente).

## 1. A entrada

`game.journal`: lista da campanha (não por cena), no arquivo de sessão. Entradas livres, cada uma com uma etiqueta.

| Campo | O quê |
|---|---|
| `id` | gerado pelo servidor |
| `title` | "Sessão 4 — A queda da ponte" (obrigatório, até 80 letras) |
| `tag` | `session`, `quest`, `npc`, `place` ou `other` |
| `text` | o texto (até 4000 letras): é o que o jogador lê quando liberada |
| `note` | nota só do mestre (até 2000 letras): **nunca vai para o jogador** |
| `shared` | liberada para os jogadores (padrão: não) |
| `done` | só em missão (`quest`): concluída |
| `day` | dia do jogo (inteiro ≥ 1, opcional); a janela preenche com o dia da *Hora do jogo* se ela estiver ligada |
| `updatedAt` | hora da última mudança (ordena a lista e marca novidade) |

- Até 200 entradas. Texto puro com quebras de linha (sem markdown).
- *Limpar campo* não mexe no diário (é da campanha, como o bestiário e as tabelas).

## 2. Telas

### Mestre
- **Painel *Diário*** na aba *Mesa*, depois de *Tabelas*: lista compacta (ícone da etiqueta, título com `Text truncate`, olho para liberar/recolher direto na lista), **+** e busca em cima. Vazio: `EmptyState` com ícone de livro.
- **Janela do diário** (modal grande): lista à esquerda (busca e filtro por etiqueta) e a entrada aberta à direita: título, etiqueta, dia, texto, nota secreta (fundo diferente e o aviso "só você vê"), *Liberar para os jogadores*, *Concluída* (só em missão) e *Apagar* (`confirmAction`). Grava ao clicar em *Salvar* (como o baú e as tabelas).
- Abre pelo painel (clicar numa entrada ou no **+**) e pelo botão de livro no topo.

### Jogador
- **Botão de livro no topo** (e no menu do celular), que só aparece quando há alguma entrada liberada. Abre a mesma janela **só para leitura**: lista com busca e filtro, e o texto da entrada. Missão concluída aparece riscada ou com selo.
- **Novidade:** quando o mestre libera ou altera uma entrada liberada, o botão ganha uma bolinha e sai um `toast` "Novo no diário: *título*". O "já li" fica no navegador de cada um (`localStorage`, pelo `updatedAt`). Nada vai para o log.
- **Celular:** a janela ocupa a tela; lista e entrada viram duas telas (lista → toque → entrada → voltar). Cabe em 375 px.

### Visual
Protótipo da janela (mestre e jogador, computador e celular) aprovado em 2026-11-11, antes do código: lista agrupada por etiqueta (Sessões, Missões, NPCs, Lugares, Outras), olho verde nas liberadas, nota secreta numa caixa tracejada com cadeado, *Descartar* ao lado de *Salvar*, selo verde *Concluída* na leitura e bolinha de bronze no que é novo.

## 3. Servidor

### Por que um canal próprio
O estado vai inteiro a cada ação (ADR-05). Um diário de campanha cresce sem parar (200 entradas longas passam de 500 KB) e iria junto com cada movimento de token. Por isso o diário **não vai** no `state:full`: segue o padrão do `handout` e do `map:image`, com versão e evento próprios. (Alternativas descartadas: dentro do estado, como `game.tables`, pesa em todo envio; sob pedido, como `catalog:details`, precisa de uma marca no estado para avisar novidade, e vira o mesmo canal com mais passos.)

### Ações (`ActionPayloads`, handlers em `server/src/actions/journal.ts`, só o mestre)
- `journal:upsert` `{ id?, title, tag, text, note, shared, done, day }`: cria ou edita. Valida tudo antes de mexer (título obrigatório, etiqueta da lista, tamanhos, `day` inteiro ≥ 1 ou vazio, `done` só em missão, até 200 entradas). Recusas com `fail()` em português, traduzidas em `client/src/i18n/serverText.ts`.
- `journal:share` `{ id, shared }`: o olho da lista.
- `journal:remove` `{ id }`.
- Toda mudança: `updatedAt = agora` na entrada e `store.journalVersion++`. Conta como alteração não salva, como as outras ações.

### Envio
- `server/src/app.ts`: quando `journalVersion` muda, cada socket da sessão recebe `journal` com `journalFor(player)`; ao entrar e reconectar, também.
- `journalFor` (junto do `view.ts`, que é o filtro por papel): o mestre recebe tudo; o jogador só as entradas com `shared`, **montadas de novo sem `note`** (não basta esconder o campo).

### Arquivo de sessão
- `journal` de ida e volta em `server/src/session-file.ts`; arquivo antigo abre com o diário vazio; formato continua 2.
- Carregar arquivo sobe `journalVersion` (reenvia a todos).
- `server/test/save-guard.test.ts`: exemplo `Required<JournalEntry>`.

### Código
- Tipos em `shared/src/types.ts` (`JournalEntry`, `JournalTag`, `JOURNAL_TAGS`); limites em `LIMITS` (`journal: 200`, `journalTitle: 80`, `journalText: 4000`, `journalNote: 2000`); evento `journal` nos eventos do servidor → cliente.
- Cliente: o diário recebido fica no store (`useApp`), fora do `ClientState`; painel `JournalPanel` e janela `JournalWindow` em `client/src/components/`; textos novos em `pt-BR.ts`, `en.ts` e `es.ts`.

## 4. Testes (servidor, `server/test/journal.test.ts`)
- Permissões: jogador não cria, edita, libera nem apaga.
- Validação: título vazio, etiqueta inválida, textos longos, `day` inválido, `done` fora de missão, entrada 201 recusada; nada muda depois de uma recusa.
- Filtro: o jogador recebe só as liberadas e **nenhuma `note`**; recolher faz a entrada sumir no próximo envio; liberar de novo continua sem `note`.
- Envio: entrar e reconectar recebe o diário; o diário não aparece no `state:full`.
- Arquivo de sessão: ida e volta do diário; arquivo sem `journal` abre vazio.
- `server-text.test.ts` passando com as recusas novas.

## 5. Documentação
CHANGELOG (*Adicionado*), README (aba *Mesa* do mestre e botão do diário do jogador), SPEC (canal próprio do diário na seção da próxima versão) e `[x]` no backlog.
