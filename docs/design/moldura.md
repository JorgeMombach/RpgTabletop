# Moldura da cena e terrenos novos (bloco 4 da lista de 2026-11-24)

Combinado em 2026-11-24 e 25, com o dono do projeto, na branch `feat/objetos`. É o quarto de seis blocos antes de lançar a versão. Os anteriores foram os [ajustes rápidos](ajustes-rapidos.md), o [desempenho](desempenho.md) e as [estruturas](estruturas-ajustes.md). Teste aprovado em [moldura-teste.html](moldura-teste.html): os dois terrenos e as quatro molduras.

## Por quê

O dono quer três coisas:
- **Neve** como terreno.
- **Um terreno creme**, "da mesma cor da borda da água e do final da ponte".
- **Uma moldura:** "o mestre define o tamanho… uma borda bonitinha, como a moldura de um quadro, e a cena acontece dentro dela. Nada pode ser adicionado fora. É opcional. Fora dela fica a mesa normal". A moldura é a cena, e o resto é a mesa.

As primeiras molduras, em Canvas 2D, ficaram "com cara de Paint". Para combinar com o resto do mapa, elas são desenhadas pela placa de vídeo, por pixel.

## O que é

### Terrenos

**Terra batida** e **neve**, com o mesmo pincel e a mesma mistura de bordas dos outros terrenos:
- **Terra batida:** barro claro compactado, no tom da margem da água, com rachaduras finas e pedrinhas raras.
- **Neve:** branco-azulado, com montinhos macios (sombra azulada do lado oposto ao sol) e brilho fino de cristais.

O material de cada um é o da página aprovada.

### Moldura

- **Opcional, por cena.** No painel *Mapa*, o mestre liga a moldura e define:
  - **Largura e altura, em casas** (de 4 a 200). A área começa no canto do grid, na casa 0, 0.
  - **O desenho:** madeira entalhada, bronze dourado, ferro com rebites ou pedra.
  - Com imagem de mapa, um botão **Ajustar à imagem** faz a moldura abraçar a imagem.
- **Fora da moldura, a mesa** (couro, madeira ou ardósia, a que estiver escolhida). Ela cobre tudo o que estiver fora.
- **Nada é posto fora dela.** O servidor recusa com "Fora da moldura." e a peça volta ao lugar:
  - tokens (mover, juntar o grupo);
  - objetos, tochas e baús;
  - paredes (as duas pontas), pontes e escadas (todos os pontos), correntezas;
  - efeitos de área (a origem) e desenhos (todos os pontos).
- **Os pincéis param na borda:** terreno, relevo, piso e efeitos pintados não pintam fora dela.
- **Interface livre:** régua, pings e áreas de mira continuam funcionando em qualquer lugar.
- **Nada é apagado.** O que já estiver fora quando a moldura é ligada, ou quando diminui, fica escondido sob a mesa e volta se ela crescer.
- **Desenho** (o da página): perfil em relevo por pixel, com cantos em meia-esquadria e ornamento em cada canto. A luz vem de cima à esquerda, com brilho de metal no bronze e no ferro. A moldura faz sombra sobre a cena e sobre a mesa. A espessura é de 0,75 casa.

## Não metas

- **Moldura em formato livre:** só retângulo.
- **Tirar o mapa do canto do grid:** a área começa na casa 0, 0, e a imagem e o grid se ajustam como hoje.
- **Tirar os jogadores da tela:** a moldura limita o mapa, não a câmera.

## Caminhos considerados

- **Regra no servidor e pincéis cortando na borda** (escolhido pelo dono). É a regra do projeto: o proibido é validado no servidor.
- **Só no cliente.** Descartado: vai contra a validação no servidor.
- **Moldura em Canvas 2D.** Testada e recusada pelo dono ("cara de Paint").

Como desenhar a moldura no app *(chamada minha)*:
- **Um passo no renderizador do chão (escolhido).** Ele desenha numa imagem só a mesa fora da cena, a moldura e a sombra sobre a cena. A imagem é posta acima de tudo o que é do mapa e abaixo da luz da cena (a noite escurece a mesa e a moldura junto, como hoje). A textura da mesa é a mesma de hoje (`tableArt.ts`), enviada uma vez para a placa. Com a moldura desligada, nada disso é desenhado.
- **Imagem pronta, esticada no zoom.** Descartado: borra de perto, e o padrão do mapa é nitidez por pixel.
- **Sem WebGL 2:** a mesa por cima fica com recorte no Konva, e a moldura vira uma faixa simples. É só um recurso de emergência.

## Fica para o construtor

- A ordem exata das camadas do Konva, desde que a moldura fique acima da névoa, das copas e do clima, e abaixo da luz e da interface do mapa.
- No hex, a moldura usa as mesmas coordenadas de ponto (casas) da luz e das paredes.
