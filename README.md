# Simulador de Encontros

Simulador de combates de RPG de mesa (base D&D 5e) para rodar localmente. Quem hospeda é o **mestre**; os jogadores entram pelo navegador. O app é um registro compartilhado (vida, iniciativa, slots, mapa e tokens): todo cálculo de dano, movimento e alcance fica com a mesa e as fichas. Nada é salvo: desligou o servidor, a sessão some.

Especificação, ADRs e entregáveis em [SPEC.md](SPEC.md).

## Mestre: do zero até a sessão no ar

### 1. Instalar o Node.js (só na máquina do mestre)
Node.js 20 ou mais novo (testado no 24 LTS). No Windows:

```powershell
winget install OpenJS.NodeJS.LTS
```

Ou baixe em [nodejs.org](https://nodejs.org). Feche e abra o terminal depois de instalar.

### 2. Instalar e compilar (uma vez, ou depois de atualizar o código)

```bash
npm install
npm run build
```

### 3. Subir a sessão (toda vez que for jogar)

```bash
npm start
```

O navegador abre em `http://localhost:3000`: quem acessa por **localhost** é sempre o mestre. O console e o painel **Convidar jogadores** mostram os endereços para passar à mesa. Para encerrar a sessão, `Ctrl+C` no terminal.

> O mestre precisa acessar por `localhost`. Se abrir pelo IP da rede/VPN na própria máquina, entra como jogador.

Variáveis opcionais:

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `MAX_PLAYERS` | `6` | Limite de jogadores conectados (além do mestre) |
| `OPEN_BROWSER` | `1` | `0` para não abrir o navegador ao iniciar |

### Firewall do Windows
Na primeira execução o Windows pergunta se o Node pode aceitar conexões: permita em **redes privadas**. Se os jogadores não conseguirem conectar, libere a porta (PowerShell como administrador):

```powershell
New-NetFirewallRule -DisplayName "Simulador de Encontros" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## Jogadores: conectando

Só precisa de um navegador.

- **Mesma rede (LAN):** abra o endereço `http://192.168.x.x:3000` que o mestre passar.
- **Pela internet:** usem uma VPN mesh. Recomendado: [Tailscale](https://tailscale.com/download) (alternativas: ZeroTier, Radmin VPN).
  1. Todos (mestre e jogadores) instalam o Tailscale e entram na mesma rede: o mestre convida pelo painel do Tailscale ou compartilha a máquina dele.
  2. O mestre passa o endereço `http://100.x.x.x:3000` (aparece como "Tailscale" no console e no app).

Recarregar a página ou cair a conexão devolve o jogador com a mesma identidade e o mesmo personagem.

## Roteiro de uma sessão

1. **Jogadores** criam o próprio personagem em *Aliados* (nome, vida máx., mod. DES, cor, avatar).
2. **Mestre** monta o campo:
   - *Mapa*: envia a imagem e clica em *Calibrar pelo mapa* — arrasta um retângulo sobre um ou mais quadrados do desenho e informa quantos cabem na largura. Sliders fazem o ajuste fino. 1 quadrado = 5 ft.
   - *Bestiário*: cria templates (ex.: Goblin) e adiciona N mobs de uma vez ("Goblin 1"…"Goblin N"), ou um mob avulso.
   - Arrasta mobs e aliados da lista para o mapa (ou *Colocar no mapa* no painel *Selecionado*).
3. **Iniciativa**: o mestre clica *Rolar mobs* (opção de uma rolagem por template); cada jogador rola a sua ou digita o valor do dado físico. *Iniciar combate* → *Próximo turno*. O token e a linha de quem está na vez ficam destacados; o jogador vê "Sua vez!".
4. **Combate**: a vida só soma/subtrai o que for digitado (− Dano / + Cura; Enter = dano, Shift+Enter = cura). O mestre controla a vida dos mobs (jogadores não a veem); cada jogador controla a própria. Mob com 0 de vida fica marcado ✕ e sai quando o mestre remove (com *Desfazer*).
5. **Magias**: no painel *Selecionado*, cada jogador ajusta quantos slots tem por nível, clica nas bolinhas para gastar/recuperar e anota magias para referência. *Recuperar slots* e *Restaurar tudo* (vida cheia + slots) ficam a critério do jogador.
6. **Fim da luta**: *Encerrar* (no painel Iniciativa) zera rounds e iniciativas. **🧹 Limpar campo** (barra do topo) tira mapa, mobs, iniciativa e posições para montar a próxima batalha — jogadores continuam conectados e personagens mantêm vida, slots e magias. O bestiário pode ser mantido.

**Dados**: botões d4–d100 com quantidade e modificador, expressão livre (`2d6+1d4+3`), vantagem/desvantagem; o log é compartilhado e o mestre pode rolar oculto.

**Mapa**: roda do mouse = zoom; arrastar o fundo = mover a visão; *Ajustar* enquadra o mapa; *Régua* (ou **Shift** + arrastar) mede em pés, visível para todos. Painéis laterais recolhem clicando no título.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `A porta 3000 já está em uso` | Outro servidor está aberto. Feche-o ou rode com outra porta (`$env:PORT=3001; npm start` no PowerShell). |
| Jogador não conecta pela LAN | Libere o firewall (acima) e confira se estão na mesma rede. |
| Jogador não conecta pela internet | Todos precisam estar logados na mesma rede do Tailscale; use o endereço `100.x.x.x`. |
| Mestre entrou como "Jogador" | Abra `http://localhost:3000` na máquina do servidor. |
| "Sala cheia" | Limite de 6 jogadores; aumente com `MAX_PLAYERS`. |
| `Cannot GET /` no navegador | Rode `npm run build` antes do `npm start` (o servidor serve o client compilado). |

## Desenvolvimento

```bash
npm run dev        # servidor (3000) + Vite (5173) com hot reload
npm run typecheck  # tsc em shared, server e client
npm test           # testes de integração do servidor
```

Em dev o mestre usa `http://localhost:5173` e os jogadores `http://<ip>:5173`; o Vite faz proxy do Socket.IO e repassa o IP real do cliente para o servidor decidir quem é mestre.

### Estrutura

```
shared/  tipos do estado, contrato dos eventos Socket.IO, limites e regra de distância
server/  Express + Socket.IO; estado em memória, ações (src/actions), permissões e filtro por papel
client/  Vite + React + Zustand; mapa com react-konva (src/map)
```

## Status

| Entregável | Status |
|---|---|
| E1 — Fundação e sessão | ✅ |
| E2 — Combatentes e vida | ✅ |
| E3 — Dados | ✅ |
| E4 — Mapa e tokens | ✅ |
| E5 — Iniciativa e turnos | ✅ |
| E6 — Magias | ✅ |
| E7 — Ciclo da batalha e acabamento | ✅ |
