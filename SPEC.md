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
           offsetX: number; offsetY: number; feetPerCell: 5;
           rotation: 0 | 90 | 180 | 270; imageScale: number }; // E17: só a imagem gira/escala
    mobs: Combatant[];                 // da batalha
    npcs: Combatant[];                 // da batalha, neutros (E15)
    effects: MapEffect[];              // E19: { name, preset, color, area, ownerId, casterId, rounds, concentration, active }
    combat: { active: boolean; round: number; turnIndex: number; order: string[] };
  };
  log: { ts; author; text; hidden?: boolean; system?: boolean }[]; // system = aviso da mesa (E15)
};

type Combatant = {
  id; name; type: "ally" | "mob" | "npc";
  ownerId?: string;                    // jogador dono (aliado)
  templateId?: string;
  hp: number; hpMax: number;           // vida é só um número
  dexMod: number;                      // usado só na iniciativa
  avatar?: string; color: string;
  pos: { col: number; row: number } | null;
  initiative: number | null; initRoll: number | null;
  spellSlots?: Record<1|2|3|4|5|6|7|8|9, { max: number; used: number }>; // aliado
  spells?: { name: string; level: number; note?: string }[];             // aliado
  conditions: { id; name: string; rounds: number | null }[];             // E15
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
- **Movimento livre:** arrastar com snap no grid e sincronizar. **Sem limite nem contagem de deslocamento** — cada um respeita a própria ficha. Com a regra da mesa *Movimento só na sua vez* ligada pelo mestre, em combate o jogador só move os próprios tokens na sua vez (ainda sem contar deslocamento).
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
`session:export` e `session:import {arquivo}` (mestre, E18),
`battle:setMap {image | null}`, `battle:grid {showGrid?, cellPx?, offsetX?, offsetY?}`, `battle:clear {keepTemplates}`,
`template:upsert|remove`, `mob:addFromTemplate {templateId, qty}`, `mob:add`, `mob:remove`, `mob:restore` (mob ou NPC),
`npc:add`, `npc:addFromTemplate {templateId}`, `condition:add {id, name, rounds?}`, `condition:remove {id, conditionId}`,
`effect:add {name, preset, color?, area, casterId?, rounds?, concentration?}`, `effect:toggle {id, active}`, `effect:remove {id}` (E19),
`ally:create`, `ally:remove`, `combatant:update {id, ...campos}`, `hp:change {id, delta}`, `hp:set {id, value}`, `hp:full {id}`,
`token:move {id, pos}` (recusa casa ocupada), `ruler:update` e `area:update {kind, origin, angle, feet}` (efêmeros),
`slot:set {id, level, used|max}`, `slots:restore {id}`, `ally:restoreAll {id}`, `spell:add|remove`,
`init:roll {id}`, `init:rollMobs {grouped?}`, `init:set {id, value | null}`, `init:move {id, toIndex}`, `init:rerollAll {grouped?}`, `combat:start|next|prev|end`,
`dice:roll {expr, mode?: "adv"|"dis", hidden?, asId?, kind?: "attack"|"damage", crit?}`, `roll:request {label, playerIds}`, `roll:cancel`, `reaction:use` (E16).

Toda ação responde por ack com `{ ok: true, ids? }` ou `{ ok: false, error }` (mensagem pronta para o usuário).

Servidor → cliente:
`state:full` (filtrado por papel), `map:image` (só quando a imagem muda), `ruler:update`, `area`, `toast`, `error`.

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
- **Consequências:** movimento livre (a mesa pode ligar a regra *Movimento só na sua vez*: trava **quando** mover, nunca **quanto**); mob com 0 HP só é marcado, a remoção é ação explícita do mestre. Jogadores gerenciam livremente a própria vida e slots (incluindo restaurar tudo), sem aprovação nem regra de descanso no sistema.

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

### ADR-11 — Executável com Node SEA (Single Executable Application) — *substituído pelo ADR-18 na 2.0*
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

### ADR-18 — App do mestre com Electron (substitui o ADR-11)
- **Contexto:** o mestre quer uma janela própria (E12) e, principalmente, um aviso ao fechar com **Salvar e sair** — o navegador não deixa personalizar o aviso de fechar (E18). O executável SEA abria o navegador e uma janela de console.
- **Decisão:** o app do mestre vira um **Electron**: o servidor roda dentro do processo principal (o Electron já traz o Node) e a janela mostra a mesa em `localhost`. O mesmo `startServer()` é usado pela linha de comando, pelo Docker e pelo Electron. Jogadores continuam no navegador. Empacotamento com **electron-builder**: Windows `.exe` portátil, macOS `.dmg` (arm64), Linux `.AppImage`. O SEA sai (um jeito a menos de manter); Docker continua para quem quer só o servidor.
- **Alternativas:** Tauri (janela leve, mas exige Rust na CI e o servidor como *sidecar*); Edge/Chrome em modo app (quase sem custo, mas sem aviso de fechar próprio e dependente do Chrome no Mac/Linux); manter SEA junto (CI e testes em dobro).
- **Consequências:** tamanho parecido com o SEA (~100–130 MB: hoje já embutíamos o Node inteiro). Sem assinatura digital: SmartScreen no Windows e Gatekeeper no Mac (liberar com `xattr -cr` ou *Privacidade e Segurança → Abrir Mesmo Assim*). No Windows portátil, o front vai dentro do `app.asar` e o `.exe` tem tela de abertura: o lançador extrai numa pasta fixa de `%TEMP%` e, aberto de novo, apagava os arquivos soltos da mesa em uso (corrigido na 2.0.1). Teste de fumaça da CI usa `--server-only` (sobe só o servidor, sem janela). Major version: **2.0.0**.

### Regras definidas para as novas features
- **NPCs neutros:** terceiro tipo de combatente. Só o mestre cria, move e controla; **jogadores não veem a vida** (como mobs). Podem entrar na iniciativa.
  - Detalhes (E15): lista própria (`battle.npcs`); token em hexágono; criados avulsos ou a partir de um template (um NPC, sem número no nome, na paleta de cores neutra); *Rolar mobs* rola também para os NPCs (até a 2.0; desde o E21, NPCs rolam um a um); remover tem o mesmo *Desfazer* dos mobs.
- **Condições:** qualquer combatente pode ter condições (concentração, atordoado, caído…), com **duração opcional em rounds**, que **desconta 1 no início do turno de quem tem a condição**; ao chegar a 0, ela sai e aparece um aviso. Sem duração = fica até alguém tirar. O app não aplica efeito nenhum (ADR-06).
  - Detalhes (E15): iniciar o combate conta como início do turno de quem age primeiro; *voltar turno* não devolve rounds; pôr de novo uma condição que já existe só troca a duração; condições não são segredo (jogadores veem as de mobs e NPCs); o jogador mexe só nas do próprio personagem.
- **Efeitos no mapa (E19):** áreas persistentes com duração em rounds contada no turno de quem conjurou; efeitos de concentração somem quando o conjurador perde a condição *Concentração*.
- **Dados no combate:** com combate ativo, **jogador só rola na própria vez**; o mestre rola sempre e a rolagem fica **atribuída ao mob/NPC da vez** ("Goblin 2"), não ao nome do mestre. Fora de combate, todos rolam livremente.

## 15. Entregáveis da Fase 3

Ordem: **E13 → E14 → (E15, E16, E17 em qualquer ordem) → E19 → E18 → E20 → E12 → release 2.0.0**. O E20 (identidade visual) entrou antes do launcher para ele já nascer com a cara nova. O E19 (efeitos no mapa) vem antes do E18 para o arquivo salvo já incluir os efeitos. O E14 vem antes das features de interface para elas não serem feitas duas vezes.

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

**Decidido (fora da vez e detalhes):**
- **Resistência = pedido do mestre:** *Pedir rolagem* com rótulo ("Resistência DES") para todos ou jogadores escolhidos; cada um rola **uma vez**. O pedido some quando todos rolaram, quando o mestre cancela ou quando o turno muda. Fora disso, o jogador fora da vez não rola (nem os dados livres).
- **Reação = do jogador:** botão *Reação*, **1 por round** (como no 5e), libera a rolagem até o próximo turno; o log marca "Reação".
- **Rolagens do mestre ocultas por padrão** (ele desmarca para mostrar). A rolagem oculta continua só para o mestre.
- **Crítico:** 20 natural no ataque aparece destacado ("Crítico!") e o bloco de Dano vem com *Crítico* marcado, que dobra só a quantidade de dados (2d6+3 → 4d6+3); dá para desmarcar.
- **Rolar iniciativa de novo:** zera todas as iniciativas, rola mobs/NPCs na hora; jogadores rolam ou digitam de novo.
- Modificador do ataque digitado na hora (o navegador lembra o último); sem ataques salvos. O log agrupa por turno ("Round 2 · Goblin 2"); fora de combate as rolagens ficam soltas. "Rolar como" começa no combatente da vez se for do mestre (mob, NPC ou aliado dele); na vez de um jogador, "Mestre".

### E17 — Mapa: rotação, escala e áreas de magia
- **Rotacionar** a imagem do mapa em passos de 90°.
- **Redimensionar** a imagem (escala) independentemente do grid.
- **Formas de área** junto da régua, visíveis para todos como ela: **cone, esfera/círculo (raio), cilindro, linha e cubo** (as formas do D&D 5e), com tamanho em pés.

**Pronto quando:**
- Mapa girado 90° mantém o grid alinhado após recalibrar; escala muda o tamanho da imagem sem mexer nos tokens.
- Cone de 15 ft, esfera de 20 ft, linha de 30 ft e cubo de 10 ft aparecem com o tamanho certo no grid para todos.

**Decidido (E17):** rotação e escala mudam só a imagem (grid e tokens ficam); imagem nova ou campo limpo voltam a 0° e 100%. A área fica no mapa depois de soltar o mouse, até trocar de ferramenta ou apertar Esc; origem com precisão de meio quadrado (centro ou canto); cone com a largura igual à distância da origem, linha de 5 ft de largura, cubo com a origem no meio de uma face, cilindro desenhado como círculo tracejado (vista de cima). Junto: **dois tokens não ocupam a mesma casa** (o servidor recusa; soltar da lista numa casa ocupada vai para a livre mais perto).

### E19 — Efeitos persistentes no mapa
Áreas que **ficam** no mapa (Graxa, Teia, Névoa, Fogo, Água…), em vez de sumirem como as do E17. Vem antes do E18 para o arquivo salvo já nascer com os efeitos.
- **Criar:** na ferramenta *Área*, depois de posicionar, *Fixar como efeito*: nome, cor e duração opcional em rounds. Fica no estado do jogo, visível para todos.
- **Duração:** desconta 1 no **início do turno de quem conjurou** (como as magias do 5e); ao chegar a 0 o efeito some e todos recebem um aviso ("Teia de Ana acabou"). Sem duração = fica até alguém tirar.
- **Concentração:** o efeito pode ser marcado como de concentração. Se o conjurador perder a condição *Concentração* (ex.: falhou na resistência e alguém a tirou), o efeito some junto, com aviso. Ao criar um efeito de concentração, o conjurador ganha a condição se ainda não tiver.
- **Ligar/desligar:** o efeito pode ficar desligado sem ser apagado (ex.: a graxa antes de pegar fogo; um "Fogo" preparado que o mestre liga depois). Desligado aparece apagado para o mestre e some para os jogadores.
- **Permissões:** mestre cria, liga/desliga e remove qualquer efeito (inclusive os de inimigos); jogador só os que criou, em nome do próprio personagem.
- **Painel de efeitos:** lista com nome, quem conjurou, rounds restantes e ações (ligar/desligar, remover).
- O app só desenha (ADR-06): não calcula quem está dentro nem aplica terreno difícil ou dano.
- *Limpar campo* remove todos os efeitos.
- **Visual (decidido na implementação):** efeitos predefinidos com textura própria desenhada pelo app (sem arquivos de imagem, funciona offline): Fogo, Água, Graxa, Teia, Plantas, Raízes, Névoa, Gelo e Escuridão; Fogo, Água e Névoa são animados. *Personalizado* = só uma cor. A lista cresce acrescentando um desenho em `client/src/map/effectTextures.ts` e uma entrada em `EFFECT_PRESETS`. Os efeitos ficam numa camada semitransparente **entre o mapa e os tokens**.
- Efeito sem conjurador (ambiente, só o mestre) conta no início de cada round. Combatente que sai da batalha perde a concentração (os efeitos de concentração dele somem).

**Pronto quando:**
- "Teia (3)" de Ana passa a 2, 1 e some no início dos turnos de Ana, com aviso para todos; efeitos sem duração não mudam.
- Tirar a *Concentração* de Ana remove os efeitos de concentração dela, e só esses.
- Jogador não remove nem desliga efeito de outra pessoa (recusa no servidor, com teste); efeito desligado não chega aos jogadores.

### E18 — Salvar e carregar sessão
- **Exportar** (mestre): baixa um `.json` com personagens, bestiário, mobs/NPCs, mapa (imagem inclusa), grid, condições e log.
- **Importar** (mestre): carrega um arquivo, valida, mostra o resumo e substitui o estado atual após confirmação. Jogadores reconectam e reencontram os personagens (ligados pelo nome).

**Pronto quando:**
- Exportar → fechar o app → abrir → importar recupera o estado completo.
- Arquivo inválido ou de formato futuro é recusado com mensagem clara (teste).

**Decidido (E18):** arquivo `.json` com `app: "jamals-tabletop"`, `format` (hoje 1), versão do app, data, jogadores (só id, nome e papel: **sem tokens de sessão nem chave de mestre**), numeração dos mobs e o estado do jogo inteiro (combate em andamento incluído; pedido de rolagem e reações não, porque valem só para o turno). O servidor valida e copia campo por campo antes de trocar qualquer coisa: arquivo com erro não altera nada. Religação pelo nome (sem diferenciar maiúsculas): mestre do arquivo → mestre atual; jogador já conectado com o mesmo nome → religado na hora; os demais voltam offline e o **primeiro** que entrar com aquele nome assume o personagem. Exportar e importar vão pelo socket (limite de mensagem subiu para 50 MB por causa do mapa e dos avatares).
- **Lembrete de salvar:** o painel *Sessão* mostra "Não salvo" quando algo mudou desde o último salvamento (jogadores entrando e saindo não contam). Fechar a aba do mestre nesse estado dispara o aviso do navegador; o texto desse aviso é do navegador e não pode ser personalizado nem ter botão "Salvar" — isso fica para o launcher (E12).

### E20 — Identidade visual "Grimório sombrio"
Repaginada da interface, que parecia genérica ("feita por IA"). Decidida num brainstorm com guia visual aprovado antes do código; a referência completa está em [docs/design/guia-visual.md](docs/design/guia-visual.md).
- **Clima** taverna/grimório, intensidade equilibrada: clima nas bordas, títulos e ícones; conteúdo limpo e legível.
- **Paleta** Grimório sombrio: tinta e couro escuros, bronze (ação principal e destaque), verde-cobre (secundária), sangue (perigo), texto em tons de pergaminho. Cores de combatentes e texturas de efeitos não mudam.
- **Tipografia:** Cinzel só em títulos (marca, títulos de painel e de janela); Alegreya Sans no resto (substitui a Inter).
- **Componentes:** painel como "placa" de couro com cantoneiras de bronze e título em Cinzel com losango e filete; botões, selos, campos, barras de vida, condições, avisos e barras do topo e do mapa no novo estilo.
- **Ícones:** biblioteca Tabler (embutida) no lugar de todos os emoji.
- Mantidos: a marca do topo (agora com o d20 em bronze) e a tela de entrada.

**Pronto quando:** nenhuma tela usa emoji como ícone; paleta, fontes e placas seguem o guia; nada vaza com as colunas na largura mínima (260 px).

### E12 — App do mestre com janela própria (Electron, ADR-18)
- **Abrir:** dois cliques; tela de abertura (d20, nome, "Iniciando a mesa…"); o servidor sobe sozinho e a janela mostra a mesa como mestre. Sem botão Iniciar. Erro ao subir (porta bloqueada…): a tela de abertura mostra o motivo e **Tentar de novo**.
- **Convite:** o painel *Convidar jogadores* ganha **QR code** por endereço (vale também fora do app: Docker, código).
- **Fechar com alterações não salvas** (pedido na revisão do E18): modal do próprio app — "Você tem alterações não salvas. **Salvar e sair** / Sair sem salvar / Cancelar". *Salvar e sair* abre o "Salvar como" do sistema na pasta *Documentos/Jamal's Tabletop* com o nome de arquivo do E18 e fecha depois de gravar. Sem alterações: fecha direto.
- **Opções:** as mesmas da linha de comando/ambiente (porta, PUBLIC_URLS…); `--server-only` sobe sem janela (teste de fumaça da CI).
- **Distribuição:** Windows `.exe` portátil, macOS `.dmg` (arm64), Linux `.AppImage` (x64), nomes `jamals-tabletop-<versão>-<sistema>-<arch>`; Docker não muda. Checks da CI com os mesmos nomes (`Executáveis / win-x64`…).

**Pronto quando:**
- Abrir o app sobe a mesa sem terminal nem navegador; jogadores entram pelo endereço ou pelo QR code.
- Fechar com alterações não salvas mostra o modal; *Salvar e sair* grava o `.json` e fecha.
- A CI gera os três pacotes e o teste de fumaça (`--server-only`) passa nos três.

## 16. Fora do código (configuração e conhecimento)

- **Assinatura do executável:** sem certificado, o SmartScreen sempre mostra "Editor desconhecido"; os metadados do arquivo não mudam isso. Caminhos possíveis: **SignPath Foundation** (gratuito para projetos open source; exige licença open source no repositório) ou assinatura paga (ex.: Microsoft Trusted Signing). Mesmo assinado, o aviso só some com reputação de downloads.
- **Proteção do repositório público:** ruleset da `master` com *Require approvals: 1*, bypass só para **Repository admin** no modo *For pull requests only*; em *Settings → Actions*, exigir aprovação para workflows de PRs de contribuidores externos. Só o dono faz merge.
- **Aleatoriedade dos dados:** `crypto.randomInt` do Node no servidor (gerador criptográfico, uniforme), sem biblioteca externa (ADR-07).

# Fase 4 — Melhorias incrementais

Objetivo: depois de jogar com a 2.0, ir somando melhorias pequenas, **uma versão por entregável**, em vez de juntar tudo numa release grande. O ADR-06 continua valendo: o app registra, não aplica regras.

## 17. Versões da Fase 4

- **Correção** sobe o PATCH (2.0.1, 2.0.2…). **Entregável novo** sobe o MINOR (2.1.0, 2.2.0…; depois da 2.9.0 vem a 2.10.0). MAJOR (3.0.0) só se quebrar compatibilidade (ex.: arquivo de sessão antigo que deixa de abrir).
- O PR que fecha o entregável já leva a versão no `package.json` e a seção datada no CHANGELOG: depois do merge, é só criar a tag (checklist no CLAUDE.md).
- **Depois da 2.7.0:** as melhorias passam a entrar aos poucos numa branch contínua (`feat/melhorias-da-mesa`), com a lista viva em [docs/backlog.md](docs/backlog.md), e saem em versões que juntam vários itens quando o pacote fica bom (2.8.0 = blocos A–D do backlog; 2.9.0 = E–K).

## 18. Entregáveis da Fase 4

Ordem: **2.0.1 → E21 → E22 → E24 → E25 → E26 → E23**. Regras de combate primeiro (mexem no jogo); depois a visibilidade dos dados (reclamação mais concreta); animações e som antes do celular (revisto depois da 2.2.0: o E23 é o maior e atende menos gente, e quem joga pelo celular já consegue jogar). Os detalhes de cada um são fechados no início do entregável. O E26 entrou depois da 2.4.0: melhorias que apareceram jogando, antes do celular.

### 2.0.1 — Correções do app
- **macOS:** o `executableName` (sem apóstrofo) também renomeava o pacote para `jamals-tabletop.app`; agora vale só para Windows e Linux, e o Mac fica com `Jamal's Tabletop.app` (o que o README manda liberar com `xattr`). Disco do `.dmg` e pasta de dados do app com o nome do produto.
- **Windows:** abrir o `.exe` portátil de novo com o app aberto apagava os arquivos da mesa em uso (ver ADR-18). Front dentro do `app.asar` e tela de abertura no `.exe`.

### E21 — Quem está na luta  *(2.1.0)*
- **Iniciativa:** a rolagem automática do mestre (*Rolar mobs*) só inclui quem está **no mapa** e **visível**. NPCs (aliados ou neutros) entram quando o mestre quiser: ele rola a iniciativa de cada um, como já faz hoje.
- **Mobs ocultos** (furtividade, sala escura): ficam no mapa só para o mestre; o **servidor não os envia** aos jogadores (filtro em `view.ts`, com teste). Fora da iniciativa até o mestre revelar; ao revelar, rolam iniciativa e entram na ordem.
- **Animais:** não são um tipo novo. São NPCs (neutros) ou mobs (hostis) com a marca *animal*: ícone de pata no token e na lista. O formato continua dizendo o lado (círculo aliado, quadrado inimigo, hexágono neutro).
- Detalhes (E21):
  - *Rolar mobs em campo*: só mobs com posição no mapa e visíveis; sem nenhum, recusa com o motivo. *Iniciativa de novo* rola esses mobs e os NPCs que já tinham iniciativa.
  - Ocultar tira da ordem (se era a vez dele, passa ao próximo) e zera a iniciativa; oculto não rola nem recebe valor. Revelar com combate ativo ou ordem já montada rola d20 + DES (log oculto, "(revelado)") e entra sem mudar a vez; senão só aparece. Dá para criar já oculto (mob avulso, NPC, *Adicionar ocultos* no template).
  - Para o jogador, um oculto não ocupa a casa (a recusa entregaria que há alguém ali); para o mestre, ocupa.
  - A marca *animal* vale para qualquer combatente (inclusive o companheiro de um jogador) e vem do template; não é segredo.
  - Arquivo de sessão guarda as duas marcas; arquivos da 2.0 abrem normalmente (sem marca). Oculto na ordem de iniciativa = arquivo inválido.
- **Conjurados** (pedido durante o E21): familiar, esqueletos, animais conjurados… Combatente comum do **mesmo tipo** de quem conjurou (`summonerId`), com o mesmo controle: conjurado de aliado é do jogador dono; de mob/NPC, do mestre.
  - Token no formato do lado, menor e com selo de varinha (o formato continua dizendo o lado). Na lista, "· de <conjurador>".
  - Conjurar: painel *Selecionado* → *Conjurar*: nome, vida, DES, cor, avatar, animal, quantidade ("Esqueleto 1…N") e *Depende de concentração*; o mestre pode preencher a partir de um template. Onde nascem: *Ao lado* (casas livres mais perto do conjurador, se ele estiver no mapa) ou *Escolher no mapa* (cada clique põe o próximo; a régua mostra os pés até o conjurador; o app **não limita o alcance**, a mesa confere; Esc deixa o resto fora do mapa). Nascem ocultos se o conjurador estiver oculto. Conjurado não conjura.
  - **Duração opcional** em rounds (1–100): conta no início do turno de quem conjurou, como os efeitos do E19; ao zerar, o conjurado some com aviso no log. Vazio = sem duração.
  - **Iniciativa própria**, como qualquer combatente (mobs conjurados entram no *Rolar mobs em campo*).
  - Remover o conjurador leva os conjurados; o *Desfazer* traz todos. Remover o personagem do jogador leva os dele (sem desfazer). *Limpar campo* tira todos os conjurados, até os dos jogadores. Conjurado não conta como "o personagem" do jogador.
  - *Depende de concentração*: o conjurador ganha a condição *Concentração*; ao perdê-la, os conjurados marcados somem (com aviso no log), como os efeitos do E19.

### E22 — Dados à vista  *(2.2.0)*
- **Log de rolagens destacável:** janela flutuante que dá para arrastar; minimizada, volta para o painel da direita.
- **Rolagem animada no centro da tela**, com biblioteca de dados (3D ou similar). A animação **termina no resultado que o servidor sorteou** (ADR-07); rolagens ocultas do mestre só animam na tela dele. Dá para desligar a animação.
- Detalhes (E22):
  - Biblioteca: **@3d-dice/dice-box-threejs** (MIT; three.js + cannon-es embutidos), por ser a que aceita **resultado predeterminado** ("2d6@4,1"): a física é só visual e os dados param no valor do servidor. Alternativas: @3d-dice/dice-box (Babylon, mais nova, sem resultado predeterminado); animação 2D própria (leve, sem o efeito de mesa). Carregada sob demanda (pedaço separado, ~145 KB comprimidos), pré-carregada 2 s depois de abrir a mesa.
  - Anima toda rolagem nova que a pessoa recebe no log (o filtro do servidor já decide quem vê). O histórico ao entrar/reconectar não anima. Fila: com várias rolagens juntas, ficam só as 3 mais recentes; aba em segundo plano não anima.
  - Faces desenhadas: d4, d6, d8, d10, d12, d20 e d100 (par dezenas + d10, como na mesa). Outras faces ou mais de 20 dados (contando o d100 como 2): só a faixa com o resultado.
  - **Cor dos dados** = cor do token de quem rolou, gravada no log pelo servidor (`color`): jogador → o combatente dele na vez (pode ser um conjurado) ou o personagem; mestre com *Rolar como* → aquele combatente; iniciativa → o combatente; mestre sem *Rolar como* → bronze. Número preto ou branco pelo contraste. Textura importada não (a biblioteca só tem a lista própria).
  - Faixa por cima: quem rolou (ou o combatente, "Rolar como"), o rótulo, o total em destaque, a expressão e 20/1 natural.
  - *Animar rolagens* e *log destacado* (posição e tamanho) ficam no navegador de cada um (localStorage).

### E24 — Animações do campo e mudança de estado  *(2.3.0)*
- Efeitos (fogo, água, névoa…) mais vivos, alinhados ao zoom e à rotação. Começa com um teste técnico antes de fechar a abordagem.
- Detalhes (E24):
  - **Sem biblioteca nova:** desenho por quadro no canvas do Konva (camada dos efeitos, abaixo dos tokens), com **camadas de ruído** periódico gerado por código andando em direções e velocidades diferentes e **partículas** com brilho aditivo (chamas, fagulhas, brilhos, ondulações, raios, baforadas). PixiJS foi considerado (filtros WebGL), mas exigiria outro canvas sincronizado com zoom, arrasto e rotação entre as camadas do Konva. Partículas proporcionais à área, com teto; só a camada dos efeitos redesenha a cada quadro.
  - **Borda difusa:** cada efeito é desenhado numa camada própria e recortado por uma máscara borrada do formato da área (refeita só quando a área, o grid ou o zoom mudam). Fica uma linha bem fraca no limite exato da área. Navegador sem filtro de canvas: borda nítida.
  - Todos os tipos animados: Fogo (calor subindo, chamas, fagulhas, fumaça), Água (lago: profundidade, ondas, reflexos, ondulações), **Solo molhado** (piso escurecido, poças que refletem, pingos), **Eletrificado** (raios que estalam), **Vapor** (névoa branca subindo), **Lama** (marrom úmido com bolhas), **Chão chamuscado** (fuligem, brasas fracas e cinza ao vento), **Gás tóxico** (névoa verde com bolhas), **Ácido** (E25), Névoa, Graxa (brilho de óleo), Teia (fios balançando, orvalho), Plantas (folhas ao vento), Raízes, Gelo (cintilação e brilho que atravessa), Escuridão (sombra girando) e Personalizado (cor com ondulação). Desligado continua parado e tracejado (só o mestre vê).
  - **Transformar** (mudança de estado): mesma área, outro tipo, nome, conjurador, duração e concentração. Sugestões primeiro (`EFFECT_TRANSITIONS`: graxa/teia/plantas/raízes → fogo; gelo → solo molhado/água; água e solo molhado → eletrificado/gelo/vapor; água e solo molhado → lama; lama → solo molhado/gelo; fogo → chão chamuscado/vapor/solo molhado; gás tóxico → névoa…), mas qualquer tipo vale (ADR-06). **Qualquer um** transforma um efeito ligado (é a magia de quem transforma: o feiticeiro eletrifica a água do clérigo); jogador com o próprio personagem como conjurador; quem transforma passa a controlar o efeito; o log registra ("Lia transformou Lago em Água eletrificada").
  - **"Quando acabar, volta a ser o anterior"** (exige duração ou concentração): ao acabar, o efeito volta ao estado de antes (`revertTo`) em vez de sumir, com aviso no log. Transformar de novo um estado temporário guarda o original, não o intermediário. Sem a opção, o efeito some quando o novo estado acaba (graxa que pegou fogo).
  - Arquivo de sessão guarda `revertTo`; arquivos anteriores abrem normalmente.

### E25 — Som  *(2.4.0)*
- Música ambiente e efeitos sonoros (trovão…) escolhidos pelo mestre e **tocados no navegador de todos** (a mesa joga cada um em casa). O servidor transmite o comando (tocar, parar, volume) e os arquivos; os navegadores pedem um clique antes de liberar áudio.
- Detalhes (E25):
  - **Fontes:** arquivos do mestre numa **pasta de sons** (`--sounds-dir` / `SOUNDS_DIR`; no app do mestre, *Documentos/Jamal's Tabletop/Sons* por padrão) e **sons gerados pelo app** com Web Audio (ruído filtrado, osciladores, eco gerado), sem arquivo nem licença: 10 ambientes (chuva, tempestade, vento, fogueira, caverna, mar, riacho, noite, masmorra, batimento) e 10 efeitos (trovão, explosão, espada, sino, gongo, tambores, flecha, magia, raio, moedas). Níveis medidos e igualados por som; limitador na saída.
  - **YouTube não** (por enquanto): os termos do player embutido proíbem esconder o vídeo/tocar só o áudio, anúncios diferentes por jogador quebram a sincronia, vídeos podem bloquear a incorporação e tudo dependeria de internet.
  - A pasta é do mestre: o app lista os arquivos de áudio dela e grava só o que o mestre adiciona pelo painel (nome seguro, sem sobrescrever; até 40 MB por arquivo, via socket). Nada do jogo vai para o disco (ADR-04). A lista vai só para o mestre; os arquivos saem em `/sons/<nome>` só para quem tem o token da sessão.
  - **Canais:** *Música* e *Ambiente* em loop (estado com a hora de início: quem entra depois começa no mesmo ponto; troca com fade de 1,5 s) e *Efeitos* de uma vez (evento `sound:sfx`, fora do estado). O som não vai no arquivo de sessão e não muda ao limpar o campo.
  - **Volumes:** o mestre define o volume de cada canal para a mesa; cada pessoa tem o próprio **volume geral e mudo** (alto-falante na barra do topo, guardado no navegador), aplicado depois do volume do mestre.
  - **Só o mestre** toca, para, ajusta volume e adiciona arquivos (validado no servidor); jogadores só ouvem.
  - Navegador com áudio bloqueado até um clique: com algo tocando, aparece *Ativar som da mesa* (qualquer clique na página também libera).
  - **Revisto depois da 2.6.0:** trovão, explosão, espada, flecha, magia, raio e moedas passaram a ser calculados amostra por amostra (ruído com filtros que mudam no tempo, ressonâncias de metal, estalos espalhados), gerados com o navegador ocioso para tocar sem espera. Tempestade com trovões a cada 12–30 s, a distâncias sorteadas. **Barulho dos dados 3D:** gravações que vêm com a biblioteca dos dados (MIT; dado de plástico em mesa de madeira, em `client/public/dados/`), tocadas a cada batida da física, no volume de efeitos × volume geral da pessoa.
- **Ácido** (pedido no fim do E24): poça verde-amarelada corroendo o chão, com bolhas e fumaça; transformações sugeridas: Ácido → Gás tóxico (evapora) / Solo molhado (diluído).

### E26 — Melhorias da mesa e clima  *(2.5.0)*
- **Nomes no mapa:** o token com o mouse em cima (e o selecionado) é desenhado por último, então o nome dele nunca fica atrás do token vizinho.
- **Quem rolou, sempre no mesmo padrão:** "Personagem (jogador)". Jogador → o combatente dele na vez (pode ser um conjurado) ou o personagem; sem personagem, só o nome. Mestre → "Goblin 2 (Mestre)" com *Rolar como*, "Mestre" sem. Vale para o log, a faixa dos dados 3D, a iniciativa, os avisos ("Thorin (Jorge) usou a reação") e réguas/áreas.
- **Rolar como** segue o mapa: combatente do lado do mestre **selecionado** → senão o da vez (se for do mestre) → senão "Mestre". A troca manual vale até a seleção ou o turno mudar. As rolagens do mestre continuam ocultas por padrão; o padrão serve para o log dele e para quando ele mostra a rolagem.
- **Log sincronizado com os dados 3D:** cada navegador mostra "Rolando…" na entrada até os dados pararem na tela dele; fila como no E22 (mais de 3 esperando, as antigas pulam a animação e aparecem na hora). Só apresentação: o resultado continua vindo do servidor. Sem animação, aparece na hora.
- **Rolagens fora de combate** (mestre, painel *Dados*): **Livres** (padrão), **Só com pedido** (o *Pedir rolagem* passa a valer fora de combate: cada jogador pedido rola uma vez) ou **Travadas** (só o mestre). Em combate vale a trava por turno de sempre; o modo continua depois do combate e vai no arquivo de sessão.
- **Antispam:** o jogador espera os próprios dados pararem para rolar de novo (no navegador) e o servidor recusa rolagens do mesmo jogador com menos de 1,5 s entre elas. O mestre não tem limite.
- **Clima no mapa** (só o mestre muda; todos veem igual): chuva, chuva forte, tempestade (relâmpagos), granizo, neve, nevasca, névoa, vento com folhas, tempestade de areia, cinzas, brasas, calor (miragem), vagalumes, luzes mágicas, esporos, pétalas e chuva de sangue; **intensidade** (20–100%) e **vento** (−60° a 60°). **Luz** à parte: dia, entardecer, noite, luar (cor multiplicada sobre o mapa e vinheta).
  - Desenhado por cima do mapa e dos tokens, em pixels da tela (o clima não anda ao arrastar o mapa), sem receber cliques. A luz escurece chuva, névoa e neve junto com o mapa; o que brilha sozinho (brasas, vagalumes, luzes mágicas) fica por cima dela.
  - **Relâmpagos com hora marcada:** a semente é a hora em que o clima começou (`startedAt`); todos os navegadores calculam os mesmos instantes, sem evento extra. O trovão (som gerado do E25, canal de efeitos) vem um pouco depois do clarão. Por isso Tempestade e Granizo sugerem o ambiente *Chuva*, não *Tempestade* (que tem trovões próprios, fora de sincronia).
  - O painel sugere o ambiente sonoro que combina (*Tocar ambiente: …*), sem ligar sozinho.
  - **Reduzir o clima** (barra do mapa, por navegador): cerca de 1/3 das partículas, 30 quadros por segundo, clarão fraco e sem miragem. Prepara o terreno para o E23.
  - Vai no arquivo de sessão (arquivo antigo abre sem clima). *Limpar campo* volta para sem clima, de dia.

### E23 — Celular e tablet  *(2.6.0)*
- Layout próprio para **jogadores** em telas pequenas (abas como Mapa, Ficha, Dados, Iniciativa). O mestre continua no app do computador; a tela mínima de 1024 × 640 vale para ele.
- Detalhes (E23):
  - **Quando:** jogador numa tela que não comporta 1024 × 640 (largura < 1024 ou altura < 560: celular, tablet em pé, celular deitado). Tablet deitado (≥ 1024) fica com a tela de computador. A pessoa pode forçar uma ou outra no menu (guardado no navegador); o mestre usa sempre a de computador. Sem servidor novo: é só o client.
  - **Abas embaixo** (alcance do polegar): **Mapa**, **Ficha** (o selecionado; sem seleção, abre o próprio personagem; lista de aliados para criar/escolher), **Dados** (o log fica sempre no painel, sem janela flutuante) e **Combate** (iniciativa, efeitos, jogadores). O mapa fica montado ao trocar de aba (guarda zoom e posição). Os dados 3D aparecem por cima de qualquer aba.
  - **Topo compacto:** "Sua vez!" (ou "Round 2 · vez de…"), reconectando, volume e menu (trocar para a tela de computador, Sair). Na vez do jogador ou com pedido de rolagem, marca na aba Dados.
  - **Mapa no toque:** dois dedos aproximam/afastam e arrastam a visão (pinça ouvida antes do Konva, que engole o toque enquanto arrasta a visão); se a pinça começar em cima de um token, o token volta para a casa e não anda. Régua e área com o dedo (eventos de ponteiro, valem para mouse também). Barra só com ícones; sem +/− (é a pinça). A pinça também funciona na tela de computador (tablet deitado).
  - **Celular deitado:** abas numa coluna à esquerda e topo menor. **Tablet em pé:** painéis com no máximo 640 px de largura, centralizados.
  - Detalhes de toque: sem dicas flutuantes em aparelho só de toque (grudam depois do toque; os botões têm texto ou `aria-label`); atalhos de teclado escondidos; áreas seguras do iPhone (`viewport-fit=cover`, `env(safe-area-inset-*)`); altura com `dvh` (a barra do navegador não corta as abas); som liberado também no `touchend` (iPhone).

### 2.8.0 — Melhorias da mesa (backlog A–D)
Os itens e o detalhe de cada um estão em [docs/backlog.md](docs/backlog.md) e no CHANGELOG. Decisões que valem daqui em diante:
- **Proteção do arquivo de sessão:** `server/test/save-guard.test.ts` monta um jogo com todos os campos (`Required<…>`), salva, carrega e compara. Campo novo esquecido no teste quebra o typecheck; esquecido no arquivo de sessão, quebra o teste.
- **Formato do arquivo 2:** as cenas guardadas entram no arquivo; a 2.7 recusaria em silêncio o que não conhece (perderia as outras cenas), então o formato sobe e versões antigas pedem para atualizar. Arquivos de formato 1 continuam abrindo (uma cena só, sem desenhos nem paredes).
- **i18n (base):** catálogo em `client/src/i18n/` (pt-BR é a fonte; en e es por cima, o que faltar aparece em português), idioma do navegador por padrão e escolhido por pessoa. Texto novo de interface já nasce no catálogo; o antigo e as mensagens do servidor migram no backlog F.
- **Ficha:** CA, bônus de iniciativa e vida são obrigatórios; atributos opcionais, com modificador calculado e DES puxando a iniciativa. CA, atributos, vida temporária e a ficha pessoal (recursos, ataques, itens, moedas) de mob/NPC não vão para os jogadores (`view.ts`, com teste).
- **Tamanho:** `pos` é a casa de cima à esquerda; o servidor confere todas as casas ocupadas (Miúdo divide a casa). A régua mede da borda.
- **Registro, não regra (ADR-06):** o lembrete de Concentração só avisa a CD; testes contra a morte só marcam; ações do turno só marcam; alcance/aura, paredes e portas são só visuais (não bloqueiam movimento nem calculam quem está dentro). A recarga no d6 é a única rolagem automática nova, sempre no log (oculta para mob/NPC).
- **Vez em grupo:** mobs do mesmo template com a mesma iniciativa e o mesmo d20, lado a lado na ordem, são um grupo (`shared/src/initiative.ts`): uma linha, uma vez; o começo da vez roda para cada um e *Atrasar* leva o grupo.
- **Ping** é efêmero (como a régua), com limite de frequência por conexão. **Desenhos** ficam em pixels do mapa (acompanham a imagem, não o grid); os ocultos não vão para os jogadores. **Portas secretas** também não.
- **Cenas:** a ativa vive em `battle`; as outras guardam o conteúdo do mapa (`SceneContent`) e as posições dos aliados. Trocar só fora de combate e zera a iniciativa; bestiário, personagens, log e som são da mesa. A lista de cenas é só do mestre.

### 2.9.0 — Mesa do mestre, névoa de guerra e tradução completa (backlog E–K)
Os itens e o detalhe de cada um estão em [docs/backlog.md](docs/backlog.md) e no CHANGELOG. Decisões que valem daqui em diante:
- **Regras da mesa** (`game.rules`, valem para todas as cenas): opções que o mestre liga, desligadas por padrão. *Movimento só na sua vez* trava **quando** mover, nunca **quanto** (ADR-06 continua: o app não conta deslocamento). A trava é conferida no servidor; o mestre nunca é travado.
- **Névoa de guerra** (uma por cena, `battle.fog`): casas guardadas por linha em intervalos de colunas (leve para ir em todo envio). O jogador **não recebe** mobs, NPCs, efeitos, desenhos nem paredes que estejam inteiros na parte coberta (`view.ts`, com teste); a imagem do mapa vai inteira e a névoa é desenhada por cima (limite aceito: quem abrir as ferramentas do navegador vê o desenho do mapa, nunca os inimigos).
  - **Revelado pelo mestre** (pincel, retângulo, cômodo) é visível de verdade. *Cômodo* cresce casa a casa até paredes e portas fechadas; área que não fecha é recusada.
  - **Visão dos personagens:** compartilhada pela mesa (o que um vê, todos veem); linha de visão calculada no servidor (`server/src/sight.ts`), refeita só quando aliados, tochas, paredes, portas, luz ou escala mudam. Raio pela luz do clima (dia 120 ft, entardecer 60, luar 30, noite 20; visão no escuro 60; tocha 40). O que já foi visto fica **explorado**: mapa, paredes e efeitos à mostra, escurecidos, **sem os inimigos de agora**.
  - **Tochas** iluminam para quem tem linha de visão até a luz (mob oculto não ilumina). **Visto por último aqui:** inimigo que sai da vista deixa uma marca até alguém ver o lugar de novo.
  - Visual: textura e máscara da névoa geradas no cliente (`fogRender.ts`), borda esfumaçada estável (ruído preso às coordenadas do mapa); *Reduzir o clima* para as animações.
- **Chefe com fases:** as próximas fases (vida, nome e CA) ficam no combatente e nunca vão para os jogadores; zerar a vida começa a próxima com vida cheia (o dano que sobra não passa).
- **Efeito que anda com o token** (`followId`): a área anda a mesma distância que o token; tirar do mapa e voltar não leva junto.
- **Mostrar para a mesa** viaja num evento próprio (como a imagem do mapa) e **não** vai no arquivo de sessão: é do momento.
- **Tradução completa (en, es):** interface no catálogo do cliente; **textos do servidor** (recusas e avisos do log) continuam escritos em português, mas como **modelo com valores** (`fail("… {name}.", { name })`, `logSystem(store, "…", { … })`), e o cliente traduz com `client/src/i18n/serverText.ts`. `server/test/server-text.test.ts` falha se um texto novo do servidor ficar sem tradução. O que a mesa digita fica como foi escrito.
- **Arquivo de sessão:** continua no formato 2; os campos novos (névoa, regras, tochas, fases, modelos do log) são opcionais, então arquivos da 2.8 abrem normalmente. Uma versão 2.8 abrindo arquivo da 2.9 ignora esses campos.

### 2.10.0 — Cara de jogo (backlog L, em andamento)
Release de interface e fluxo sobre a base do guia visual (tema, fontes e componentes ficam). Itens em [docs/backlog.md](docs/backlog.md). Decisões até aqui:
- **Arte desenhada no código, aprovada em protótipo antes de entrar no app**. Nada de imagens soltas: o kit visual (`client/src/map/tokenArt.ts`) desenha metal, ouro, rebites e rubis no canvas, como a névoa.
- **Tokens:** moldura "bronze forjado" para todos (bronze no aliado, ferro no mob, prata no NPC; a cor do token vira uma faixa por dentro). Cada token pronto vira uma imagem guardada, refeita só quando muda o que aparece nela (avatar, cor, tamanho na tela em degraus de 2^¼, caído); o que anima (halo e contorno da vez, tracejado da seleção) é desenhado ao vivo e para com *Reduzir o clima*.
- **Chefe** é uma marca própria do mob/NPC (e do template), **pública**: todos veem a moldura de chefe (estilo carta de jogo, sempre quadrada). As fases continuam só com o mestre; por isso o brasão não depende delas. Vai no arquivo de sessão (formato 2, campo opcional).
- **Ícones de jogo:** exceção ao "só Tabler" para ornamentos e ícones desenhados no mapa: game-icons.net (CC BY 3.0), só os caminhos usados, em `client/src/map/gameIcons.ts`, com crédito na tela *Sobre*.
- **Paredes livres:** as pontas da parede são posições em casas do grid, inteiras (cantos) ou fracionadas (traço livre), guardadas em centésimos. A névoa já calculava por cruzamento de linhas, então nada muda nela; o arquivo de sessão continua no formato 2. O *Desfazer* das paredes é do cliente (histórico do navegador do mestre): coloca e tira paredes pelas ações de sempre.
- **Estilo das paredes por cena** (`map.wallStyle`: pedra lavrada, rocha bruta ou madeira; ausente = pedra): campo opcional da cena, no arquivo de sessão. **Porta dupla** não é um dado: o cliente reconhece duas portas em linha que se encostam e desenha as folhas abrindo para o mesmo lado. Parede comum vira imagem guardada (como os tokens); porta é desenhada ao vivo.
