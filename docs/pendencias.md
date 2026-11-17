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

## Pendências pequenas

### Água animada ([docs/design/agua.md](design/agua.md))
- [ ] Ao trocar de cena, a água da cena anterior aparece por uma fração de segundo até o Worker responder (`WaterLayer.tsx`: limpar o renderizador ao trocar o terreno inteiro).
- [ ] Ao soltar o pincel de água, a água some por ~150 ms até o Worker responder (`TerrainLayer.tsx` redesenha sem a aquarela antes).
- [ ] Longe da origem do mapa (a partir de ~50–100 casas), as oitavas finas do ruído do shader perdem precisão (`waterShader.ts`, `hash`).
- [ ] `dFdx`/`dFdy` depois de `return` antecipado e dentro de `if` no shader da água: possíveis pixels soltos na margem (`waterShader.ts`).
- [ ] Desfazer em cadeia (riscar → apagar → desfazer → desfazer) não remove a linha recriada, que ganhou id novo (`mapHistory.ts`).
- [ ] Pedras no rio têm só espuma e esteira, não a cúpula no relevo da água que o desenho pedia (`waterShader.ts`, `heightAt`).

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
