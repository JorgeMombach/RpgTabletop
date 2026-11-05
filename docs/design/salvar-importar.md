# Salvar e importar fichas (Fase 4)

Decidido com o Jorge em 2026-11-03 (escopo) e 2026-11-04 (adendo das versões diferentes). Faz parte do pacote 2.13.0 (`feat/cenario`).

## 1. O que é

Baixar em JSON a **ficha** de um personagem, de uma invocação/pet ou de um monstro, e importar esse arquivo em outra sessão ou campanha. É diferente do arquivo de sessão (que guarda a mesa inteira, com o combate em andamento).

- **Jogador:** baixa e importa os próprios personagens, invocações e pets.
- **Mestre:** baixa qualquer um (um por vez ou todos), e baixa/importa monstros. Monstro importado vai para o **bestiário** (vira modelo), nunca direto para o mapa.
- O importado fica com quem importou: o personagem é do jogador que importou; monstros são do mestre.
- Importar passa pela mesma validação do arquivo de sessão (`session-file.ts`): arquivo inválido ou adulterado é recusado inteiro, com aviso.

## 2. Ficha, não estado de batalha

O arquivo leva a ficha "limpa", como o personagem está fora de combate. Estado de batalha fica só no arquivo de sessão.

| Vai no arquivo (ficha) | Fica de fora (estado de batalha) |
|---|---|
| nome, cor, avatar, tamanho, descrição | vida atual, vida temporária, testes contra a morte |
| vida máxima, CA, bônus de iniciativa, atributos | posição no mapa, iniciativa, ações gastas na vez |
| alcance/aura e a cor dela, animal, visão no escuro | condições, tocha acesa, oculto |
| espaços de magia (o máximo), magias | espaços de magia e recursos **gastos** |
| recursos (o máximo), ataques, inventário, moedas | conjurador, duração e concentração da invocação |
| monstros: notas do mestre, chefe e fases | fase atual do chefe, dono, modelo de origem |

- Notas do mestre de um personagem só vão no arquivo que o **mestre** baixa (o jogador nem recebe esse campo). Quando o jogador substitui a ficha, as notas do mestre que já estavam ficam.
- Mob ou NPC baixado do mapa sai como modelo do bestiário, com o id do modelo de origem quando tiver (assim ele bate com o bestiário de quem importar).
- Personagem importado como novo entra com a vida cheia, sem condições e fora do mapa.

## 3. Formato do arquivo

```json
{ "app": "jamals-tabletop", "kind": "characters" | "monsters", "version": 1, "savedAt": "2026-11-04T…", "items": [ … ] }
```

Um arquivo pode ter vários itens (o mestre baixando todos os personagens, ou uma galeria de monstros). Cada item leva o **id** que tem na mesa (UUID, o mesmo que já passa pelo arquivo de sessão).

## 4. Versões diferentes (adendo de 2026-11-04)

O mesmo personagem pode estar em dois lugares com versões diferentes: o mestre salvou a sessão e não salvou de novo, e o jogador baixou a ficha depois, com mais coisas. Ou o mestre tem uma galeria de monstros no PC e importa numa campanha em que o mesmo monstro já existe, um pouco diferente. A comparação é pelo **id**:

- **Id não existe na mesa:** entra como novo, com o id do arquivo (assim continua comparável nas próximas vezes).
- **Id existe e a ficha é igual:** avisa "já está igual" e não muda nada.
- **Id existe e a ficha é diferente:** abre a janela de diferenças.
- **Id é de um personagem de outro jogador:** conta como "não existe" e entra como cópia, com id novo. Ninguém sobrescreve o personagem de outro (validado no servidor).

**Janela de diferenças.** Mostra o que mudou, campo a campo, com o valor da mesa e o do arquivo ("Vida máx.: mesa 42 · arquivo 38"; listas resumidas: "Inventário: +2 (Corda, Poção de cura) · −1 (Adaga)"). Não compara datas: data de arquivo engana, e o jogador vê pelos números qual versão está adiantada. Só a ficha entra na comparação (seção 2). Opções:

- **Substituir a da mesa:** por conta e risco de quem importa. Troca só a ficha; o estado de batalha continua (posição, condições, vida atual, que é limitada à vida máxima nova; espaços e recursos gastos, limitados ao máximo novo). Se a ficha nova for maior e o token passaria a encostar em outro, só ele vai para a casa livre mais próxima (ninguém é empurrado).
- **Importar como cópia:** id novo e o nome com "(2)".
- **Cancelar.**

**Vários conflitos de uma vez** (galeria de monstros, mestre importando todos): o que é novo entra direto; os conflitos aparecem numa janela só, em lista, cada um com Substituir, Cópia ou Pular, e um "aplicar a todos".

**Rede de segurança.** Quando um jogador substitui a ficha de um personagem, o log ganha uma linha ("{who} substituiu {name} pela ficha do arquivo") e o mestre recebe um aviso com **Desfazer**. O servidor guarda em memória só a ficha anterior de cada personagem substituído (nada em disco, ADR-04).

**Bestiário.** Substituir um modelo não mexe nos mobs que já estão no mapa; vale para os próximos, como qualquer edição do bestiário.

## 5. Fora daqui

- Mesclar campo a campo (escolher parte de uma versão e parte da outra): a janela só substitui ou duplica.
- Guardar data de alteração em cada personagem para dizer "qual é mais nova".
- Importar estado de batalha pelo arquivo de ficha.
