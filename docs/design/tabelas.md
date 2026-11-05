# Tabelas aleatórias (Passo 13)

Desenho aprovado em 2026-11-04, em brainstorm com o dono do projeto. Entra no pacote 2.13.0 (branch `feat/cenario`).

## Objetivo

O mestre monta tabelas (encontros, nomes, clima, loot) e rola com um clique; o resultado vai para o log, por padrão só para ele. Uma tabela de loot também rola direto para dentro de um baú (Fase 6, [baus.md](baus.md)).

Continua valendo o ADR-06: a tabela sorteia e mostra, não aplica nada no jogo (não cria mob, não muda clima).

## 1. A tabela

`game.tables`: lista da campanha (não por cena), no arquivo de sessão. **Só o mestre recebe** (filtro em `server/src/view.ts`, com teste).

| Campo | O quê |
|---|---|
| `name` | "Encontro na estrada" (até 40 letras, único na mesa sem diferenciar maiúsculas) |
| `kind` | `text` ou `loot` |
| `rows` | até 100 linhas; cada uma com `weight` (inteiro de 1 a 99, padrão 1) |
| `public` | a última escolha de visibilidade (padrão: falso = só o mestre) |

- **Peso por linha.** A tela mostra o dado equivalente e as faixas quando a soma dos pesos é um dado comum (4, 6, 8, 10, 12, 20, 100: "d8 · 1–3"); senão, a chance em porcentagem.
- **Linha de texto** (até 200 letras) aceita, dentro do texto:
  - **dados**: `2d4 goblins` vira "6 (2d4) goblins". Vale qualquer dado que o painel Dados aceite, escrito junto (`1d6+1`, `3d6kh2`).
  - **outra tabela**: `[Nomes de goblin]` sorteia nela e põe o resultado no lugar. No máximo 5 níveis; tabela que não existe, ou o que passar da profundidade (uma tabela que chama a si mesma), vira "[Nomes de goblin?]" no texto, sem quebrar.
- **Linha de loot** é um dos três tipos do baú (moedas, item, arma), com dado no lugar de número fixo: quantidade `1d4`, moedas `3d6` po. Arma tem bônus e dano como no baú.

## 2. Rolar

Painel **Tabelas** na aba *Mesa* do mestre, depois do Bestiário.

- Cada tabela na lista: nome, tipo e número de linhas, o botão **Rolar** (dado) e o botão de olho, que alterna *Só eu* / *Todos* (a tabela lembra a escolha).
- Rolar sorteia no servidor (`table:roll`) e escreve no log: rótulo "Tabela · Encontro na estrada", texto "d8: 5 → 6 (2d4) goblins e Snaga"; um botão no resultado rola de novo. Só o mestre = `hidden` (o mesmo das rolagens escondidas dele).
- Tabela de loot rolada no painel só escreve no log ("14 po; 2 Poção de cura"); nada vai para ficha.
- Editar: janela com nome, tipo e as linhas (peso + texto, ou peso + campos do loot), com a faixa de cada linha ao lado; adicionar, apagar e mover linhas.
- **Exemplos:** com o painel vazio, o botão **Adicionar exemplos** cria cinco tabelas no idioma do mestre: nome de taverna, nome de PNJ, encontro na estrada (chama "Nome de PNJ"), clima e loot de goblin. Dá para editar ou apagar.

## 3. Loot direto para o baú

Na janela de edição do baú, **Rolar tabela**: escolhe a tabela de loot e quantas vezes (1 a 10).

- O servidor sorteia e resolve os dados (pedido `table:rollLoot` `{ tableId, times }`, que responde com o loot, como o `catalog:details`): "14 po", "2 Poção de cura". A janela acrescenta o resultado à lista que está editando: moedas somam na linha de moedas (cria uma, se não houver); item igual (mesmo nome, nota e números) soma a quantidade.
- Nada muda no baú até o mestre **Salvar** (o `chest:update` de sempre, com o limite de 20 entradas). Se o resultado passar do limite, a janela avisa e acrescenta só o que cabe.
- O log registra, só para o mestre, o que caiu.

## 4. Código

- Tipos em `shared/src/types.ts` (`RollTable`, `TableRow`) e limites em `LIMITS` (`tables: 50`, `tableRows: 100`, `tableName: 40`, `tableText: 200`, `tableTimes: 10`, `tableDepth: 5`).
- Ações (`ActionPayloads`): `table:upsert`, `table:remove`, `table:roll` `{ id, public }`; handlers em `server/src/actions/tables.ts`. Pedido `table:rollLoot` `{ tableId, times }` → `{ ok, loot }` (socket, como `catalog:details`), só para o mestre.
- Sorteio e resolução do texto num módulo puro (`server/src/tables.ts`), com o `rng` injetável para os testes.
- Arquivo de sessão: `tables` (ida e volta, `save-guard` com `Required<…>`).
- Exemplos em `client/src/tableExamples.ts`, nos três idiomas (o texto é do mestre, não do catálogo).
- Textos do servidor em `serverText.ts`.

## 5. Testes (servidor)

- Permissões: jogador não cria, edita, apaga nem rola tabela, nem rola loot no baú; não recebe `tables`.
- Validação: nome vazio ou repetido, peso fora de 1–99, tabela sem linhas, linhas demais, texto longo, loot com dado inválido.
- Sorteio com `rng` fixo: peso respeitado; faixa certa; dados dentro do texto; tabela chamada; laço e tabela inexistente não quebram; profundidade máxima.
- Visibilidade: `public` falso → `hidden` (jogador não recebe a entrada); verdadeiro → todos.
- `table:rollLoot`: jogador recusado; tabela de texto recusada; dados resolvidos; moedas somadas numa linha; item igual soma; `times` fora de 1–10 recusado.
- Arquivo de sessão: ida e volta das tabelas.
