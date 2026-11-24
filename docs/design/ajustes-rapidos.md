# Ajustes rápidos (bloco 1 da lista de 2026-11-24)

Combinado em 2026-11-24, com o dono do projeto, na branch `feat/objetos`. É o primeiro de seis blocos da lista de ajustes, melhorias e adições que entram antes de lançar a versão:
1. **ajustes rápidos**;
2. desempenho e estabilidade;
3. correções visuais (escadas, ponte de pedra, rios);
4. terrenos novos (neve, creme, borda);
5. mar;
6. tochas na parede e mais modelos de luz.

## Por quê

São coisas pequenas que o dono notou testando e que já estão decididas. Saem primeiro para limpar a lista antes do trabalho de desempenho.

## O que é

1. **Pincel do terreno:**
   - no modo retângulo, o círculo do pincel não aparece;
   - com o mouse fora do mapa (indo para o submenu lateral, por exemplo), o círculo some. Vale também para os círculos do Relevo e do Piso, que têm o mesmo problema.
2. **Água e água profunda sem retângulo:** com elas escolhidas, a opção pincel/retângulo some e o modo volta para pincel. Retângulo de água não faz sentido.
3. **Aba Construir:** ícone e texto dos botões centrados também na vertical. Hoje estão grudados no topo: 1 px em cima e 13 px embaixo.
4. **A água apaga as plantas:**
   - ao soltar uma passada de água ou água profunda, somem as plantas cujo pé ficou na água (água + água profunda ≥ metade no ponto do objeto);
   - plantas: árvore, pinheiro, palmeira, arbusto, toco, tronco, cogumelos, flores e capim alto;
   - pedras, pedregulhos e objetos construídos ficam;
   - um **Desfazer** traz de volta a água e as plantas juntas.
5. **Tochas menores:** tocha e suporte de ferro passam de 0,75 para 0,5 casa; o braseiro, de 1 para 0,7. A luz sai da chama no tamanho novo.
6. **Nada em cima de parede, exceto portas e janelas:**
   - o servidor recusa pôr ou mover uma tocha, um baú ou um objeto cujo pé encoste na linha de uma parede, com a mensagem "Aí tem uma parede.";
   - paredes com porta ou janela (abertas ou fechadas) não contam;
   - o pincel de espalhar (floresta e afins) só pula os objetos que cairiam numa parede;
   - **tokens continuam livres**, como hoje (decisão do dono: o app registra, não aplica regras de movimento).

### Não metas

- Mexer no que já está no mapa: objetos antigos em cima de parede ficam onde estão. Só pôr e mover são conferidos.
- A tocha grudar na parede: é o bloco 6. A regra daqui é a base dele.

## Caminhos considerados

Para a água apagar as plantas:
- **No cliente, ao soltar a passada** (escolhido): o cliente já guarda o terreno de antes e de depois para o Desfazer. Ele acha as plantas afogadas, pede para tirá-las e guarda tudo num passo só do Desfazer.
- **No servidor, dentro da pintura:** o Desfazer não saberia quais plantas voltar sem comparar estados. Descartado.

Para "encostar na parede":
- **Distância do centro à linha da parede menor que um raio por tipo** (escolhido): é simples, igual no servidor e no cliente, e funciona com as paredes livres e no hex (mesmas coordenadas da luz).
- **Pelo pé inteiro do objeto:** uma estante encostada na parede seria recusada. Descartado.

## Como fica *(chamadas minhas)*

- **Raio que não pode encostar** (casas, do centro à linha da parede):
  - tocha: 0,2;
  - baú: 0,3, a partir do centro da casa dele;
  - objeto: metade do pé (`PROP_DEFAULTS[kind].foot × tamanho × 0,5`). Uma estante (pé 0,6) encostada na parede, com o centro a meia casa dela, passa.
- **Arrastar para cima de parede:** a peça volta para onde estava e aparece a recusa, como as outras recusas de hoje.
- **Desfazer de objetos que já estavam em parede** (dados de antes da regra): se o Desfazer tentar recolocá-los, o servidor recusa. É raro e fica anotado.
