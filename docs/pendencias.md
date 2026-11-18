# Pendências da branch `feat/campanha`

Roteiro para a rodada de testes e correções antes de lançar a versão. Duas partes:

- **Para testar antes de lançar:** o que foi feito e ainda não foi visto no navegador pelo dono. Cresce a cada entrega.
- **Pendências pequenas:** defeitos e acabamentos achados nas revisões finais de cada entrega e deixados para depois (nenhum quebra o uso). Cada um tem a área e onde mexer.

Ao corrigir ou testar um item, marque `[x]` (ou apague a linha) no mesmo PR.

## Para testar antes de lançar

### Diário da campanha
- [ ] Mestre cria entradas (sessão, missão, NPC, lugar), nota secreta, libera e recolhe; jogador lê pelo livro no topo (também no celular) e recebe o aviso.

### Grid hexagonal
- [ ] Trocar *Quadrado* / *Hex ↕* / *Hex ↔* no painel *Mapa*, com a confirmação quando apaga paredes, névoa ou pinturas.
- [ ] Tokens (inclusive criaturas grandes), régua, calibração, áreas de magia, pincel de efeitos e pincel de objetos no hex.
- [ ] Paredes e portas nos vértices e meios de lado; névoa (pincel, retângulo, *Cômodo*), visão dos personagens, explorado e "visto por último" no hex.

### Terreno pintado
- [ ] Pintar os 8 terrenos, mistura entre eles, *Borracha*, *Desfazer*, *Apagar tudo*; por cima da imagem do mapa e sem imagem; no hex; trocar de cena e carregar arquivo.

### Efeitos do mapa
- [ ] Fogo, raízes e eletrificado redesenhados (área parada, área que anda com o token, área fina).

### Vento nas plantas
- [ ] Árvore, arbusto, flores, pinheiro, palmeira e grama alta balançando; cogumelos e o resto parados.
- [ ] Clima *Vento com folhas* (vento para a esquerda e para a direita): balanço mais forte e para o lado do vento.
- [ ] Token embaixo da copa: copa meio transparente e parada.
- [ ] Ferramenta *Objetos* aberta e *Reduzir efeitos*: tudo parado.
- [ ] *Espalhar* com *Floresta* (tem pinheiros) e *Campo*; floresta grande (300 árvores): arrastar e dar zoom fluidos.

### Água animada
- [ ] Rio e lago pintados sobre grama, sobre a imagem de um battlemap e sobre a mesa vazia: barranco para dentro, nada coberto fora do pintado.
- [ ] *Correnteza*: riscar, *Apagar linha*, *Desfazer*; rio correndo no sentido da linha; linha contra outra e linha em terra.
- [ ] *Pedras* e *Pedregulho* no rio: espuma e esteira.
- [ ] Arrastar e dar zoom (a água presa ao terreno), grid hex, mapa grande com vários lagos.
- [ ] Trocar de cena e carregar arquivo de sessão.
- [ ] Jogador (entrando pelo IP da rede): vê a água correr, não vê as linhas.
- [ ] *Reduzir efeitos*: água parada.

### Terreno na placa de vídeo (renderizador do chão)
- [ ] Mesmo terreno de antes (cores, borda irregular, detalhe), nítido em zoom bem perto e bem longe; detalhe repetindo a cada 16 casas sem saltar aos olhos.
- [ ] Pincel: a passada aparece na hora, em resolução cheia; pincel de água mostra a aquarela até soltar e vira água animada depois.
- [ ] Mapa grande com terreno: aparece de uma vez; arrastar e dar zoom fluidos.
- [ ] Grid hex e celular (jogador entrando pelo IP da rede): o terreno acompanha o grid.
- [ ] Trocar de cena e carregar arquivo: terreno e água da cena certa.
- [ ] Reserva: com WebGL desligado no navegador, o terreno aparece como antes.

### Luz (dia, noite, tochas e sombras)
- [ ] Dia, entardecer, noite e luar: aparência de cada um e a troca entre eles (inclusive com a *Hora do jogo* avançando).
- [ ] Sombras do sol e da lua nas paredes, com borda macia; janela faz sombra curta.
- [ ] Tochas fixas e de token param nas paredes e portas fechadas, passam por porta aberta e janela; tremulam e mudam de cor.
- [ ] Chama nova nos três desenhos de tocha (fincada, de ferro, braseiro) e no selo do token; tamanho de ~0,75 casa.
- [ ] Arrastar tocha ou token com tocha: a luz e a chama acompanham.
- [ ] Mestre com brilho mínimo na noite; *Ver como jogador* mostra o escuro de verdade; jogador (pelo IP da rede) vê escuro.
- [ ] Chuva e outros climas escurecem à noite; relâmpago continua clareando.
- [ ] Névoa cobre a chama das tochas escondidas.
- [ ] *Reduzir efeitos*: tochas sem tremular.
- [ ] Reserva: com WebGL desligado no navegador, véu e brilho de antes.
- [ ] Desempenho: mapa com muitas paredes e tochas (arrastar e zoom fluidos); editar parede em cena enorme dá um tranco de ~0,4 s (aceito).

### Paredes emendadas, janela e telhado
- [ ] Emenda: quadrado de 4 paredes, T, cruzamento, traço sobreposto, diagonais e paredes no grid hex viram uma peça só; desenhos ou espessuras diferentes só se encostam.
- [ ] Mapas antigos (arquivo de sessão de antes) abrem emendados.
- [ ] Ferramenta *Paredes*: os 5 ícones dos modos (parede, porta, janela, trocar desenho, borracha) cabem com a coluna na largura mínima; dica com o nome em cada um.
- [ ] Janela: traçar por cima de parede abre o vão; *Desfazer* volta a parede inteira; escolher e fechar a persiana; clique com *Mover* abre e fecha; apagar.
- [ ] Porta traçada por cima de parede: com a porta aberta, o jogador vê pelo vão (antes não via).
- [ ] Jogador com névoa: janela aberta deixa ver, fechada corta; *Cômodo* da névoa para na janela.
- [ ] Telhado invisível: de dia, cômodo fechado sem sombra e um pouco mais escuro (bem de leve); cercado com cerca continua com sombra; sol pela janela aberta no chão (comprido no entardecer, azulado no luar); jogador só ganha o telhado depois de ver todas as paredes do cômodo.
- [ ] Desempenho: pan e zoom com muitas paredes; trocar de degrau de zoom numa cena enorme dá um tranco de ~0,3 s a mais que antes (montagem das imagens das paredes).

### Relevo (etapa 1)
- [ ] Ferramenta *Relevo* (N): níveis −2..+3, *Escarpa* e *Suave*, tamanho, *Desfazer*, *Aplainar tudo*; cabe na coluna na largura mínima.
- [ ] Penhasco de escarpa: rocha em camadas, borda clara, contorno fino de perto e de longe; patamar dentro de patamar; baixada (−1, −2).
- [ ] Encosta suave: morro arredondado, sem anéis nem raios; colina com um lado em escarpa e o outro suave, sem risco no meio.
- [ ] Luz: dia, entardecer (sombra comprida), luar e noite; trocar a luz troca a sombra devagar; dentro de cômodo fechado, sem sombra.
- [ ] Relevo atravessando vários pedaços (8 × 8 casas): a face e a sombra emendam sem costura.
- [ ] Sobre a imagem do mapa (sem terreno pintado): a face aparece, o topo continua a imagem. Face sobre a água animada (rio no fundo do cânion).
- [ ] Pintar relevo num mapa grande e arrastar logo depois: sem engasgo; o relevo aparece uma fração de segundo depois (cálculo no Worker).
- [ ] Muitos pedaços com relevo (mais de 64): fica menos nítido de perto, sem sumir.
- [ ] Celular/tablet (jogador pelo IP da rede): o relevo aparece, com menos detalhe.
- [ ] Jogador vê o relevo (sob a névoa como o resto do chão); troca de cena e arquivo de sessão.
- [ ] Sem WebGL: chão plano, sem erro.

## Pendências pequenas

### Relevo ([docs/design/relevo.md](design/relevo.md))
- [ ] Sombra do relevo só alcança 8 casas (a margem da janela): no entardecer, a de um patamar de 2+ níveis termina numa linha quase reta (`reliefShader.ts`).
- [ ] Altura de um pedaço leva 7 a ~35 ms (no Worker); o alvo era 5 ms (`relief.ts`).
- [ ] Calibrar o comprimento da sombra (um nível = 1,6 × a sombra de uma parede) e a força da luz das encostas à noite.

### Paredes emendadas ([docs/design/paredes.md](design/paredes.md))
- [ ] Mapa com mais de ~700 cadeias (muitos cruzamentos de desenhos diferentes) pode refazer as imagens a todo quadro (`wallChainArt.ts`: o teto é de pixels, mas o que está na tela pode passar dele).
- [ ] Quina muito fechada no traço livre (ângulo interno abaixo de ~35°): o lado de dentro do contorno se cruza (`wallChainArt.ts`, chanfrar em vez de limitar o bico).
- [ ] Emenda por arredondamento (0,001 casa), não por distância: traço livre que quase encosta (0,01) não emenda; sobreposição quase alinhada vira um X raso (`wallJoin.ts`).
- [ ] Janela: o *Cômodo* da névoa conta toda janela, mas o telhado ignora janela com desenho vazado, e janela com desenho vazado nunca bloqueia mesmo fechada (`fog.ts`/`wallJoin.ts`: ignorar o desenho na janela).
- [ ] A textura de um cômodo pode "pular" depois de *Desfazer* (a cadeia começa noutro ponto conforme a ordem das paredes; `wallJoin.ts`: começar pelo menor ponto).
- [ ] O passo da luz compara cômodos e janelas por texto a cada atualização, inclusive arrastando tocha (`lightPass.ts`: comparar pela referência, já memorizada).
- [ ] `parseWall`: `raw` da janela repete o nome do parâmetro e lê antes de conferir o tipo (mesmo padrão da porta); `getContext("2d")!` em `wallChainArt.ts` (já trocado na reescrita; conferir `wallArt.ts`).
- [ ] A conta da emenda (O(n²)) roda duas vezes por mudança de paredes (cadeias e cômodos) e de novo na prévia de *Trocar desenho*.
- [ ] Montar as imagens das paredes ao trocar de degrau de zoom ficou mais lento (600 paredes: ~0,8 s; antes ~0,14 s), porque cada pedaço de tira pinta o trecho inteiro.

### Luz ([docs/design/luz.md](design/luz.md))
- [ ] O corpo da tocha fixa é desenhado por cima da chama nova (a camada das chamas fica embaixo de `MapTorchLayer`): conferir de olho, principalmente a bacia do braseiro (`BattleMap.tsx`).
- [ ] Chuva e neve escurecem pela luz de destino, não pela que está no meio da troca: pulam enquanto o mapa escurece devagar (`weatherDim` em `BattleMap.tsx`).
- [ ] Com qualquer tocha na cena, o chão redesenha a 30 quadros por segundo, até de dia e com a tocha fora da tela; também com o chão desligado por terreno grande demais (`GroundLayer.tsx`, `flickering`).
- [ ] O texto do desenho diz que com névoa "nada aparece" depois de uma porta secreta, mas a camada da luz fica acima da névoa: a poça de luz aparece sobre a névoa (`docs/design/luz.md`; ajustar o texto).
- [ ] O desenho diz que o mapa de luz já recebe a altura do chão; ainda não recebe (fica para o relevo).
- [ ] No primeiro instante com o chão em WebGL, a película e o brilho antigos já saíram e o mapa de luz ainda não chegou: um piscar claro à noite ao abrir o mapa (`BattleMap.tsx`, `groundLit`).
- [ ] Se só o shader da luz falhar, o chão inteiro volta para o desenho antigo (terreno junto).

### Água animada ([docs/design/agua.md](design/agua.md))
- [ ] Ao trocar de cena, a água da cena anterior aparece por uma fração de segundo até o Worker responder (`WaterLayer.tsx`: limpar o renderizador ao trocar o terreno inteiro).
- [ ] Ao soltar o pincel de água, a água some por ~150 ms até o Worker responder (`TerrainLayer.tsx` redesenha sem a aquarela antes).
- [ ] Longe da origem do mapa (a partir de ~50–100 casas), as oitavas finas do ruído do shader perdem precisão (`waterShader.ts`, `hash`).
- [ ] `dFdx`/`dFdy` depois de `return` antecipado e dentro de `if` no shader da água: possíveis pixels soltos na margem (`waterShader.ts`).
- [ ] Desfazer em cadeia (riscar → apagar → desfazer → desfazer) não remove a linha recriada, que ganhou id novo (`mapHistory.ts`).
- [ ] Pedras no rio têm só espuma e esteira, não a cúpula no relevo da água que o desenho pedia (`waterShader.ts`, `heightAt`).

### Renderizador do chão ([docs/design/renderizador-chao.md](design/renderizador-chao.md))
- [ ] Pintando grama por cima de água, a água animada antiga cobre a grama nova por ~150 ms depois de soltar, até o Worker responder (`GroundLayer.tsx`).
- [ ] Com o chão desligado (`groundFailed`), o relógio da água continua desenhando num canvas invisível e alimentando o detector de aparelho lento (`GroundLayer.tsx`: incluir `!groundFailed` no relógio).
- [ ] Mudar a densidade da tela (arrastar a janela para outro monitor) não redesenha o chão até a próxima mudança de visão (`GroundLayer.tsx`).
- [ ] `terrainShader.ts` usa 8 e 16 fixos em vez de `TERRAIN_CHUNK_CELLS` e `DETAIL_PERIOD`.
- [ ] Hash do ruído da borda faz `uint(x)` de inteiro negativo (terreno à esquerda/acima da origem): o ANGLE preserva os bits, mas a GLSL ES 3.00 não garante (`terrainShader.ts`).
- [ ] `dispose` do chão não apaga programas, buffers e framebuffers (o `loseContext` libera tudo; só registro).
- [ ] Conferir de olho: detalhe com zoom bem longe pode sair um pouco mais escuro (mipmap de textura com alfa não pré-multiplicado; não reproduzido na medição).

### Vento nas plantas ([docs/design/vento.md](design/vento.md))
- [ ] Mudar o clima (até só a luz de dia/noite) recria a animação e as plantas dão um pulinho no balanço (`PlantWind.tsx`: `frame.time` volta a 0).
- [ ] Grama alta com vento põe todas as pontas sobre todas as bases; parada, elas se alternam folha a folha (`plantArt.ts`).
- [ ] Sombra borrada da palmeira (`ctx.filter`) não funciona no Safari: sai nítida (`plantArt.ts`).
- [ ] Dois `!` antigos em `propImage` (`getContext("2d")!` e `.value!`) (`propArt.ts`).

### Terreno pintado ([docs/design/terreno.md](design/terreno.md))
- [ ] Pedaço sem dados próprios não é desenhado: depois da *Borracha*, a faixa de 1/4 de casa até o vizinho da direita/de baixo fica cortada reta (`renderChunk.ts` / `TerrainLayer.tsx`).
- [ ] Pinceladas sobrepostas em conexão lenta: o `.then` da primeira apaga a prévia da segunda e o *Desfazer* pode não fazer nada (`BattleMap.tsx`, `mapHistory.ts`).
- [ ] Chave de pedaço não canônica (`"01,0"`, `"-0,0"`) aceita do arquivo de sessão e do `terrain:restore` (servidor).
- [ ] Falha ao carregar as aquarelas fica guardada até recarregar a página (`terrainArt.ts`).
- [ ] Arquivo de sessão com pedaços demais mostra a mensagem de pintura ("apague uma parte antes de pintar mais") em vez de uma de arquivo.

### Grid hexagonal ([docs/design/grid-hex.md](design/grid-hex.md))
- [ ] Dica da ferramenta *Paredes* fala em canto do grid, não em vértice/lado do hex (pt-BR, en, es).
- [ ] Comentário de `changeGrid` (`server/src/actions/map.ts`) ainda diz que no hex não há ferramenta para revelar.
- [ ] `maskKey` da névoa sem o grid (`Fog.tsx`): só pesa trocando entre cena quadrada e hex com o revelado idêntico.
- [ ] Arquivo de sessão editado à mão com cena hex e névoa ligada fica sem como desligar a névoa (`fog:set` recusado no hex).
- [ ] O canvas da máscara da névoa pode passar do limite do iOS numa área revelada enorme (já era assim no quadrado).

### Diário da campanha ([docs/design/diario.md](design/diario.md))
- [ ] `.journal-secret` usa cores fixas do protótipo (`#231a14`, `#6b4b2f`) em vez de variáveis `--mantine-*`.
- [ ] `journal:share` com o mesmo valor ainda sobe `updatedAt` (reliberar avisa os jogadores de novo).
- [ ] `journalLoaded` não zera ao reconectar: o que mudou enquanto o jogador estava fora vira aviso ao voltar.
