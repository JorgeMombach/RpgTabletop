# Renderizador do chão (WebGL) — roteiro e passo 1: terreno na placa de vídeo

Combinado em 2026-11-17, com o dono do projeto, na branch `feat/campanha`, depois da [água animada](agua.md) (a primeira coisa do mapa feita em WebGL). Antes de seguir para estruturas e construções.

## Por quê

A água foi para a placa de vídeo e ficou com qualidade de jogo. O dono não quer que cada coisa nova ganhe o seu WebGL sozinha e o que já existe fique defasado: primeiro modernizar o que é base, depois construir em cima. O alvo continua o mesmo: mapa bonito, vivo e customizável, no nível do Nimblehold e do 2-Minute Tabletop. No futuro, o mapa inteiro deve trocar de motor para WebGL (abordagem C da [água](agua.md)) para ter mais liberdade gráfica; este trabalho é o caminho até lá, um pedaço por vez.

## Roteiro (decidido)

1. **Terreno na placa de vídeo, unificado com a água** (este documento). Base do relevo.
2. **Luz**: dia e noite, tochas iluminando o chão com chama tremulando, sombra das paredes, relevo pegando luz de lado. Desenho próprio, depois deste.
3. **Estruturas e construções, relevo**: em cima do chão novo (desenhos próprios).
4. **Fica para a troca de motor (abordagem C)**: névoa de guerra (acabou de ficar pronta com o hex e ainda não foi testada), efeitos e clima (acabaram de ser refeitos), plantas e objetos (a edição depende do Konva; o vento já resolve o "vivo").

**Um renderizador do chão só**: um contexto WebGL, uma camada no mapa. A água já é a primeira parte dele; o terreno entra agora; a luz depois. Assim o navegador não estoura o limite de contextos, tudo usa a mesma altura e a mesma luz, e esse renderizador é a semente do motor novo.

## Passo 1: terreno na placa de vídeo

### Hoje

`client/src/map/terrain/`: cada pedaço (8 × 8 casas) vira uma imagem pronta, desenhada pixel a pixel no processador (`renderChunk.ts`): aquarela de cada terreno com ajuste de cor (`TERRAIN_ART`), detalhe desenhado em canvas (`drawDetail`: folhinhas, pedrinhas, rachaduras, lajes, reflexos), mistura em camadas com borda irregular por ruído e borda um pouco escurecida. Fila de alguns pedaços por quadro; ao mudar a resolução, tudo é refeito; o pincel mostra a prévia com metade dos pixels. A água tem a camada WebGL dela ([agua.md](agua.md)), com o terreno deixando a aquarela da água de fora.

### O que muda

- **O mesmo terreno, desenhado por pixel na placa de vídeo**: a mesma aparência aprovada (versão "1 · Misto" do [terreno](terreno.md)), mas nítida em qualquer zoom e sem refazer nada ao dar zoom.
- **Pincel na hora**: a passada aparece em resolução cheia enquanto o mestre arrasta (sem a prévia de meia resolução).
- **Abrir um mapa grande**: o terreno aparece de uma vez (subir os pesos dos terrenos para a placa é rápido), sem a fila de pedaços aparecendo aos poucos.
- **Terreno e água num desenho só**: o mesmo renderizador, o mesmo canvas, a mesma camada do mapa. A água continua como está (barranco para dentro, shader aprovado), agora desenhada por cima do terreno no mesmo passo.
- **Altura pronta para o relevo**: o terreno ganha a mesma função de altura que a água usa (hoje: 0 em terra, a água desce); luz e sombra são calculadas a partir dela, para o relevo e a luz (passo 2) só somarem.

### Para não fazer (falharia mesmo funcionando)

- Mudar a cara do terreno: as mesmas aquarelas, cores, detalhe, borda irregular e borda escurecida de hoje (diferença só de nitidez).
- Detalhe repetindo de forma visível (um padrão que salta aos olhos a cada poucas casas).
- Pincel engasgando; abrir mapa grande e travar a tela.
- Dois contextos WebGL (um da água, outro do terreno).

### Restrições

- Dados do terreno como hoje (`shared/src/terrain.ts`: 4 pontos por casa, pedaços de 8 × 8 casas, um byte por terreno, canal próprio): nada muda no servidor nem no arquivo de sessão.
- Ordem das camadas do mapa: mesa e imagem do mapa; **chão (terreno + água)**; borda e grid; o resto como hoje.
- **Sem WebGL 2, ou com o contexto perdido**: o terreno volta ao desenho de hoje (`renderChunk.ts`, que fica como reserva), e a água à aquarela. *Reduzir efeitos*: terreno igual, água parada (como hoje).
- Grid quadrado e hex (o terreno é livre, acompanha o grid como hoje); celular (hoje com 16 px por casa) também.
- Sem `any` nem cast forçado; comentários em português.

### Abordagens

- **A. Terreno no shader, num renderizador do chão compartilhado com a água (escolhida).** Pesos dos terrenos numa textura (sobe só o pedaço que mudou), aquarelas e detalhe como texturas, mistura e borda calculadas por pixel. Um contexto, uma camada, a mesma altura para o relevo.
- B. Manter o desenho no processador e só subir as imagens prontas como textura: sem ganho de nitidez nem de pincel; não prepara o relevo.
- C. Trocar o mapa inteiro de motor agora: decidido para depois (roteiro).

### Decidido

- **Pesos dos terrenos na placa**: os 8 terrenos em duas texturas RGBA de 8 bits (4 + 4), um texel por ponto fino (4 por casa), cobrindo a área pintada; filtro linear (a mesma interpolação de hoje). Pedaço que muda = só ele sobe (e o pincel atualiza o pedaço na hora, a partir da cópia local que já existe para a prévia). *(Chamada minha.)*
- **Aquarelas**: as 8 imagens com o ajuste de cor de `TERRAIN_ART` aplicado uma vez ao carregar, como texturas que repetem a cada 8 casas (como hoje), com mipmap.
- **Detalhe**: uma textura por tipo de detalhe (grama, terra, pedra, água) gerada uma vez ao abrir, com o mesmo desenho de `drawDetail`, emendando consigo mesma e repetindo a cada **16 casas** (a aquarela repete a cada 8: com períodos diferentes, o chão inteiro só se repete a cada 16 casas, e o detalhe continua escondendo a repetição da aquarela). As lajes de pedra mudam de tamanho de leve para caber inteiras em 16 casas (largura 16/17 ≈ 0,94 em vez de 0,95; altura 16/22 ≈ 0,73 em vez de 0,72). *(Chamada minha: o detalhe de hoje é sorteado por casa e não repete; repetir é o preço de levar para a placa.)*
- **Pincel de água enquanto arrasta**: a prévia da passada mostra a aquarela da água (como hoje); a água animada é refeita quando a passada termina. Pintando outro terreno por cima de água, a água animada antiga fica até soltar. O terreno só desenha a aquarela da água durante a passada (fora dela, a água é do shader da água, como hoje). *(Chamada minha.)*
- **Luz no passo 1**: a altura do terreno entra na conta (água abaixo, terra em 0), mas sem mudança visível na terra; a luz de verdade é o passo 2. O barranco da água continua com a terra fixa (pegar o terreno pintado do lado fica para a luz/relevo). *(Chamada minha.)*
- **Aprovação do visual**: sem página de teste à parte (o visual é o já aprovado); a comparação com o desenho de hoje é feita por quem implementa, no navegador, lado a lado, e o dono vê no teste antes de lançar ([pendencias.md](../pendencias.md)). *(Chamada minha.)*
- **Mistura e borda**: a mesma conta de `renderChunk.ts` (camadas na ordem dos terrenos, `EDGE_LOW`/`EDGE_HIGH`, ruído de borda de até ±0,21, borda escurecida em até 32%), com o ruído calculado no shader na posição do mapa.
- **Desenho por quadro**: o terreno só é redesenhado quando a visão ou o terreno mudam (guardado numa textura do tamanho da tela); os quadros da água usam essa imagem pronta. *(Chamada minha.)*
- **Código**: `client/src/map/ground/` (o renderizador do chão, sem Konva nem React) absorve o renderizador da água (`client/src/map/water/`), que vira um dos passos dele; a peça de integração com o Konva é uma só.

### Fora do escopo

- Luz (passo 2), relevo e estruturas (passo 3), névoa, efeitos, clima, plantas e objetos (troca de motor).
- Terrenos novos, texturas novas, mudança de arte.

### Fica com quem implementa

- Como cobrir a área pintada com as texturas de pesos num mapa grande (uma textura só com folga, ou várias) dentro do limite de textura do aparelho.
- Como gerar o detalhe sem emenda (sorteio pela posição módulo 8 casas, ou desenhar com dobra nas bordas).
- Resolução das texturas de detalhe e quanto custa um quadro do terreno (alvo: o terreno inteiro abaixo de 5 ms numa tela Full HD).
