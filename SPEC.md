# Spec — Jamal's Tabletop (antes: Simulador de Encontros)

## 1. Objetivo
Ferramenta para conduzir **combates** de RPG de mesa (base D&D 5e) entre o mestre e os jogadores, cada um na sua máquina. O sistema é um **registro compartilhado**, não um motor de regras: ele guarda vida, iniciativa, slots de magia, mapa e posição dos tokens. **Todo cálculo (dano, cura, movimento, alcance) é feito pelas pessoas**, conforme as fichas manuais.

Sem persistência: tudo é inserido durante a sessão e some quando o servidor é desligado.

**Fora de escopo:** ficha completa, CA, cálculo de ataque/dano, validação de movimento, fog of war, login/senha, persistência em disco, hospedagem dedicada.

## 2. Conceitos
- **Sessão:** o servidor rodando na máquina do mestre. Jogadores entram e ficam conectados enquanto ele estiver de pé — atravessa várias batalhas.
- **Batalha (campo de batalha):** mapa + mobs + iniciativa. O mestre monta, conduz e **limpa** ao final para montar a próxima, sem derrubar ninguém da sessão.
- **Aliado:** personagem de um jogador. Pertence à sessão, não à batalha — sobrevive à limpeza do campo.
- **Mob:** inimigo criado pelo mestre. Pertence à batalha.
- **Template:** "modelo" de mob (bestiário da sessão) usado para gerar N mobs iguais.

## 3. Papéis e permissões
- **Mestre = quem hospeda.** É a pessoa que roda o servidor. O papel é atribuído automaticamente a quem acessa pela **própria máquina do servidor** (`localhost` / `127.0.0.1` / `::1`). Não existe escolha de papel na tela de entrada.
- **Jogadores = todos que se conectam de outra máquina.** Informam apenas o **nome**.
- **Capacidade:** 1 mestre + **até 6 jogadores** (o uso esperado é de 4 a 5; o limite é configurável por `MAX_PLAYERS`, padrão 6). Quem passar do limite recebe "sala cheia".

| Ação | Mestre | Jogador |
|---|---|---|
| Montar/limpar campo de batalha, mapa e grid | ✅ | ❌ |
| Criar templates e mobs | ✅ | ❌ |
| Ver e alterar vida dos mobs | ✅ | ❌ (não recebe HP de mob) |
| Remover mob | ✅ | ❌ |
| Mover tokens | todos | só o próprio |
| Criar o próprio aliado | ✅ | ✅ |
| Alterar vida / slots / magias de aliado | todos | só o próprio (controle total) |
| Controlar iniciativa e turnos | ✅ | rola/informa a própria iniciativa |
| Rolar dados | ✅ (pode rolar oculto) | ✅ |

Permissões são **validadas no servidor**; o estado enviado a cada cliente é **filtrado pelo papel**.

## 4. Modelo de dados (em memória, no servidor)
```ts
type State = {
  players: { id; name; role: "gm" | "player"; connected: boolean }[];
  templates: { id; name; hpMax; dexMod; avatar?; notes? }[];
  allies: Combatant[];                 // da sessão
  battle: {
    map: { image: string | null; showGrid: boolean; cellPx: number;
           offsetX: number; offsetY: number; feetPerCell: 5 };
    mobs: Combatant[];                 // da batalha
    combat: { active: boolean; round: number; turnIndex: number; order: string[] };
  };
  log: { ts; author; text; hidden?: boolean }[];
};

type Combatant = {
  id; name; type: "ally" | "mob";
  ownerId?: string;                    // jogador dono (aliado)
  templateId?: string;
  hp: number; hpMax: number;           // vida é só um número
  dexMod: number;                      // usado só na iniciativa
  avatar?: string; color: string;
  pos: { col: number; row: number } | null;
  initiative: number | null; initRoll: number | null;
  spellSlots?: Record<1|2|3|4|5|6|7|8|9, { max: number; used: number }>; // aliado
  spells?: { name: string; level: number; note?: string }[];             // aliado
};
```

## 5. Funcionalidades

### F1 — Sessão e conexão
- Mestre roda o servidor (`npm start`). O servidor **abre o navegador do mestre em `http://localhost:3000`** e mostra no console os endereços para os jogadores (IPs da LAN e da VPN, ex.: `http://100.x.x.x:3000`).
- Jogadores acessam pelo endereço do mestre (LAN ou VPN).
- O papel vem da origem da conexão: loopback → mestre; qualquer outra → jogador. Entrada pede só o nome.
- Lista de conectados visível (mestre destacado, jogadores com status online/offline).
- **Reconexão:** o cliente guarda um `sessionToken` no `localStorage`; ao recarregar a página ou cair a conexão, volta como o mesmo jogador e com o mesmo personagem.

### F2 — Mobs (mestre)
- **Templates:** nome, HP máx, mod DES, avatar, notas.
- **"Adicionar à batalha" com quantidade N** → "Goblin 1"…"Goblin N", HP cheio. Mob avulso também possível.
- **Vida:** campo numérico editável + botões **− (dano)** e **+ (cura)** com um campo de valor. O mestre calcula o dano; o sistema só subtrai/soma.
- HP chegou a 0 → token fica marcado como abatido (cinza/✕) **apenas para o mestre**; o sistema **não remove sozinho**.
- **Remover mob:** botão do mestre → sai do mapa, da iniciativa e da lista. Confirmação simples ou "Desfazer" por alguns segundos.

### F3 — Aliados (jogadores)
O jogador é **dono e único gestor** do estado do próprio personagem. O sistema não pede aprovação do mestre nem valida nada: o que o jogador define é o que vale (a mesa confia na ficha).

- Jogador cria o próprio personagem: nome, HP máx, mod DES, avatar. **Tudo editável a qualquer momento** (inclusive HP máx e slots máximos — subiu de nível, muda ali).
- **Vida:** −/+ e edição direta do número.
  - Botão **"Vida cheia"** → `hp = hpMax`.
- HP 0 → aparece como "caído" (só visual); continua na iniciativa.
- **Slots de magia:** níveis 1–9, `max` editável e checkboxes de usados.
  - Marcar/desmarcar qualquer slot livremente (gastar ou recuperar um slot específico).
  - Botão **"Recuperar slots"** → zera os usados de todos os níveis.
- Botão **"Restaurar tudo"** → vida cheia + todos os slots recuperados (equivale a um descanso longo, mas o app não impõe a regra — é decisão do jogador).
- Como aliados pertencem à **sessão**, vida e slots atravessam as batalhas até o próprio jogador restaurar.
- **Lista de magias:** lista livre (nome, nível, nota), só referência.
- Atributos e o restante do personagem ficam na **ficha manual**, fora do app.

### F4 — Mapa, grid e tokens
- Mestre faz upload da imagem do mapa (PNG/JPG/WebP). Sem imagem → fundo liso.
- **Grid** opcional (mostrar/ocultar), com escala **1 quadrado = 5 pés**.
- **Calibração:** mestre ajusta tamanho da célula e offset (sliders) ou arrasta um retângulo sobre 1 quadrado (ou N quadrados informando N) e o app calcula a escala.
- Zoom (scroll) e pan.
- **Tokens:** avatar circular (upload redimensionado no cliente para ~128px) ou círculo colorido com iniciais. Borda diferencia aliado/mob; token do turno atual destacado.
- **Movimento livre:** arrastar com snap no grid e sincronizar. **Sem limite nem contagem de deslocamento** — cada um respeita a própria ficha.
- **Régua (só medição, sem validação):** clicar e arrastar mostra a distância em pés para todos; serve para conferir alcance de magia/ataque e quanto andou. Diagonal pela regra padrão do 5e (5 pés).

### F5 — Iniciativa e turnos
- Iniciativa = **d20 + mod DES**.
- Mestre: "Rolar iniciativa dos mobs" (opção de uma rolagem por template).
- Jogador: "Rolar" no próprio personagem **ou** digita o valor (dado físico).
- Ordem: total desc → empate por mod DES desc → empate restante por ordem manual (arrastar).
- **Iniciar combate** (round 1) → **Próximo / Anterior** turno; virar o último incrementa o round.
- Mob/aliado que entra no meio do combate é inserido na posição certa sem resetar o turno. Mob removido sai da ordem.

### F6 — Dados
- Botões **d4, d6, d8, d10, d12, d20, d100**, com quantidade e modificador.
- Expressão livre: `1d20+5`, `2d6+1d4+3`.
- **Vantagem / Desvantagem** no d20.
- Mostra cada dado + total; destaque para 20 e 1 naturais.
- Rolagem feita no servidor; **log compartilhado** com autor e horário; mestre pode rolar oculto.

### F7 — Ciclo da batalha (encerrar e limpar)
- **Encerrar combate:** para a iniciativa (zera round/ordem), mantém mapa e mobs — útil se a luta "pausa".
- **Limpar campo de batalha** (mestre, com confirmação):
  - **Remove:** imagem do mapa, todos os mobs, iniciativa, posições dos tokens no mapa.
  - **Mantém:** jogadores conectados, aliados com vida/slots/magias atuais, configuração do grid, log de dados.
  - Checkbox **"Manter bestiário (templates)"** — marcado por padrão, para reaproveitar mobs na próxima luta.
- Após limpar, o mestre já pode subir novo mapa e novos mobs; aliados reaparecem no mapa quando posicionados de novo.

## 6. Eventos Socket.IO
Cliente → servidor:
`session:join {name, sessionToken?}` (papel definido pelo servidor),
`battle:setMap {image | null}`, `battle:grid {showGrid?, cellPx?, offsetX?, offsetY?}`, `battle:clear {keepTemplates}`,
`template:upsert|remove`, `mob:addFromTemplate {templateId, qty}`, `mob:add`, `mob:remove`, `mob:restore`,
`ally:create`, `ally:remove`, `combatant:update {id, ...campos}`, `hp:change {id, delta}`, `hp:set {id, value}`, `hp:full {id}`,
`token:move {id, pos}`, `ruler:update` (efêmero),
`slot:set {id, level, used|max}`, `slots:restore {id}`, `ally:restoreAll {id}`, `spell:add|remove`,
`init:roll {id}`, `init:rollMobs {grouped?}`, `init:set {id, value | null}`, `init:move {id, toIndex}`, `combat:start|next|prev|end`,
`dice:roll {expr, mode?: "adv"|"dis", hidden?}`.

Toda ação responde por ack com `{ ok: true, ids? }` ou `{ ok: false, error }` (mensagem pronta para o usuário).

Servidor → cliente:
`state:full` (filtrado por papel), `map:image` (só quando a imagem muda), `ruler:update`, `toast`, `error`.

## 7. Layout
```
┌──────────────┬─────────────────────────────┬──────────────┐
│ Iniciativa   │                             │ Selecionado  │
│ round/turno  │            MAPA             │ vida −/+     │
│ [◀] [▶]      │      (tokens + régua)       │ slots/magias │
├──────────────┤                             ├──────────────┤
│ Bestiário/   │                             │ Dados + log  │
│ Mobs (mestre)│                             │              │
│ Aliados      │                             │              │
└──────────────┴─────────────────────────────┴──────────────┘
[Encerrar combate] [Limpar campo de batalha]  ← barra do mestre
```

---

## 8. ADRs

### ADR-01 — Topologia: mestre como host (cliente-servidor)
- **Contexto:** sem servidor dedicado; várias máquinas precisam ver o mesmo estado.
- **Decisão:** a máquina do mestre roda o servidor Node, que é a **fonte da verdade**. Jogadores acessam pelo navegador.
- **Alternativas:** P2P com réplicas em cada máquina (exige resolução de conflitos); WebRTC/PeerJS (depende de servidor de sinalização de terceiros e sofre com NAT).
- **Consequências:** jogador não instala nada; sem conflitos de estado. Se o PC do mestre cair, a sessão acaba — aceitável sem persistência.

### ADR-02 — Conectividade remota via VPN mesh
- **Decisão:** usar **Tailscale** (alternativas: ZeroTier, Radmin VPN) quando os jogadores não estão na mesma rede. Na LAN, IP local.
- **Alternativas:** port forwarding (frágil com CGNAT/firewall, expõe porta na internet); túneis públicos tipo ngrok (dependem de serviço externo).
- **Consequências:** zero código de rede extra; cada participante instala a VPN uma vez. Firewall do Windows do mestre precisa liberar a porta 3000.

### ADR-03 — Stack: TypeScript, Node + Express + Socket.IO, Vite + React
- **Decisão:** monorepo TS com `/shared` (tipos e eventos), `/server`, `/client`. Express serve o build do client em produção; em dev, Vite com proxy.
- **Alternativas:** JS puro (descartado por preferência do time); Next.js (overkill, SSR desnecessário); `ws` puro (Socket.IO já entrega reconexão, rooms e acks).
- **Consequências:** tipos compartilhados evitam divergência entre eventos do front e do back. Comando único para o mestre: `npm run build && npm start`.

### ADR-04 — Estado em memória, sem persistência
- **Decisão:** um objeto `State` em memória no servidor.
- **Consequências:** simples e rápido; reiniciar o servidor zera tudo (comportamento esperado). Export/import JSON fica como extensão futura, se quiserem.

### ADR-05 — Sincronização por estado completo filtrado por papel
- **Decisão:** após cada ação, o servidor envia `state:full` para cada cliente, **filtrado por papel** (jogador não recebe HP de mob). Imagens grandes (mapa) vão em evento separado só quando mudam; avatares são reduzidos a ~128px no cliente.
- **Alternativas:** patches/diffs (mais eficiente, mais complexo e propenso a dessync).
- **Consequências:** estado é pequeno (dezenas de combatentes), então o custo é irrelevante e a lógica fica trivial. Rever só se surgir lentidão.

### ADR-06 — Sistema como registro, sem motor de regras
- **Decisão:** o app **não calcula** dano, cura, deslocamento, alcance nem morte. Ele só soma/subtrai os valores informados e mede distâncias na régua.
- **Motivo:** cada validação de regra é um ponto de falha e de discussão; a mesa já resolve isso pelas fichas.
- **Consequências:** movimento livre; mob com 0 HP só é marcado, a remoção é ação explícita do mestre. Jogadores gerenciam livremente a própria vida e slots (incluindo restaurar tudo), sem aprovação nem regra de descanso no sistema.

### ADR-07 — Rolagem de dados no servidor
- **Decisão:** toda rolagem acontece no servidor (`crypto.randomInt`) e é publicada no log.
- **Consequências:** um resultado único e confiável para todos; rolagem oculta do mestre é só um filtro de envio.

### ADR-08 — Mapa com Konva (react-konva)
- **Decisão:** renderizar mapa, grid, tokens e régua com Konva.
- **Alternativas:** Canvas 2D puro (mais código para drag/zoom/hit-test); DOM/SVG (pior desempenho com imagem grande + muitos tokens).
- **Consequências:** drag, zoom e camadas prontos; integração natural com React.

### ADR-09 — Identidade sem autenticação; mestre definido por ser o host
- **Decisão:** o papel de mestre é dado a conexões **loopback** (mesma máquina do servidor); todas as demais são jogadores. Entrada só com nome; `sessionToken` aleatório no `localStorage` para reconexão.
- **Alternativas:** escolher papel na tela (qualquer um poderia virar mestre); senha/chave de mestre (atrito desnecessário).
- **Consequências:** zero atrito e impossível "roubar" o papel de mestre de outra máquina. O mestre **precisa** acessar por `localhost` — se abrir pelo IP da VPN na própria máquina, entra como jogador (o servidor já abre o navegador no endereço certo). Confiança entre amigos é premissa.

### ADR-10 — Capacidade: 1 mestre + até 6 jogadores
- **Decisão:** limite padrão de 6 jogadores (configurável), dimensionado para o uso esperado de 4–5.
- **Consequências:** com ~7 clientes e estado de poucos KB, broadcast de estado completo (ADR-05) é trivial; o único payload pesado é a imagem do mapa, enviada uma vez por cliente. Recomendação no README: mapas até ~5 MB (o client redimensiona/comprime imagens maiores antes do upload).

---

## 9. Entregáveis

Estimativa total: **~2 a 3 semanas** para 1 dev em ritmo normal.

### E1 — Fundação e sessão  *(~2–3 dias)*
Monorepo TS (shared/server/client), Express + Socket.IO + Vite/React, papel por origem da conexão (loopback = mestre), entrada só com nome, limite de jogadores, lista de conectados, reconexão por `sessionToken`, filtro de estado por papel, validação de permissões no servidor, endereços de acesso impressos no console.

**Pronto quando:**
- `npm run build && npm start` sobe tudo na porta 3000, abre o navegador do mestre e lista os endereços para os jogadores.
- Quem acessa por `localhost` é mestre; quem acessa de outra máquina é jogador, sem opção de escolher.
- Mestre + 5 jogadores em máquinas diferentes (LAN **e** via Tailscale) entram simultaneamente e veem a lista de conectados.
- O 7º jogador recebe "sala cheia" (com limite padrão 6).
- Recarregar a página mantém o jogador com a mesma identidade e personagem.

### E2 — Combatentes e vida  *(~2–3 dias)*
Templates, adicionar N mobs, mob avulso, aliados, −/+ e edição direta de vida, marcação de 0 HP, remoção manual de mob com desfazer.

**Pronto quando:**
- Template "Goblin" × 4 gera Goblin 1–4 com HP cheio.
- Mestre altera vida de mob; jogador **não recebe** HP de mob em nenhum payload (conferido no DevTools).
- Jogador altera a vida do próprio aliado e não consegue alterar a de outro (rejeitado pelo servidor).
- "Vida cheia" leva o HP ao máximo; jogador edita o próprio HP máx livremente.
- Mob com 0 HP fica marcado e só sai quando o mestre remove; desfazer restaura.

### E3 — Dados  *(~1–2 dias)*
Botões d4–d100 com quantidade e modificador, expressão livre, vantagem/desvantagem, log compartilhado, rolagem oculta do mestre.

**Pronto quando:**
- `2d6+1d4+3` mostra cada dado e o total correto.
- Vantagem rola 2d20 e usa o maior; desvantagem, o menor.
- Rolagem aparece no log de todos com autor e horário; rolagem oculta aparece só para o mestre.

### E4 — Mapa e tokens  *(~3–4 dias)*
Upload de mapa, grid opcional, calibração, zoom/pan, upload de avatar, tokens com drag + snap, permissões de movimento, régua sincronizada.

**Pronto quando:**
- Mestre sobe um mapa e ele aparece para todos.
- Calibrando sobre um quadrado do mapa, o grid se alinha à imagem.
- Jogador arrasta só o próprio token; o movimento aparece nos outros em < 1 s.
- Régua sobre 6 quadrados em linha reta mostra 30 pés, visível para todos.
- Token sem avatar mostra iniciais; aliado e mob são distinguíveis.

### E5 — Iniciativa e turnos  *(~2 dias)*
Rolagem (mobs em lote, opção por template), valor manual, ordenação e desempate, reordenação manual, iniciar/próximo/anterior/encerrar, rounds, entrada no meio do combate, destaque do turno no mapa e na lista.

**Pronto quando:**
- Ordem respeita total e desempata por mod DES.
- Virar o último turno incrementa o round.
- Mob adicionado no meio do combate entra na posição correta sem mudar o turno atual; mob removido sai da ordem.
- Token do turno atual fica destacado para todos.

### E6 — Magias  *(~1–2 dias)*
Slots 1–9 com máximo e usados, recuperar slots, restaurar tudo, lista de magias de referência.

**Pronto quando:**
- Jogador define slots máximos e marca/desmarca usados livremente; todos veem a atualização.
- "Recuperar slots" zera os usados de todos os níveis.
- "Restaurar tudo" deixa vida cheia e todos os slots disponíveis num clique.
- Vida e slots se mantêm após "Limpar campo de batalha" até o jogador restaurar.
- Magias podem ser adicionadas/removidas e aparecem para o dono e o mestre.

### E7 — Ciclo da batalha e acabamento  *(~1–2 dias)*
Encerrar combate, limpar campo de batalha (com opção de manter bestiário), confirmação, ajustes de layout e usabilidade, README de como rodar (incluindo Tailscale e liberação de porta no firewall).

**Pronto quando:**
- "Limpar campo" remove mapa, mobs, iniciativa e posições; jogadores **continuam conectados** e aliados mantêm vida/slots/magias.
- Com "manter bestiário" marcado, templates continuam disponíveis; desmarcado, somem.
- Logo em seguida o mestre monta uma nova batalha (novo mapa + mobs) sem reiniciar nada.
- README permite a outra pessoa rodar o servidor do zero.

### Definição de pronto (vale para todos)
- Funciona com 1 mestre + 5 jogadores simultâneos em máquinas diferentes, com atualizações chegando em < 1 s.
- Permissões validadas no servidor, não só escondidas na UI.
- Sem erros no console em uso normal.
- Tipos de eventos definidos em `/shared`.

## 10. Em aberto
- ~~Iniciativa em grupo por template~~ — decidido no E5: opção no painel, desligada por padrão.
- Jogadores veem algum indicador vago do estado do mob ("ferido") ou nada? — **hoje: nada** (só o ✕ é do mestre). Fácil de adicionar se a mesa quiser.
- Tokens maiores que 1 quadrado (Grande 2×2) — **ficou para depois**.
- ~~Limpar campo também limpa o log de dados?~~ — decidido no E7: **não**, o log continua.

---

# Fase 2 — Distribuição

Objetivo: quem desenvolve gera os pacotes; **quem mestra só baixa e dá dois cliques**. Nada de instalar Node, rodar `npm` ou abrir terminal. A conectividade remota continua sendo a VPN (ADR-02): o executável sobe o servidor, não a rede.

## 11. Fluxo de versionamento

- `master` = sempre jogável. O estado atual (E1–E7) entra direto na `master` e recebe a tag **`v1.0.0`**.
- Daqui pra frente: uma branch por entregável (`feat/e8-preparacao`, `feat/e9-docker`…), merge na `master` via PR.
- Versões em **semver**: `vMAJOR.MINOR.PATCH`. Cada tag na `master` gera uma release (E11).

## 12. ADRs da Fase 2

### ADR-11 — Executável com Node SEA (Single Executable Application)
- **Contexto:** o mestre não deve precisar de Node nem de terminal. O app já é um servidor Node que serve o front; o mestre usa o navegador.
- **Decisão:** gerar um executável único com o recurso oficial **Node SEA**: o servidor vira um único arquivo JS (esbuild), o client compilado vai embutido como asset, e tudo é injetado num binário do Node. Duplo clique → abre uma janela de console com os endereços e o navegador do mestre em `localhost`.
- **Alternativas:**
  - **Tauri:** é ótimo para apps com janela nativa, mas o backend é Rust. Rodar nosso servidor exigiria empacotar o Node como *sidecar* (ou seja, fazer o SEA de qualquer jeito) e ainda trazer a toolchain Rust. Só compensa se quisermos uma janela própria (ver E12).
  - **Electron:** roda Node nativamente, mas o pacote é pesado (~150 MB+) e a janela é desnecessária — o mestre já usa o navegador.
  - **`bun build --compile`:** gera executável e faz cross-compile fácil, mas troca o runtime (Bun) sob Express/Socket.IO — risco de comportamento diferente do que testamos.
  - **`pkg`/`nexe`:** descontinuados ou pouco mantidos.
- **Consequências:** ~80–100 MB por executável (é o próprio Node dentro). Um build por sistema (Windows, Linux, macOS), feito na CI. Executável sem assinatura digital → o Windows SmartScreen mostra "Fornecedor desconhecido" na primeira vez (documentar "Mais informações → Executar assim mesmo"; assinatura fica como evolução).

### ADR-12 — Chave de mestre como alternativa ao loopback
- **Contexto:** o mestre é identificado por acessar via `localhost` (ADR-09). Dentro do **Docker**, as conexões chegam pelo gateway da rede do container (ex.: `172.17.0.1`), não por loopback — ninguém seria mestre (ou, com proxy, todos).
- **Decisão:** manter o loopback como regra padrão e adicionar uma **chave de mestre**: o servidor gera uma chave aleatória a cada execução (ou usa `GM_KEY` do ambiente) e mostra no console um link `http://localhost:3000/?gm=<chave>`. Quem entra com a chave válida é mestre. Em container, o loopback é desligado (`GM_LOOPBACK=0`) e só a chave vale.
- **Consequências:** o fluxo do executável não muda (localhost continua funcionando). No Docker, o mestre usa o link com a chave mostrado em `docker logs`. A chave fica guardada no `localStorage` do mestre para reconexão.

### ADR-13 — Docker como forma secundária de rodar
- **Decisão:** imagem Docker oficial publicada no GitHub Container Registry (GHCR), para quem já tem Docker ou um servidor em casa. O executável continua sendo o caminho principal para o mestre comum.
- **Consequências:** dentro do container o servidor não sabe o IP da máquina host nem da VPN; os endereços de convite vêm da variável `PUBLIC_URLS` (ou o painel mostra uma instrução no lugar). Exige ADR-12.

### ADR-14 — CI/CD no GitHub Actions
- **Decisão:** PRs rodam typecheck, testes e build. Tags `v*` na `master` geram a release: executáveis (Windows, Linux, macOS) anexados à GitHub Release e imagem Docker publicada no GHCR com as tags `vX.Y.Z` e `latest`.
- **Consequências:** ninguém compila na própria máquina para distribuir; o link da release é o que se manda pro mestre.

## 13. Entregáveis da Fase 2

Estimativa total: **~1 a 1,5 semana** para 1 dev.

### E8 — Preparação para distribuição  *(~1–2 dias)*
Ajustes no código que o Docker e o executável precisam.
- `version` no `package.json` (1.0.0) exibida na UI (rodapé/tela de entrada) e no console.
- **Chave de mestre** (ADR-12): geração/`GM_KEY`, link no console, `?gm=` na entrada, guardada no `localStorage`; flag `GM_LOOPBACK`.
- Configuração única por variáveis de ambiente **e** argumentos (`--port`, `--max-players`, `--no-open`).
- **Porta ocupada:** em vez de encerrar, tenta a próxima livre (3001, 3002…) e avisa qual usou.
- `PUBLIC_URLS` para sobrescrever os endereços de convite.
- `GET /healthz` (para o healthcheck do Docker).
- Encerramento limpo (`Ctrl+C`/`SIGTERM` fecha sockets e sai).
- Build do servidor com **esbuild** num único arquivo (`dist/server.cjs`), sem depender do `tsx` em produção.

**Pronto quando:**
- `node dist/server.cjs` sobe o app completo sem `node_modules` do servidor.
- Abrir `/?gm=<chave>` de outra máquina entra como mestre; chave errada entra como jogador.
- Com a 3000 ocupada, o app sobe na 3001 e mostra os endereços certos.
- Testes antigos + novos (chave de mestre, porta, healthz) passando.

### E9 — Imagem Docker  *(~1 dia)*
- `Dockerfile` multi-stage: estágio de build (instala, testa, compila client + bundle do servidor) e estágio final mínimo (`node:22-alpine`, só `server.cjs` + client), rodando como usuário não-root.
- `.dockerignore`, `HEALTHCHECK` usando `/healthz`, `GM_LOOPBACK=0` por padrão na imagem.
- `docker-compose.yml` de exemplo com porta, `GM_KEY` e `PUBLIC_URLS`.
- Seção no README: rodar com Docker, achar o link do mestre nos logs.

**Pronto quando:**
- `docker build` gera imagem < 200 MB e `docker run -p 3000:3000` sobe o app.
- Mestre entra pelo link com chave; jogadores de outra máquina entram pela LAN/VPN.
- Container fica "healthy" e para em < 5 s com `docker stop`.

### E10 — Executável  *(~2 dias)*
- Script `npm run package` que gera, via Node SEA (ADR-11), `simulador-encontros-<versao>-win-x64.exe` (e `linux-x64`, `macos-arm64`).
- Client compilado embutido no executável (servido da memória, sem pasta extra).
- Ao abrir: janela de console com nome/versão, endereços para os jogadores, link do mestre e "feche esta janela para encerrar a sessão"; navegador do mestre abre sozinho.
- Ícone e metadados do executável no Windows (nome, versão).
- README: "Para quem vai mestrar" — baixar, dois cliques, aviso do SmartScreen, liberar firewall, Tailscale.

**Pronto quando:**
- Numa máquina Windows **sem Node instalado**, dois cliques no `.exe` sobem a sessão e o navegador abre como mestre.
- Jogadores em outra máquina (LAN e Tailscale) conectam normalmente.
- Fechar a janela encerra o servidor.
- Executável ≤ 150 MB. (Revisto no E11: o Windows fica em ~93 MB, mas o executável Linux deu 123 MB — ~120 MB são o próprio binário do Node para Linux; o app soma só ~3 MB.)

### E11 — CI/CD e releases  *(~1 dia)*
- Workflow de **PR**: `npm ci`, typecheck, testes, build.
- Workflow de **release** (tag `v*`): matriz Windows/Linux/macOS gerando os executáveis → anexados à GitHub Release com notas; build e push da imagem para `ghcr.io/<usuario>/<repo>` com tags `vX.Y.Z` e `latest`.
- `CHANGELOG.md` e proteção da `master` (merge só com CI verde).

**Pronto quando:**
- Abrir um PR mostra o check verde/vermelho.
- Criar a tag `v1.1.0` produz a release com os 3 executáveis e a imagem no GHCR, sem nenhum passo manual.

### E12 — (Opcional) Launcher com janela própria
Só se a janela de console incomodar: um launcher com botão iniciar/parar, endereços com "copiar", QR code para o celular e ícone na bandeja. Candidatos: Tauri com o executável do E10 como *sidecar*, ou uma página local servida pelo próprio app. Decidir depois de usar o E10 em sessões reais.

### Ordem sugerida
`E8 → E9 → E10 → E11`. O E8 destrava os outros dois; E9 e E10 são independentes entre si; o E11 automatiza o que E9 e E10 já fazem à mão.

---

# Fase 3 — Refinamento, UX e novas features

Objetivo: depois das primeiras sessões reais, corrigir o que incomodou, padronizar a interface e adicionar o que a mesa pediu. O app continua sendo um **registro, não um motor de regras** (ADR-06): nada abaixo calcula dano, acerto ou efeito de condição.

## 14. Decisões da Fase 3

### ADR-15 — Mantine como biblioteca de componentes
- **Contexto:** a interface foi feita com CSS próprio; textos vazam dos painéis, faltam tooltips e cada painel tem um jeito. Antes de adicionar mais telas (NPCs, condições, dados, mapa), é preciso uma base comum.
- **Decisão:** adotar **Mantine** (componentes + tema) com tokens próprios: tema escuro, cor de destaque dourada atual, escala de espaçamento em múltiplos de 4 px, escala tipográfica 12/14/16/20/24, **Inter** para interface e uma fonte de fantasia (ex.: Cinzel) **só em títulos**.
- **Alternativas:** MUI (completa, mas visual Material difícil de descaracterizar e mais pesada de customizar); shadcn/ui (Radix + Tailwind, máximo controle, mais montagem).
- **Consequências:** o E14 migra os componentes existentes; os entregáveis seguintes já nascem com Mantine. O mapa continua em Konva (fora do Mantine).

### ADR-16 — Nome do produto: Jamal's Tabletop
- **Decisão:** o app passa a se chamar **Jamal's Tabletop** na interface, no console, no executável (nome do arquivo e metadados) e na documentação. O **repositório** (`RpgTabletop`) e, por consequência, a **imagem** `ghcr.io/jorgemombach/rpgtabletop` mantêm o nome.
- **Consequências:** executáveis passam a `jamals-tabletop-<versão>-<sistema>-<arch>`; os padrões de arquivo da CI/release (`simulador-encontros-*`) mudam junto. O fabricante nos metadados do `.exe` passa a ser **Jorge Mombach**. O aviso do SmartScreen continua "desconhecido" sem assinatura digital (ver §16).

### ADR-17 — Salvar/carregar por arquivo (evolução do ADR-04)
- **Contexto:** ao fechar o app tudo se perde; a mesa quer continuar na próxima sessão.
- **Decisão:** continua **sem persistência automática**. O mestre exporta a sessão para um **arquivo JSON** quando quiser e importa ao abrir a próxima. O servidor não grava nada em disco por conta própria.
- **Consequências:** o arquivo tem uma versão de formato, para importar arquivos de versões anteriores; importar substitui o estado atual (com confirmação).

### Regras definidas para as novas features
- **NPCs neutros:** terceiro tipo de combatente. Só o mestre cria, move e controla; **jogadores não veem a vida** (como mobs). Podem entrar na iniciativa.
- **Condições:** qualquer combatente pode ter condições (concentração, atordoado, caído…), com **duração opcional em rounds**, que **desconta 1 no início do turno de quem tem a condição**; ao chegar a 0, ela sai e aparece um aviso. Sem duração = fica até alguém tirar. O app não aplica efeito nenhum (ADR-06).
- **Dados no combate:** com combate ativo, **jogador só rola na própria vez**; o mestre rola sempre e a rolagem fica **atribuída ao mob/NPC da vez** ("Goblin 2"), não ao nome do mestre. Fora de combate, todos rolam livremente.

## 15. Entregáveis da Fase 3

Ordem: **E13 → E14 → (E15, E16, E17 em qualquer ordem) → E18 → E12**. O E14 vem antes das features de interface para elas não serem feitas duas vezes.

### E13 — Correções e identidade
- **Bug:** slider de deslocamento X/Y no final volta o grid ao início (o valor máximo é igual ao tamanho do quadrado, que o servidor normaliza para 0). O slider deve ir só até um passo antes.
- **Bug:** contorno de seleção/turno **deslocado** nos tokens de inimigo (parece borda maior). Causa: o contorno é feito aumentando a forma; o círculo dos aliados cresce a partir do centro, mas o quadrado dos mobs cresce a partir do canto superior esquerdo. Desenhar o contorno com posição e tamanho calculados.
- **Bug:** textos e botões cortados nos painéis (ex.: iniciativa — "🎲 Rolar" e "Iniciar combate" cortados, texto do checkbox vazando). Causa: linhas com mais itens do que cabem nos ~280 px da coluna, que corta o excesso. Linhas compactas (🎲 só ícone com tooltip, campo estreito), botões que quebram linha e reticências em textos longos.
- Tooltips em toda abreviação (DES, ft, PV, d20, níveis de slot…).
- **Jogador cria só 1 personagem** (validado no servidor); o mestre continua criando aliados NPC à vontade.
- Botão **Editar** do personagem visível (já existe, mas está escondido): nome, vida máx., mod. DES, cor, avatar.
- Botão **Sair / trocar nome** (hoje o navegador lembra o nome e entra sozinho).
- Renomear para **Jamal's Tabletop** (ADR-16) e fabricante "Jorge Mombach" nos metadados do `.exe`.
- Documentação do que faltou na primeira sessão real: no aviso do Firewall do Windows a interface do **Tailscale é Privada** (marcar *Redes privadas* mesmo quando a rede de casa é Pública); o convidado precisa **trocar para a rede do mestre** no aplicativo do Tailscale; sintoma "fica carregando infinitamente" em *Problemas comuns*.

**Pronto quando:**
- Arrastar o deslocamento até o fim não faz o grid pular; a borda de mobs e aliados tem a mesma espessura.
- Nomes de 32 caracteres e a coluna lateral mais estreita não vazam em nenhum painel.
- Toda abreviação tem tooltip.
- Segundo `ally:create` de um jogador é recusado com mensagem clara (teste no servidor).
- Nome "Jamal's Tabletop" em interface, título da aba, console, `--help`, executável, release e README; CI e release verdes com os novos nomes de arquivo.

### E14 — Base de UX (Mantine)
- Mantine + tema (ADR-15): cores, tipografia, espaçamentos e componentes (botões, campos numéricos, modais, tooltips, notificações) padronizados em todo o app.
- **Painéis laterais redimensionáveis** (arrastar a borda), lembrando a largura por navegador.
- **Tela de entrada com arte** (imagem de fundo/ilustração com o nome do app).
- Guia curto de padrões de UI no `CLAUDE.md` (quais componentes usar para quê).

**Pronto quando:**
- Nenhum componente visual fora do tema (sem botões/campos "soltos" com CSS próprio).
- Painéis redimensionam entre um mínimo e um máximo sem quebrar o layout.
- Funciona em 1280 px e em janelas estreitas (≥ 1024 px) sem vazamento.

### E15 — NPCs neutros e condições
- Seção **NPCs** (mestre): criar avulso ou a partir do bestiário, vida, token com estilo próprio (nem círculo de aliado, nem quadrado de mob), entrada na iniciativa.
- **Condições** em qualquer combatente: lista de condições do 5e + texto livre, duração opcional em rounds, contagem regressiva no turno de quem tem (§14), aviso ao expirar. Aparecem no painel *Selecionado*, na iniciativa e como ícone/etiqueta no token.

**Pronto quando:**
- Jogador vê NPCs no mapa e na iniciativa, mas não recebe a vida deles (teste no servidor).
- "Atordoado (2)" passa a 1 e depois some nos turnos do combatente; condições sem duração não mudam.
- Limpar o campo remove NPCs (como mobs) e as condições dos que saem.

### E16 — Dados no combate
- **Trava por turno** (§14): com combate ativo, jogador fora da vez não rola (botões desabilitados + recusa no servidor); mestre rola sempre.
- **"Rolar como"**: rolagens do mestre ficam atribuídas ao combatente da vez (mob/NPC); o mestre pode trocar para outro ou para "Mestre".
- **Ataque e dano separados**: dois blocos na tela — *Ataque* (d20 + modificador, vantagem/desvantagem) e *Dano* (expressão) — e o log agrupa as rolagens por turno ("Goblin 2 — Ataque 17 · Dano 6").
- "Rolar iniciativa de novo para todos" (regra opcional de algumas mesas).

**Pronto quando:**
- Jogador fora da vez recebe recusa do servidor ao tentar rolar (teste) e vê o motivo na tela.
- Rolagem do mestre no turno do "Goblin 2" aparece no log como "Goblin 2".
- Ataque e dano de um mesmo turno aparecem juntos no log.

**Em aberto:** testes de resistência e reações acontecem **fora da vez** do jogador. Definir no E16 como permitir (ex.: o mestre pede "todos rolam resistência de DES" e libera a rolagem por alguns segundos, ou libera um jogador específico).

### E17 — Mapa: rotação, escala e áreas de magia
- **Rotacionar** a imagem do mapa em passos de 90°.
- **Redimensionar** a imagem (escala) independentemente do grid.
- **Formas de área** junto da régua, visíveis para todos como ela: **cone, esfera/círculo (raio), cilindro, linha e cubo** (as formas do D&D 5e), com tamanho em pés.

**Pronto quando:**
- Mapa girado 90° mantém o grid alinhado após recalibrar; escala muda o tamanho da imagem sem mexer nos tokens.
- Cone de 15 ft, esfera de 20 ft, linha de 30 ft e cubo de 10 ft aparecem com o tamanho certo no grid para todos.

### E18 — Salvar e carregar sessão
- **Exportar** (mestre): baixa um `.json` com personagens, bestiário, mobs/NPCs, mapa (imagem inclusa), grid, condições e log.
- **Importar** (mestre): carrega um arquivo, valida, mostra o resumo e substitui o estado atual após confirmação. Jogadores reconectam e reencontram os personagens (ligados pelo nome).

**Pronto quando:**
- Exportar → fechar o app → abrir → importar recupera o estado completo.
- Arquivo inválido ou de formato futuro é recusado com mensagem clara (teste).

### E12 — Launcher com janela própria (reavaliado)
Mantido como último da fila: janela com o nome/arte do app, botão iniciar/parar, endereços com copiar, QR code para o celular. Reavaliar depois do E14 (a arte da tela de entrada pode ser reaproveitada).

## 16. Fora do código (configuração e conhecimento)

- **Assinatura do executável:** sem certificado, o SmartScreen sempre mostra "Editor desconhecido"; os metadados do arquivo não mudam isso. Caminhos possíveis: **SignPath Foundation** (gratuito para projetos open source; exige licença open source no repositório) ou assinatura paga (ex.: Microsoft Trusted Signing). Mesmo assinado, o aviso só some com reputação de downloads.
- **Proteção do repositório público:** ruleset da `master` com *Require approvals: 1*, bypass só para **Repository admin** no modo *For pull requests only*; em *Settings → Actions*, exigir aprovação para workflows de PRs de contribuidores externos. Só o dono faz merge.
- **Aleatoriedade dos dados:** `crypto.randomInt` do Node no servidor (gerador criptográfico, uniforme), sem biblioteca externa (ADR-07).
