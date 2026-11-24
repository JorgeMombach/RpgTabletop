# Clima vivendo no mapa (na placa de vídeo)

Combinado em 2026-11-24, com o dono do projeto, na branch `feat/objetos`. É a **etapa 4, parte 2** (a última) da troca de motor do mapa:
1. [objetos](objetos.md), feita;
2. [sombra por objeto](sombras.md), feita;
3. [névoa](nevoa.md), feita;
4. efeitos e clima:
   - parte 1: [efeitos](efeitos.md), feita;
   - **parte 2: o clima**.

Tudo sai numa versão só. Teste aprovado em [clima-teste.html](clima-teste.html) (código em [clima-teste.ts](clima-teste.ts)).

## Por quê

Hoje o clima (`WeatherOverlay.tsx`, `weatherFx.ts`) é uma película "no vidro":
- **Não acompanha o mapa:** é um canvas por cima da tela, com partículas em pixels da tela, então não anda com o mapa.
- **Não conhece o cenário:** não sabe de telhado nem de chão. A chuva cai igual dentro de casa.
- **Vento solto:** o vento dele não conversa com o das plantas.

O dono escolheu que o clima **passe a viver no mapa** e que o que cobre o chão **acumule aos poucos**. O desempenho continua sendo requisito.

## O que é

Um passo de clima no renderizador do chão, com três saídas.

| Saída | O que tem | Onde fica |
|---|---|---|
| **Chão** | Molhado e poças, neve, areia, folhas pousadas | Logo acima do chão, embaixo de paredes, objetos e tokens |
| **Ar** | Gotas, flocos, folhas, areia, granizo, névoa | Acima de tokens e copas, embaixo da luz (escurece à noite) |
| **Brilho** | Brasas, vagalumes, luzes mágicas | Acima da luz (brilha sozinho) |

- **Partículas:** calculadas no shader pela posição no mapa e pelo tempo, sem lista no processador.
- **Cobertura:** cresce com o tempo desde o início do clima.
- **Telhado:** dentro dos cômodos fechados nada cai nem cobre.
- **Vento:** um só, o mesmo que balança as plantas.

### Metas

**Cada clima no mapa** (aprovado pelo dono):

| Clima | O que cai | O que cobre o chão |
|---|---|---|
| Chuva, chuva forte, tempestade, chuva de sangue | Riscos com o vento e respingos | Chão molhado e poças nas partes baixas, com anéis dos pingos. A chuva de sangue é vermelha. |
| Granizo | Pedrinhas que quicam e somem | Pedrinhas brancas espalhadas |
| Neve, nevasca | Flocos com balanço (a nevasca, de lado e densa) | O chão fica branco |
| Névoa | Rente ao chão, andando com o vento | Nada; fica rala dentro de cômodo |
| Folhas, pétalas, cinzas, esporos | Voam e giram com o vento | Pousam no chão |
| Areia | Riscos de lado em rajadas | Véu claro em faixas no sentido do vento |
| Brasas, vagalumes, luzes mágicas | Derivam e piscam, com brilho em volta | Nada; brilham sozinhos à noite |
| Calor | A miragem tremendo no chão | Nada |

- **Tempestade:** o relâmpago clareia o mapa de luz nos mesmos instantes de hoje (`LightningClock`, pelo início do clima), e o trovão continua.
- **Acúmulo:** chega ao máximo em 2 minutos desde o início do clima, igual para todos (pelo `startedAt` que o servidor já guarda), na intensidade do clima. Trocar o clima recomeça do zero.
- **Desempenho:** 0,2 ms por quadro na página de teste (1200 × 750).
- **"Reduzir efeitos":** metade das partículas e sem o clarão, como hoje.

### Não metas

- **Interface e regras:** a ferramenta do clima, a luz da cena e os sons ficam como estão.
- **Cobertura entre trocas:** não é guardada. Trocar de clima recomeça.
- **Sem WebGL 2:** a película de hoje (`WeatherOverlay`) continua.

### Anti-metas

- Chuva ou neve dentro de cômodo fechado.
- Ruído repetindo em xadrez (neve, névoa, poças).
- Cobertura tapando paredes, objetos ou tokens.
- O clima pesando mais que hoje.

## Caminhos considerados

- **Um passo de clima na placa, com as partículas no shader.** **Escolhido pelo dono** ("pode ir pelo 1").
- **Partículas no processador, só que no mapa, e só a cobertura na placa.** Descartado: com chuva forte ou nevasca o processador volta a pesar.

## Como fica

- **Ruído:** uma nuvem sem o ladrilho aparecendo. São três leituras do ruído pronto, giradas e em escalas que não batem (`cloud(c, escala)` da página).
- **Telhado** *(chamada minha)*:
  - **De onde vem:** os cômodos fechados que a luz já usa (`wallRooms`, com as paredes que cada um conhece), triangulados.
  - **Como é guardado:** numa textura de 8 px por casa sobre a área dos cômodos, com níveis menores (borda macia).
  - **Quando é refeito:** só quando as paredes mudam.
- **Uniforms** *(chamada minha)*:
  - tempo do clima (segundos desde `startedAt`) e acúmulo (`min(1, tempo / 120)`);
  - intensidade e vento (`tan` do ângulo do clima: casas de lado por casa de queda, e a força);
  - o tipo.
- **Saídas:** as três da tabela acima, cada uma como imagem de saída do chão, nos lugares dela.
- **Relâmpago:** o clarão vai na camada de brilho, por cima da luz, com a mesma curva de hoje (`flash`) *(mudado no plano: o mapa de luz é cortado em 1, e de dia o clarão somado nele não apareceria)*.
- **Animação:** o clima pede quadros como a água. Só as três imagens dele são refeitas (caminho curto); com relâmpago, a luz também.
- **Som:** `WeatherOverlay` continua tocando o trovão e o som do clima. Com o chão na placa ele não desenha.

## Os outros 10 climas

Chuva forte, granizo, nevasca, chuva de sangue, cinzas, calor, vagalumes, luzes mágicas, esporos e pétalas seguem o mesmo esquema (aprovados na página em 2026-11-24; são 17 climas ao todo). Eles entram na página de teste para o dono aprovar **antes** de ir para o app: é a primeira tarefa do plano, com uma parada.

## Página de teste

[clima-teste.html](clima-teste.html):
- **Cena:** casa fechada (telhado), casa aberta, caminho de terra e dois tokens.
- **Climas:** chuva, tempestade, neve, névoa, folhas, areia e brasas, de dia e à noite.
- **Controles:** vento, tempo acelerado (12×) e *Hoje*.

Aprovada em 2026-11-24, depois do ajuste do ruído repetindo, da areia forte demais e do brilho das brasas.

## Fica para o construtor

- Onde a textura do telhado é feita: no passo do clima, a partir dos cômodos da luz.
- A área coberta pela textura do telhado em mapa grande: os cômodos mais uma folga, com teto de tamanho.
- Medir no teste do dono antes de lançar (roteiro em `docs/pendencias.md`).
