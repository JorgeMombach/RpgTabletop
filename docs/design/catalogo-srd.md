# Catálogo de monstros (SRD 5.1)

Decidido com o Jorge em 2026-11-04. Passo 12 da "Mesa completa" (2.13.0), em fases. Regras de 2014 (5e); o SRD 5.2 (2024) fica para depois, como outra coleção.

## 1. A ideia

O app já vem com um **catálogo** de monstros prontos, separado do bestiário do mestre. O bestiário continua sendo "os monstros desta campanha" (limpo); o catálogo é a biblioteca de onde se tira.

- **Adicionar ao bestiário** copia o monstro como modelo do mestre. É uma cópia independente: o mestre edita vida, CA, atributos, ataques, e os mobs criados a partir dela saem com as mudanças. O catálogo nunca muda; uma versão nova do app não mexe nas cópias.
- **Pôr no mapa** faz o mesmo e já cria o mob (para "3 goblins agora").
- Tudo traduzido em pt-BR, en e es, como o resto do app.

## 2. Onde fica

No painel **Bestiário**, em duas abas: **Meus modelos** (o de hoje) e **Catálogo**. Nada de painel novo na coluna.

Catálogo: busca por nome e filtros por **ND** (nível de desafio), tipo (morto-vivo, dragão, fera…) e tamanho. Clicar num monstro mostra o resumo (vida, CA, atributos, ataques, ND) e os dois botões.

## 3. Modelo copiado

- Leva a origem (`source: "srd:goblin"`) e uma etiqueta discreta **SRD** na lista.
- **Restaurar original** (no editar do modelo): volta aos valores do catálogo.
- Adicionar de novo um monstro que já está no bestiário: pergunta se abre o que existe ou cria "Goblin (2)".
- A origem serve também à comparação por id da Fase 4 (o mesmo monstro em campanhas diferentes).
- Sem imagem (o SRD não tem): token com iniciais e uma cor por tipo de criatura.

## 4. Coleções

O catálogo aceita mais de uma coleção. A primeira é o SRD 5.1, embutida. Depois (fora deste passo): o mestre importar a galeria dele (arquivo de monstros da Fase 4) para o catálogo em vez de direto no bestiário; o SRD 5.2 como outra coleção.

## 5. Fases

1. **Estrutura do catálogo**, com um punhado de monstros de teste: abas, busca, filtros, resumo, Adicionar e Pôr no mapa, origem e Restaurar original, crédito na tela *Sobre*.
2. **Dados essenciais do SRD 5.1**, traduzidos: nome, tipo, tamanho, ND, vida, CA, iniciativa (mod. DES), atributos e ataques (nome, bônus, dano). Jorge revisa uma amostra dos nomes antes do lote todo.
3. **Textos das habilidades** (traços, ações especiais, lendárias, resistências, sentidos) nas notas do mestre, traduzidos. Revisão de amostra antes do resto.

## 6. Regras e cuidados

- **Licença:** SRD 5.1 sob CC BY 4.0. Crédito na tela *Sobre*: "Contém material do System Reference Document 5.1, da Wizards of the Coast LLC, disponível sob a licença Creative Commons Attribution 4.0 International". Conferir a licença da fonte do JSON antes de usar (o conteúdo é livre; o arquivo de cada projeto pode ter regras próprias).
- **Nomes em português:** alinhar com o que as mesas conhecem quando for nome curto; o texto dos livros oficiais não é aberto e não se copia (só o SRD).
- **ADR-06:** ND, resistências e salvaguardas são informação (resumo e notas). O app não calcula nada.
- **Peso:** só texto, sem imagens (~0,5 a 1,5 MB nas três línguas). Carrega só quando o mestre abre a aba Catálogo.
- **Nada em disco (ADR-04):** o catálogo vem no app; o que o mestre copia vai para o bestiário e, com ele, para o arquivo de sessão.
