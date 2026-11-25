---
name: desempenho
description: Mede o desempenho do mapa do Jamal's Tabletop com o teste repetível (?bench) e compara com a medição anterior. Use antes e depois de qualquer mudança de desempenho, ou quando pedirem para medir fps, zoom, memória ou engasgos.
---

# Medir o desempenho do mapa

O teste (`client/src/bench/`) monta uma cena pesada numa cena nova e roda 7 cenários. Depois apaga a cena.

A cena pesada tem:
- 60 × 40 casas, com rio e relevo;
- 300 árvores;
- 20 tochas;
- 6 cômodos;
- névoa;
- chuva à noite.

O desenho e as metas estão em `docs/design/desempenho.md`.

## Passos

1. **Dev rodando:** `preview_start` com o nome `dev` (servidor :3999 + Vite :5173). Abra pelo `localhost`, que entra como mestre.
2. **Janela à vista:** `tabs_context` tem que dizer que o painel do navegador está **exibido**. Com ele escondido, o navegador segura os quadros e os números não valem.
3. **Tamanho fixo:** `resize_window` 1600 × 900, para comparar medições. Volte para `desktop` no fim.
4. **Abrir** `http://localhost:5173/?bench` (`navigate`), esperar 3 s e conferir que `window.rpgBench` existe.
5. **Rodar.** O teste leva uns 2 minutos, mais que o limite de um comando, então rode em duas chamadas do `javascript_tool`:
   - `window.__benchResult = null; window.rpgBench.run().then((r) => (window.__benchResult = r), (e) => (window.__benchResult = { erro: e.message })); "começou"`
   - depois, repetindo até vir: `for (let i = 0; i < 40 && !window.__benchResult; i++) await new Promise((r) => setTimeout(r, 1000)); JSON.stringify(window.__benchResult)`
6. **Salvar** o JSON formatado em `docs/desempenho/AAAA-MM-DD-<rótulo>.json` (rótulo curto: `inicio`, `zoom`, `vazamento`…).
7. **Comparar** com o arquivo anterior da pasta. Monte uma tabela por cenário com `p95Ms`, `worstMs` e `heapMb`: antes, depois e a diferença. No `water50`, compare também `water50Before` com o fim do `water50` (memória e `gl`).

Se der erro, a mensagem diz qual ação foi recusada. A cena de teste se apaga sozinha; se sobrar uma chamada "Teste de desempenho", apague-a no painel de cenas.

## Metas

| Cenário | Meta |
|---|---|
| `zoom` | `p95Ms` ≤ 25 |
| `water50` | memória e `gl` no fim = `water50Before` ±10% |
| `relief`, `firstWater`, `forestWind`, `pan` | `p95Ms` ≤ 33 (o ritmo das animações) |

## O que cada número quer dizer

- `medianMs` / `p95Ms` / `worstMs`: tempo entre quadros (16,7 = 60 fps; 33 = 30 fps). O `p95` é o que se sente como engasgo.
- `heapMb`: memória do JS no fim do cenário. Varia com o coletor de lixo; só uma subida grande e repetida indica vazamento.
- `gl`: texturas, buffers, programas e framebuffers vivos na placa de vídeo. Deve ficar estável entre o começo e o fim do `water50`.
