# Desempenho e estabilidade (bloco 2 da lista de 2026-11-24)

Combinado em 2026-11-24, com o dono do projeto, na branch `feat/objetos`. Segundo de seis blocos antes de lançar a versão (o primeiro, [ajustes rápidos](ajustes-rapidos.md), está feito).

## Por quê

O motor do mapa foi todo para a placa de vídeo e o visual ficou bom, mas o uso ainda engasga:
- **Zoom:** "ta terrível mesmo". No PC do dono (Radeon RX 6650 XT), a placa sobe a 70% e o fps cai.
- **Animações param e não voltam** depois de uma queda de fps, mesmo com o fps normalizado.
- **Relevo e dunas** derrubam o fps.
- **Primeira água** dá uma travada.
- **Objetos animados** fazem o fps cair em vários momentos.
- **Fechamento:** o app instalado (2.14.0) fechou sozinho em 22/11, perto de 12:10, com o dono mexendo nas configurações da água. Às 12:05 o Windows registrou que o `jamals-tabletop.exe` estava com a memória crescendo sem parar (`RADAR_PRE_LEAK_64`).

O dono quer que **o desempenho melhore de fato**, com o zoom como prioridade. Também quer um jeito repetível de medir, que um agente consiga rodar com pouco contexto (uma skill).

## O que já se sabe (do código)

- **Detector de aparelho lento** (`FrameWatch`, `shared/src/wind.ts`):
  - mais da metade dos quadros de uma janela de 3 s acima de 50 ms desliga água, vento e tochas **até recarregar a página**;
  - ele conta também os quadros de trabalho pontual (zoom, arrasto, relevo calculando).
- **Zoom:**
  - cada mudança de `view` faz um `paint` completo em `GroundLayer`, em resolução cheia: chão, relevo, paredes, objetos, efeitos, clima, luz e névoa;
  - cada saída é copiada da tela WebGL para uma tela 2D (`copyTo`, até 12 por quadro);
  - o React refaz o `BattleMap` a cada passo da rodinha.
- **Falha:** o app não guarda relatório de falha nem reage à janela caindo. O jogo vive no servidor, no processo principal, então a partida sobrevive se só a janela cair.

## Metas

1. **Medição repetível:**
   - um modo de teste no app em desenvolvimento (`?bench` no endereço) monta uma cena pesada pelas ações do jogo, roda os cenários e devolve uma tabela;
   - uma skill de projeto (`.claude/skills/desempenho/SKILL.md`) ensina a rodar o teste, guardar o resultado e comparar com o anterior.
2. **Zoom fluido:** nos piores 5% dos quadros, no máximo 25 ms durante o zoom, na cena pesada e no PC do dono.
3. **Animação que volta:**
   - trabalho pontual (zoom, arrasto, relevo calculando, a primeira água) não conta como aparelho lento;
   - quando desliga, a animação tenta de novo depois de 5 s, 15 s, 45 s e assim por diante.
4. **Sem vazamento:** depois de mexer na água 50 vezes, a memória volta ao patamar do começo (±10%).
5. **Janela que cai, volta:**
   - no app, se a janela cair, ela recarrega sozinha e o jogo continua;
   - o app grava um registro local da falha na pasta dele, sem enviar nada.
6. **Relevo, primeira água e objetos animados:** cada um com número antes e depois, atacados na ordem do que a medição mostrar como mais caro.

## Não metas

- Mudar o visual aprovado. Durante o zoom ele pode ficar provisório (ver abaixo), mas o resultado parado é o mesmo de hoje.
- Medir em outros aparelhos. O alvo é o PC do dono; o detector cuida dos mais fracos.

## Anti-metas

- O zoom ficar "pulando": o mapa precisa acompanhar a rodinha sem atraso perceptível.
- Uma correção de desempenho que apague um efeito aprovado.
- O registro de falha guardar dados do jogo (a ADR-04 continua: nada da partida vai para o disco).

## Caminhos considerados

**Medição:**
- **Modo de teste dentro do app em desenvolvimento**, rodado pelo navegador do app ou do agente (escolhido): mede na placa de vídeo de verdade, sem dependência nova.
- **Navegador automático** (Playwright): descartado. Sem janela, ele desenha sem a placa de vídeo e os números não valem nada.
- **App empacotado:** só para a conferência final.

**Zoom** *(chamada minha)*:
- **Zoom provisório** (escolhido):
  - durante o gesto (rodinha ou pinça até cerca de 150 ms depois do último passo), as imagens já desenhadas acompanham a escala nova, esticadas, sem refazer nada na placa;
  - parado o gesto, um desenho completo na resolução nova;
  - é o que mapas como os de navegação fazem: fluido no gesto, nítido ao parar.
- **Deixar o desenho completo mais barato:** necessário de qualquer forma para o arrasto e as animações, mas sozinho não chega a 25 ms com 8 a 12 cópias de tela cheia por quadro.
- **Refazer só parte das camadas:** cada camada depende da escala (relevo por pixel, paredes, luz), então todas mudam no zoom. Não resolve.

## Como fica

- **Cenários do teste** *(chamadas minhas)*:
  - parado;
  - zoom de ida e volta (40 passos);
  - arrasto;
  - pintar água pela primeira vez;
  - mexer na água 50 vezes;
  - relevo e dunas;
  - floresta de 300 objetos com vento.
- **O que o teste mede:**
  - por cenário: mediana, piores 5% e o pior quadro (ms);
  - memória do JS (`performance.memory`) e a contagem de texturas e buffers vivos na placa (um contador no `glKit`, só em desenvolvimento).
  - Resultado em `docs/desempenho/AAAA-MM-DD-*.json`, comparado com o anterior pela skill.
- **Cena pesada:**
  - mapa de 60 × 40 casas;
  - terreno variado, rio e lago;
  - relevo e dunas;
  - 300 objetos (floresta);
  - 20 tochas;
  - paredes de 6 cômodos;
  - névoa;
  - chuva à noite.
  - É montada pelas ações de sempre, numa cena nova, e apagada no fim.
- **Detector:**
  - não conta quadros enquanto o mapa estiver ocupado (zoom ou arrasto nos últimos 300 ms, relevo calculando, água pendente);
  - parou: tenta de novo depois de 5 s, depois 15 s, 45 s e assim por diante, até 5 minutos.
- **Falha no app:**
  - `render-process-gone` → recarrega a janela;
  - `crashReporter` local (`uploadToServer: false`);
  - uma linha em `falhas.log`, na pasta do app, com a data, o motivo e a versão.
  - Exceção anotada na ADR-04 da SPEC.

## Fica para o construtor

- A causa do vazamento: ela sai da medição de "mexer na água 50 vezes" (texturas que não são apagadas, programas recriados, workers…).
- A ordem dos engasgos depois do zoom, pelos números.
- Confirmar no app empacotado, no fim do bloco, que o zoom e a memória seguem as metas.
