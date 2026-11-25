# Medições de desempenho

Resultados do teste repetível do mapa (`?bench` no app em desenvolvimento), um arquivo por medição: `AAAA-MM-DD-<rótulo>.json`. Como rodar e comparar está na skill `.claude/skills/desempenho/SKILL.md`. O porquê e as metas estão em [docs/design/desempenho.md](../design/desempenho.md).

Cada medição monta a mesma cena pesada, numa cena nova apagada no fim:
- 60 × 40 casas, com rio, relevo e dunas;
- 300 árvores;
- 20 tochas;
- 6 cômodos;
- névoa;
- chuva à noite.

Depois ela mede 7 situações:

| Cenário | O que faz |
|---|---|
| `idle` | 3 s parado |
| `zoom` | 40 passos da rodinha, 20 para dentro e 20 para fora |
| `pan` | arrasta o mapa 600 px |
| `firstWater` | o primeiro lago da cena |
| `water50` | 50 vezes: traço de água, correnteza e desfazer os dois |
| `relief` | um morro e uma duna, até terminar de calcular |
| `forestWind` | 5 s parado com a floresta balançando |

Os números de cada cenário:
- **tempo entre quadros:** mediana, piores 5% e o pior, em ms (16,7 = 60 quadros por segundo);
- **memória do JS:** em MB;
- **objetos vivos na placa de vídeo:** texturas, buffers, programas e framebuffers.

Compare sempre medições com o mesmo tamanho de tela (`screen` no arquivo).
