# Jamal's Tabletop

Simulador de combates de RPG de mesa (base D&D 5e). Quem hospeda é o **mestre**: abre o app (uma janela própria, com o servidor da sessão dentro) e os jogadores entram pelo navegador, sem instalar nada. O app é um registro compartilhado (vida, iniciativa, slots de magia, mapa e tokens): todo cálculo de dano, movimento e alcance fica com a mesa e as fichas. Nada é salvo: fechou a sessão, tudo some.

**⬇️ Baixar:** [última versão](https://github.com/JorgeMombach/RpgTabletop/releases/latest) (Windows, Linux e macOS) · [Changelog](CHANGELOG.md) · [Especificação e decisões](SPEC.md)

## Para quem vai mestrar

Não precisa instalar nada além do app (os jogadores nem isso: só o navegador).

1. Na [página da última versão](https://github.com/JorgeMombach/RpgTabletop/releases/latest), em **Assets**, baixe o arquivo do seu sistema:

   | Sistema | Arquivo |
   |---|---|
   | Windows | `jamals-tabletop-<versão>-win-x64.exe` (portátil: não instala) |
   | Linux | `jamals-tabletop-<versão>-linux-x64.AppImage` |
   | macOS (Apple Silicon) | `jamals-tabletop-<versão>-macos-arm64.dmg` |

2. **Dois cliques** no arquivo. Abre a janela do Jamal's Tabletop: o servidor sobe sozinho e a mesa aparece já como mestre (a primeira abertura no Windows demora uns segundos a mais).
   - **Windows — "O Windows protegeu o computador"** (SmartScreen): o app não tem assinatura digital paga. Clique em **Mais informações → Executar assim mesmo**. Só na primeira vez.
   - **Windows — "Permitir acesso à rede?"** (Firewall): marque **Redes privadas** e clique em **Permitir**. Sem isso os jogadores não conseguem entrar. Atenção: a rede do **Tailscale** é sempre *Privada*, mesmo que a rede da sua casa apareça como *Pública* — se o Windows sugerir só "Redes públicas", marque também **Redes privadas**.
   - **macOS:** abra o `.dmg` e arraste o app para *Aplicativos*. Na primeira vez, se aparecer "desenvolvedor não identificado" (ou "está danificado"), botão direito no app → **Abrir** → **Abrir**; se ainda assim não abrir, no Terminal: `xattr -cr "/Applications/Jamal's Tabletop.app"`.
   - **Linux:** `chmod +x jamals-tabletop-*-linux-x64.AppImage` e execute.
3. Passe para os jogadores o endereço do painel **Convidar jogadores** (botão *Copiar*, ou o **QR code** para eles apontarem a câmera do celular). Jogando pela internet, todos precisam estar no mesmo Tailscale (veja abaixo).
4. **Deixe o app aberto** durante o jogo. Fechar encerra a sessão para todos; se houver alterações não salvas, o app pergunta antes: **Salvar e sair** (grava o arquivo da sessão, por padrão em *Documentos/Jamal's Tabletop*), **Sair sem salvar** ou **Cancelar**.

**Link de mestre:** o painel *Convidar jogadores* tem, em *Abrir como mestre em outro dispositivo*, um link `…/?gm=<chave>`. Quem abre esse link entra como mestre de qualquer dispositivo (ex.: mestrar pelo tablet enquanto o app roda no PC da sala). **Não compartilhe com os jogadores.** A chave muda a cada execução, a menos que você fixe uma com `--gm-key` (veja *Opções*). Sem o link, o mestre é quem abre `http://localhost:3000` na própria máquina — pelo IP da rede, mesmo na própria máquina, entra como jogador.

## Jogadores: conectando

Só precisa de um navegador.

- **Mesma rede (LAN):** abra o endereço `http://192.168.x.x:3000` que o mestre passar.
- **Pela internet:** usem uma VPN mesh. Recomendado: [Tailscale](https://tailscale.com/download) (alternativas: ZeroTier, Radmin VPN).
  1. Todos (mestre e jogadores) instalam o Tailscale. O mestre convida cada jogador pelo painel do Tailscale (**Users → Invite external users**).
  2. O jogador aceita o convite e **troca para a rede do mestre** no aplicativo do Tailscale (ícone perto do relógio → conta → escolher a rede do mestre). Aceitar o convite não basta: se o aplicativo continuar na rede pessoal do jogador, o endereço do mestre não abre.
  3. Para conferir: o computador do jogador aparece em **Machines** no painel do mestre.
  4. O mestre passa o endereço `http://100.x.x.x:3000` (aparece como "Tailscale" na janela e no app).

Recarregar a página ou cair a conexão devolve o jogador com a mesma identidade e o mesmo personagem.

## Roteiro de uma sessão

1. **Jogadores** criam o próprio personagem em *Aliados* (nome, vida máx., mod. DES, cor, avatar).
2. **Mestre** monta o campo:
   - *Mapa*: envia a imagem e clica em *Calibrar pelo mapa* — arrasta um retângulo sobre um ou mais quadrados do desenho e informa quantos cabem na largura. Sliders fazem o ajuste fino. 1 quadrado = 5 ft.
   - *Bestiário*: cria templates (ex.: Goblin) e adiciona N mobs de uma vez ("Goblin 1"…"Goblin N"), ou um mob avulso. *+ NPC* no template (ou no painel *NPCs*) cria um personagem neutro: token em hexágono, vida só para o mestre.
   - Arrasta mobs e aliados da lista para o mapa (ou *Colocar no mapa* no painel *Selecionado*).
3. **Iniciativa**: o mestre clica *Rolar mobs e NPCs* (opção de uma rolagem por template); cada jogador rola a sua ou digita o valor do dado físico. *Iniciar combate* → *Próximo turno*. O token e a linha de quem está na vez ficam destacados; o jogador vê "Sua vez!".
4. **Combate**: a vida só soma/subtrai o que for digitado (− Dano / + Cura; Enter = dano, Shift+Enter = cura). O mestre controla a vida dos mobs (jogadores não a veem); cada jogador controla a própria. Mob com 0 de vida fica marcado ✕ e sai quando o mestre remove (com *Desfazer*). **Condições** (atordoado, concentração…) ficam em *Selecionado → + Condição*, com duração opcional em rounds: desconta no início do turno de quem tem e, ao acabar, todos recebem um aviso.
   - **Dados em combate:** blocos *Ataque* (d20 + bônus, com vantagem/desvantagem) e *Dano* (20 natural marca *Crítico*, que dobra os dados). O jogador só rola **na própria vez**; fora dela, só quando o mestre clica *Pedir rolagem* (ex.: "Resistência DES", uma rolagem por jogador) ou usando a **Reação** (1 por round, libera até o turno mudar). O mestre rola sempre, **oculto por padrão**, e a rolagem sai com o nome do combatente da vez ("Goblin 2"; dá para trocar em *Rolar como*). O log agrupa por turno. *Iniciativa de novo* zera tudo, rola mobs e NPCs e pausa até os jogadores rolarem.
5. **Magias**: no painel *Selecionado*, cada jogador ajusta quantos slots tem por nível, clica nas bolinhas para gastar/recuperar e anota magias para referência. *Recuperar slots* e *Restaurar tudo* (vida cheia + slots) ficam a critério do jogador.
6. **Fim da luta**: *Encerrar* (no painel Iniciativa) zera rounds e iniciativas. **🧹 Limpar campo** (barra do topo) tira mapa, mobs, NPCs, iniciativa e posições para montar a próxima batalha — jogadores continuam conectados e personagens mantêm vida, slots e magias. . **Salvar para a próxima sessão**: nada fica salvo sozinho. No painel *Sessão*, **💾 Salvar** baixa um arquivo `.json` com tudo (mapa, personagens, bestiário, combate, condições, efeitos e log). Na próxima vez, **📂 Carregar** esse arquivo; os jogadores entram com o **mesmo nome** de antes e reencontram os personagens. O arquivo não leva senhas nem a chave de mestre. O painel avisa "Não salvo" quando algo mudou desde o último salvamento, e fechar a aba nesse estado pede confirmação.

**Dados**: botões d4–d100 com quantidade e modificador, expressão livre (`2d6+1d4+3`), vantagem/desvantagem; o log é compartilhado e o mestre pode rolar oculto.

**Mapa**: roda do mouse = zoom; arrastar o fundo = mover a visão; *Ajustar* enquadra o mapa; *Régua* (ou **Shift** + arrastar) mede em pés, visível para todos. *✦ Área* mostra a área de uma magia para todos (cone, esfera, cilindro, linha ou cubo, tamanho em pés): clique na origem e arraste para apontar; Esc apaga. No painel *Mapa*, o mestre gira a imagem em 90° e muda o tamanho dela (para casar os quadrados do desenho com o grid) sem mexer nos tokens. Dois tokens não ficam na mesma casa. Com uma área desenhada, *📌 Fixar como efeito* deixa ela no mapa (Fogo, Água, Graxa, Teia, Plantas, Raízes, Névoa, Gelo, Escuridão ou uma cor), com quem conjurou, duração em rounds (desconta no turno de quem conjurou) e concentração (some quando o conjurador perde a *Concentração*). O painel *Efeitos no mapa* liga, desliga e remove; cada um mexe só nos próprios efeitos, o mestre em todos. Painéis laterais recolhem clicando no título e mudam de largura arrastando a borda entre a coluna e o mapa (duplo clique volta ao padrão). A tela do app tem no mínimo 1024 × 640 px: numa janela menor aparece barra de rolagem.

## Opções

Para quem quer ajustar algo. Passe como argumento ao app (ex.: `jamals-tabletop-2.0.0-win-x64.exe --port 4000`) ou como variável de ambiente; o argumento vence. `--help` lista tudo.

| Argumento | Variável | Padrão | Uso |
|---|---|---|---|
| `--port` | `PORT` | `3000` | Porta inicial (se ocupada, usa a próxima livre e avisa) |
| `--max-players` | `MAX_PLAYERS` | `6` | Limite de jogadores conectados (além do mestre) |
| `--no-open` | `OPEN_BROWSER=0` | abre | Não abre o navegador ao iniciar |
| `--gm-key` | `GM_KEY` | gerada | Chave de mestre fixa (mín. 8 caracteres) |
| `--no-gm-loopback` | `GM_LOOPBACK=0` | ligado | localhost deixa de ser mestre; só a chave vale (Docker) |
| `--public-urls` | `PUBLIC_URLS` | detectados | Endereços de convite, separados por vírgula |
| `--no-detect-addresses` | `DETECT_ADDRESSES=0` | ligado | Não lista os IPs da máquina como convite (Docker) |

`GET /healthz` responde `{"ok":true,"version":…}` (usado no healthcheck do Docker).

## Alternativa: Docker

Para quem já usa Docker ou tem um servidor em casa. A imagem oficial é publicada a cada versão em `ghcr.io/jorgemombach/rpgtabletop` (tags `latest`, `X.Y` e `X.Y.Z`).

No container o mestre **não** é reconhecido por `localhost` (as conexões chegam pela rede interna do Docker): ele entra pelo **link com a chave**, mostrado nos logs. Os endereços de convite também não são detectados lá dentro: informe-os em `PUBLIC_URLS`.

```bash
docker run -d --name simulador -p 3000:3000 -e GM_KEY=uma-chave-sua -e PUBLIC_URLS=http://192.168.0.10:3000 ghcr.io/jorgemombach/rpgtabletop:latest
```

```bash
docker logs simulador
```

O log mostra o *Link de mestre* e os endereços dos jogadores. Para encerrar: `docker stop simulador`.

Com o [`docker-compose.yml`](docker-compose.yml) do repositório (edite `GM_KEY` e `PUBLIC_URLS` antes): `docker compose up -d`, `docker compose logs`, `docker compose down`.

- `GM_KEY`: fixe uma chave (mín. 8 caracteres) para o link do mestre não mudar a cada reinício; sem ela, uma nova é gerada a cada início.
- `PUBLIC_URLS`: o(s) endereço(s) pelos quais os jogadores chegam nesta máquina (IP da LAN e/ou do Tailscale). Se publicar em outra porta (`-p 8080:3000`), use essa porta nos endereços.
- A imagem roda como usuário sem privilégios, tem healthcheck em `/healthz` e encerra limpo com `docker stop`.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "O Windows protegeu o computador" | Normal para app sem assinatura paga: **Mais informações → Executar assim mesmo**. |
| A mesa não abre ("Não foi possível iniciar a mesa") | A janela mostra o motivo e um botão **Tentar de novo**. Opção inválida (ex.: `--port`) também aparece ali. |
| App subiu em outra porta (3001…) | A 3000 estava ocupada (outra sessão aberta?). Use o endereço do painel *Convidar jogadores*, ou feche a outra sessão. |
| Página do jogador **fica carregando para sempre** (Tailscale) | Duas causas comuns: (1) o jogador não está na rede do mestre — no painel do Tailscale do mestre, o computador dele precisa aparecer em **Machines** (veja *Jogadores: conectando*, passo 2); (2) o Firewall do Windows do mestre liberou o app só em *Redes públicas*, mas o Tailscale é *Privada*. Para (2), no PowerShell como administrador: `New-NetFirewallRule -DisplayName "Jamal's Tabletop (Tailscale)" -Direction Inbound -Protocol TCP -LocalPort 3000-3010 -Profile Private -Action Allow` |
| Jogador não conecta pela LAN | Confira se estão na mesma rede e se o Firewall do Windows permitiu o app no tipo da sua rede (Privada ou Pública). Se negou sem querer, libere a porta (PowerShell como administrador): `New-NetFirewallRule -DisplayName "Jamal's Tabletop" -Direction Inbound -Protocol TCP -LocalPort 3000-3010 -Action Allow` |
| Mestre entrou como "Jogador" | Use o app na máquina do mestre (ou `http://localhost:3000`), ou o link de mestre (`?gm=`) do painel *Convidar jogadores*. |
| "Sala cheia" | Limite de 6 jogadores; aumente com `--max-players`. |

## Desenvolvimento

Para quem mexe no código. Requer **Node.js 20.12 ou mais novo** (testado no 24 LTS); no Windows: `winget install OpenJS.NodeJS.LTS`.

```bash
npm install
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor (3000) + Vite (5173) com hot reload. Mestre em `http://localhost:5173`, jogadores em `http://<ip>:5173` |
| `npm run typecheck` | `tsc` em shared, server, client e desktop |
| `npm test` | Testes de integração do servidor |
| `npm run build` | Gera `dist/server.cjs` (servidor num arquivo, via esbuild) e `dist/public/` (client) |
| `npm start` | Roda `node dist/server.cjs` (precisa do `build` antes). A pasta `dist/` roda em qualquer máquina com Node, sem `npm install` |
| `npm run app` | Compila e abre o app do mestre (Electron) sem empacotar — para testar a janela, o aviso ao fechar etc. |
| `npm run package` | Gera o app do **sistema atual** em `release/` (electron-builder, ADR-18): `.exe` portátil, `.dmg` ou `.AppImage` |
| `npm run icon` | Regera `assets/icon.ico` e `assets/icon.png` |

Regras do projeto (fluxo, testes, changelog, release e **padrões de interface**) estão no [CLAUDE.md](CLAUDE.md).

**Arte da tela de entrada:** coloque uma imagem em `client/src/assets/login-bg.jpg` (ou `.png`/`.webp`) e ela vira o fundo da tela de entrada no próximo build. Sem o arquivo, o fundo é o padrão (grid dourado).

### Fluxo de trabalho e CI

- A `master` é protegida: toda mudança vai numa branch (`feat/…`, `fix/…`, `docs/…`) e entra por Pull Request com os checks verdes.
- Checks de todo PR (aba **Checks**):
  - **Testes** no Linux e no Windows: typecheck, testes e build.
  - **Executáveis**: o app do mestre (Electron) de Windows, Linux e macOS, com teste de fumaça. Ficam 7 dias em **Artifacts** na página da execução — bom para testar antes do merge.
  - **Build e teste de fumaça** da imagem Docker.

### Publicar uma versão

O `CHANGELOG.md` e a versão **não são atualizados sozinhos**: a CI só confere.

1. Numa branch: atualize `version` no `package.json` (SemVer: correção → `1.1.1`, novidade → `1.2.0`), rode `npm install --package-lock-only` e mova as notas de *Não lançado* para `## [X.Y.Z] - AAAA-MM-DD` no [CHANGELOG.md](CHANGELOG.md) (e os links do rodapé). PR e merge.
2. Na `master` atualizada, crie e envie a tag:

   ```bash
   git tag v1.2.0
   ```

   ```bash
   git push origin v1.2.0
   ```

3. O workflow **Release** confere se a tag bate com o `package.json` e se o CHANGELOG tem a seção, gera o app dos 3 sistemas, publica a imagem no GHCR e cria a GitHub Release com as notas, os pacotes (`.exe`, `.dmg`, `.AppImage`) e o `SHA256SUMS.txt`.

Se a tag não bater com a versão, a release falha antes de publicar qualquer coisa: apague a tag (`git push --delete origin vX.Y.Z` e `git tag -d vX.Y.Z`), corrija e crie de novo.

### Estrutura

```
shared/   tipos do estado, contrato dos eventos Socket.IO, limites, regra de distância e versão
server/   Express + Socket.IO; estado em memória, ações (src/actions), permissões e filtro por papel
client/   Vite + React + Zustand; mapa com react-konva (src/map)
desktop/  app do mestre (Electron): janela, tela de abertura e aviso ao fechar; usa o startServer do server
scripts/  build (dist/), pacote do app (release/), ícone e notas de release
assets/   ícones do app
docs/     guia visual (identidade, paleta, componentes)
.github/  CI (testes, app dos 3 sistemas, Docker) e release
```

A versão do app é o campo `version` do `package.json` raiz: aparece na interface, no console e no `/healthz`.

## Status

| Entregável | Status |
|---|---|
| E1–E7 — Simulador jogável (sessão, combatentes, dados, mapa, iniciativa, magias, ciclo da batalha) | ✅ v1.0.0 |
| E8 — Preparação para distribuição | ✅ v1.1.0 |
| E9 — Imagem Docker | ✅ v1.1.0 |
| E10 — Executável (Node SEA; substituído pelo app Electron na 2.0) | ✅ v1.1.0 |
| E11 — CI/CD e releases | ✅ v1.1.0 |
| E13 — Correções e identidade (Jamal's Tabletop) | ✅ (próxima versão) |
| E14 — Base de UX (Mantine) | ✅ (próxima versão) |
| E15 — NPCs neutros e condições | ✅ (próxima versão) |
| E16 — Dados no combate | ✅ (próxima versão) |
| E17 — Mapa: rotação, escala e áreas de magia | ✅ (próxima versão) |
| E19 — Efeitos persistentes no mapa | ✅ (próxima versão) |
| E20 — Identidade visual "Grimório sombrio" | ✅ (próxima versão) |
| E18 — Salvar e carregar sessão | ✅ (próxima versão) |
| E12 — App do mestre com janela própria (Electron) | ✅ (próxima versão) |
