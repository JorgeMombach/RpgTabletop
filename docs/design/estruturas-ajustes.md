# Ponte de pedra, escadas no relevo e margem dos rios (bloco 3 da lista de 2026-11-24)

Combinado em 2026-11-24, com o dono do projeto, na branch `feat/objetos`. É o terceiro de seis blocos antes de lançar a versão. Os anteriores foram os [ajustes rápidos](ajustes-rapidos.md) e o [desempenho](desempenho.md).

Testes aprovados:
- [ponte-pedra-teste.html](ponte-pedra-teste.html): **Pilares**;
- [escadas-relevo-teste.html](escadas-relevo-teste.html): **Legível**;
- [rios-teste.html](rios-teste.html): **Suave**.

## Por quê

O dono notou três coisas testando o app:
- **Ponte de pedra:** o final está "bem estranho".
- **Escadas no relevo:** "visual estranho, não dá para entender bem do que se trata".
- **Rios:** o rio fino (pincel de 0,5 casa) tem mais margem que água, e as margens estão "bem profundas".

## O que é

1. **Cabeceira de pedra com pilares** (escolhida):
   - as muretas seguem retas até a ponta, em vez de abrir em "V";
   - cada lado termina num pilar quadrado de pedra, com o topo claro, a borda escura e uma sombra curta no chão;
   - um calçamento curto (0,45 casa) some logo na terra;
   - o caminho gasto que chega na ponte é de terra batida, sem a mancha clara de pedra.
2. **Escadas legíveis** (escolhida), para pedra e madeira:
   - espelho de cada degrau escuro, com sombra na base, e nariz claro;
   - degraus e patamares mais claros conforme sobem, mais escuros embaixo;
   - patamar menos claro que hoje;
   - mureta num tom mais perto da rocha, com contorno escuro do lado de fora, que separa a escada do chão.
   - É a força 0,6 da página de teste.
3. **Margem suave** (escolhida):
   - o barranco nunca passa de 40% da meia largura da água naquele ponto, e a altura dele acompanha a largura (40% no rio mais fino, cheia a partir de 1,5 casa de meia largura);
   - todas as margens ficam mais rasas (65% da altura de hoje) e com menos contraste na luz, na base escura e na crista.

## Não metas

- Mudar a ponte de tábuas, a de corda, o píer, a escada caracol ou a escada de mão.
- Mudar a água em si (cor, ondas, correnteza). O mar é o bloco 5.

## Caminhos considerados

As variações ficaram lado a lado nas páginas de teste, e o dono escolheu uma de cada:
- **Ponte:** Hoje, Pilares ou Rente ao chão. Escolheu **Pilares**.
- **Escadas:** Hoje, Legível ou Forte. Escolheu **Legível**.
- **Rios:** Hoje, Proporcional ou Suave. Escolheu **Suave**.

Para a largura da água no app *(chamada minha)*:
- **Campo da meia largura no Worker da água** (escolhido): a maior distância até a margem num raio de 2 casas em volta de cada ponto. No rio fino ela dá a meia largura dele; perto da margem de um rio largo, dá pelo menos 1,5 casa, e a margem fica cheia. Vai junto com a distância e a parte funda, na mesma textura (RGBA em meia precisão).
- **Calcular no shader:** ler a distância em volta de cada pixel no desenho do barranco. Descartado: são muitas leituras por pixel num passo que já é pesado.

## Fica para o construtor

- Os números vêm das páginas aprovadas. O código delas é a referência.
- Medir o assar da água com a skill de desempenho: o campo novo não pode pesar no Worker de forma perceptível.
