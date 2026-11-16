# Terreno pintado (criação de mapa, entrega 1)

Desenho combinado em 2026-11-16, em brainstorm com o dono do projeto. Entra no pacote da branch `feat/campanha`. É a primeira de três entregas de criação de mapa: **1. terreno pintado** (este documento), 2. objetos com mais qualidade, 3. mapa vivo (água correndo, árvores balançando). Cada uma tem o seu desenho.

Teste visual que decidiu o estilo: https://claude.ai/artifact/DkHmZSwjEXbUxyY6gJRn3U (versão "1 · Misto"). O código do teste é a referência mínima do traço e da mistura; ele e as texturas usadas são copiados para o projeto na primeira tarefa do plano (o teste em `docs/design/terreno-teste.html`, as texturas convertidas na pasta do cliente). Pacote de texturas: https://voxelcorelab.itch.io/watercolor-terrain-textures (CC0, licença conferida no próprio pacote).

## Por quê

O app já monta bastante do mapa (paredes, objetos, tochas, baús, efeitos, névoa) e importa imagem e Universal VTT. Falta o chão: hoje ele vem de uma imagem pronta ou é o couro da mesa. Com o terreno pintado o mestre monta o mapa inteiro dentro do app, como no Dungeondraft. O alvo é um produto que dá para vender: **o chão é o que o jogador mais olha, então tem que ser bonito de verdade**, não com cara de polígono.

## Objetivos

- Ferramenta **Terreno** no painel *Construir*: o mestre pinta o chão com **pincel livre** (qualquer forma, borda macia), sem depender do grid.
- Texturas **desenhadas**, não fotos: base de aquarela pintada (licença CC0) com a cor ajustada para a paleta do *Grimório sombrio* e **detalhe desenhado em canvas por cima** (folhas de grama, pedrinhas, lajes, reflexos). É a versão "1 · Misto" do teste.
- Mistura entre terrenos com borda irregular e levemente escurecida, como pintura à mão.
- Funciona sem imagem de fundo (mapa todo feito no app) e por cima de uma imagem (retocar um mapa importado).
- Vale no grid quadrado e no hex (é livre).
- Todos veem o mesmo terreno; vai no arquivo de sessão e em cada cena.

## Fora do escopo (nesta entrega)

- Animação (água correndo, folhas): entrega 3.
- Objetos novos ou redesenhados: entrega 2.
- Relevo, altura, sombras de penhasco, transições automáticas por tipo (tipo "auto-tile").
- O mestre subir as próprias texturas.
- Terreno que muda regra (terreno difícil, deslocamento): o app registra, não aplica regra (ADR-06).
- Jogadores pintando terreno.

## Para não fazer (falharia mesmo funcionando)

- Textura com cara de polígono, de desenho animado saturado ou de foto.
- Pincelar e a mesa engasgar: a mesa continua leve para todos enquanto o mestre pinta.
- Mandar o terreno inteiro em cada envio do estado (o estado vai a cada movimento de token).
- Abrir um mapa grande e a tela travar até desenhar tudo.

## Restrições

- Monorepo atual: `shared/` (contrato e contas puras), `server/` (Express + Socket.IO, estado em memória), `client/` (React + react-konva + Mantine), `desktop/` (Electron). Mapa em Konva.
- Peso do app não é problema (o executável tem ~106 MB; o limite da CI é 200 MB; vai virar instalador). Mesmo assim as texturas entram convertidas (WebP), não nos PNG de 1–2 MB.
- Licença: só texturas que permitem uso comercial (CC0; CC-BY com crédito na tela *Sobre*). Nada de "NC".
- Textos em pt-BR, en e es; Mantine e o tema do guia visual; ícones Tabler.
- Permissão validada no servidor: só o mestre pinta.
- Campo novo vai no arquivo de sessão (ida e volta, `save-guard`).

## Caminhos considerados

| Caminho | O que é | Prós | Contras |
|---|---|---|---|
| **A. Grade fina + desenho em canvas por pedaços** (escolhido) | Intensidade de cada textura numa grade de 4 pontos por casa (1 byte cada); canal próprio com versão; o cliente desenha o chão em pedaços prontos e refaz só o pedaço pincelado | Encaixa no Konva de hoje; entrega mais curta até ficar bonito; o formato guardado serve a B depois | Mistura pixel a pixel em JavaScript tem teto; animar exigiria refazer pedaços sem parar |
| B. Mesma grade + desenho em WebGL (shader) | A placa de vídeo mistura as texturas | Rápido em qualquer mapa; prepara a animação da entrega 3 | Tecnologia nova no projeto, mais trabalho agora, plano B sem WebGL |
| C. Guardar as pinceladas | Cada traço vira um registro | Pouco dado por traço | Arquivo cresce sem parar, borracha difícil, desenho fica mais lento quanto mais se pinta |

**Escolhido: A**, pelo dono. Se a entrega 3 pedir WebGL, troca só o desenho no cliente; o formato guardado, o servidor e o arquivo de sessão ficam.

## Como funciona

### Texturas
- Pacote de partida: *Hand-Painted Watercolor Terrain Textures*, de Jonas Voland / Voxel Core Lab (CC0, 16 PNGs de 1024 px: 4 grama, 4 terra, 4 pedra, 4 água). Crédito na tela *Sobre* (não é obrigatório, mas o app credita tudo).
- **8 terrenos iniciais**, cada um = imagem do pacote + ajuste de cor (filtro de saturação/brilho, como no teste) + detalhe desenhado do seu tipo: *Grama*, *Grama seca*, *Terra*, *Terra escura*, *Pedra* (lajes), *Pedra clara*, *Água*, *Água escura*. Qual imagem do pacote e qual ajuste cada um usa é escolha de quem constrói, conferida no navegador ao lado dos tokens e objetos.
- Ids estáveis (vão no arquivo): `grass`, `grassDry`, `dirt`, `dirtDark`, `stone`, `stoneLight`, `water`, `waterDark`. Nome mostrado vem da tradução.
- A imagem se repete a cada 8 casas (tamanho do ladrilho em casas, não em pixels: acompanha o zoom e o `cellPx`).
- Detalhe desenhado: o mesmo traço do teste (grama: folhinhas claras e escuras; terra: pedrinhas e rachaduras; pedra: lajes irregulares com junta escura e luz na borda de cima; água: reflexos curtos), sorteado com semente pela posição, para não emendar diferente em cada pedaço nem mudar entre recargas.

### Pintura (o dado)
- Por cena: `battle.terrain`, ausente = sem terreno (arquivos antigos abrem iguais).
- Grade fina de **4 pontos por casa** a partir do canto do grid (unidades de casa, como as paredes e objetos livres; não depende do tipo de grid). Para cada terreno, um byte (0–255) por ponto.
- **Acompanha o grid** (decisão do dono): recalibrar o grid (tamanho da casa, deslocamento) leva o terreno junto, como as paredes e os objetos. Quem pinta por cima de uma imagem calibra antes.
- Guardado em **pedaços de 8 × 8 casas** (32 × 32 pontos por terreno), só os pedaços com algo pintado; cada pedaço guarda só os terrenos presentes nele.
- Mistura (conta exata, decisão de quem escreveu este desenho): pintar o terreno X com quantidade Δ sobe X em Δ (até 255); se a soma de todos os terrenos no ponto passar de 255, os **outros** descem proporcionalmente ao que cada um tem até a soma voltar a 255 (X fica). A soma nunca passa de 255. Onde a soma não chega a 255, aparece o que está embaixo (a imagem do mapa ou o couro da mesa). A borracha desce todos os terrenos do ponto proporcionalmente, em Δ no total.
- Pincel: centro em unidades de casa, raio de 0,5 a 6 casas, força de 0,1 a 1, queda suave do centro para a borda. *Borracha* desce todos os terrenos. A conta do pincel é uma função pura em `shared/`, usada pelo servidor (que manda) e pelo cliente (prévia imediata enquanto arrasta).

### Rede e servidor
- Ação nova do mestre com uma passada inteira (lista de pontos do traço, terreno, raio, força; ou borracha), validada inteira antes de mexer; o servidor aplica e guarda.
- O terreno **não vai no `state:full`**. Como a imagem do mapa: o estado leva só uma versão por pedaço; um evento próprio manda os pedaços que mudaram a quem está na sessão, e quem entra (ou reconecta, ou carrega arquivo) recebe todos. O cliente com versão atrasada pede de novo.
- A névoa cobre o terreno como cobre a imagem do mapa: o jogador recebe o chão inteiro (como recebe a imagem inteira) e a névoa esconde por cima. Chão não entrega posição de inimigo.
- *Desfazer* no navegador do mestre, na pilha de `client/src/map/mapHistory.ts` (escopo próprio, entra no Ctrl+Z como as outras ferramentas): antes de mandar a passada, o cliente guarda os pedaços que ela vai tocar; desfazer manda uma ação do mestre que **repõe esses pedaços** como estavam (validada como a passada). Nada de pilha no servidor.
- *Limpar campo* apaga o terreno; trocar o grid **não** apaga (é livre); importar Universal VTT não mexe no terreno.
- Tamanho (decisão de quem escreveu este desenho): tem que funcionar bem até **120 × 120 casas** pintadas (225 pedaços); um mapa assim abre no computador do mestre e no celular do jogador sem travar a tela. Limite por cena em `LIMITS`: **400 pedaços** com algo pintado (área de 160 × 160 casas), e passada de no máximo **2000 pontos** de traço; passar disso é recusado com mensagem traduzida.

### Desenho no cliente
- Camada própria **acima da imagem do mapa e abaixo de tudo o resto** (grid, efeitos, desenhos, paredes, objetos, tokens, névoa).
- Cada pedaço vira uma imagem pronta (canvas) com a mistura feita uma vez: texturas + detalhe + borda irregular (ruído) + borda escurecida. Na tela, só se desenham as imagens prontas.
- Pincelar refaz só os pedaços tocados. Abrir um mapa desenha os pedaços aos poucos, sem travar.
- Resolução do pedaço pronto: a que fica bonita no zoom normal sem pesar; no celular, menor. Escolha de quem constrói, conferida no navegador.

### Interface
- Ferramenta **Terreno** (atalho **T**) no painel *Construir*: escolha do terreno com uma amostra de cada, *Borracha*, tamanho e força do pincel, *Desfazer*, *Apagar todo o terreno* (com confirmação). Contorno do pincel sob o mouse.
- Mantine, tema e ícones do projeto; textos nas três línguas.

## O que fica com quem constrói

- Qual imagem do pacote e qual ajuste de cor cada terreno usa; a resolução dos pedaços prontos; o quanto de detalhe desenhado (com o teste como referência mínima).
- O formato exato do evento e da ação na rede, e a codificação dos pedaços (bytes em base64 é o esperado).
- A conversão das texturas para WebP (ferramenta à escolha) e a pasta delas no cliente.

## Testes esperados

- Pincel (função pura): intensidade sobe no centro e cai na borda; o que entra empurra os outros; borracha desce tudo; nada passa de 0–255.
- Servidor: só o mestre pinta; passada inválida recusada inteira; pedaços certos marcados como mudados; jogador recebe os pedaços; quem entra depois recebe tudo; *Desfazer*; *Limpar campo*; arquivo de sessão ida e volta, arquivo antigo sem terreno, `save-guard`.
- Navegador: pintar os 8 terrenos ao lado de tokens e objetos, com e sem imagem de fundo, no quadrado e no hex, como mestre e como jogador; um mapa grande abrindo sem travar.
