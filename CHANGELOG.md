# Changelog

Mudanças de cada versão do Jamal's Tabletop (antes chamado Simulador de Encontros). Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

A seção da versão vira o texto da GitHub Release. Antes de criar a tag `vX.Y.Z`, mova o que estiver em *Não lançado* para `## [X.Y.Z] - AAAA-MM-DD` e atualize `version` no `package.json`.

## [Não lançado]

### Alterado
- Tokens ganharam um contorno escuro fino, para se destacarem sobre efeitos (fogo, graxa…) e mapas de qualquer cor; o anel de seleção/turno ficou um pouco mais afastado. (E19)
- Rolagens do mestre agora são **ocultas por padrão** (desmarque "Rolagem oculta" para mostrar). (E16)
- Colunas laterais com no mínimo 260 px (antes 220): abaixo disso a iniciativa só mostrava a inicial do nome. Barra de rolagem das colunas mais fina. (E15)
- Botão do mestre no painel Aliados passa a "+ Aliado" (NPCs neutros têm seção própria); no bestiário, "+ Adicionar" virou "+ Mobs", ao lado de "+ NPC". (E15)
- O app agora se chama **Jamal's Tabletop**; os executáveis passam a `jamals-tabletop-<versão>-<sistema>-<arch>`, com "Jorge Mombach" como fabricante nas propriedades do `.exe` no Windows. (E13)
- Cada jogador cria **um personagem só**; para mudar nome, vida máxima ou mod. DES, use **✎ Editar**, agora no topo do painel *Selecionado*. O mestre continua criando quantos aliados quiser. (E13)
- Abreviações (DES, ft, Qtd., níveis de slot…) mostram explicação ao passar o mouse. (E13)
- Confirmações (remover personagem, encerrar combate, excluir template…) agora abrem uma janela do próprio app em vez do aviso do navegador. (E14)

### Adicionado
- **Efeitos persistentes no mapa:** *📌 Fixar como efeito* na ferramenta Área, com texturas próprias (Fogo, Água e Névoa animados; Graxa, Teia, Plantas, Raízes, Gelo, Escuridão) ou uma cor; ficam abaixo dos tokens. Duração em rounds contada no turno de quem conjurou, aviso ao acabar, vínculo com a *Concentração* do conjurador e painel *Efeitos no mapa* para ligar, desligar e remover. (E19)
- **Áreas de magia no mapa** (ferramenta *✦ Área*): cone, esfera, cilindro, linha e cubo com tamanho em pés, visíveis para todos como a régua. (E17)
- **Girar a imagem do mapa** em passos de 90° e **mudar o tamanho dela** (10%–400%) sem mexer no grid nem nos tokens. (E17)
- **Dados no combate:** blocos de *Ataque* (d20 + bônus, vantagem/desvantagem) e *Dano*; 20 natural no ataque aparece como "Crítico!" e marca *Crítico* no dano, que dobra os dados. O log agrupa as rolagens por turno ("Round 2 · Goblin 2"). (E16)
- **Trava por turno:** em combate, o jogador só rola na própria vez. Fora dela, rola quando o mestre faz um **pedido de rolagem** (ex.: "Resistência DES", uma vez por jogador, para todos ou alguns) ou ao usar a **Reação** (1 por round, até o turno mudar). O servidor recusa o resto com o motivo. (E16)
- **Rolar como:** a rolagem do mestre sai com o nome do mob/NPC da vez ("Goblin 2"); dá para trocar para outro combatente ou "Mestre". (E16)
- **Iniciativa de novo** (mestre): zera as iniciativas, rola mobs e NPCs e pausa o combate no mesmo round até os jogadores rolarem; *Retomar* continua o round. (E16)
- **NPCs neutros** (mestre): seção própria, criados avulsos ou pelo bestiário (botão *+ NPC* no template); token em hexágono; entram na iniciativa (o *Rolar mobs e NPCs* rola para eles também); jogadores os veem no mapa e na iniciativa, mas não a vida. (E15)
- **Condições** em qualquer combatente (lista do 5e + texto livre), com duração opcional em rounds que desconta no início do turno de quem tem; ao acabar, aviso para todos e registro no log. Aparecem no *Selecionado*, na iniciativa e como selo no token. O jogador põe e tira as do próprio personagem. (E15)
- **Visual novo e padronizado** (biblioteca Mantine): botões, campos, avisos e confirmações com o mesmo estilo em todo o app; fontes embutidas (funcionam sem internet). (E14)
- **Painéis laterais com largura ajustável:** arraste a borda entre a coluna e o mapa (duplo clique volta ao padrão; a largura fica salva no navegador). O mapa nunca fica com menos de 480 px. (E14)
- **Tamanho mínimo da tela (1024 × 640 px):** em janelas menores a página ganha barra de rolagem em vez de espremer os painéis. (E14)
- **Tela de entrada com arte:** emblema de d20 e fundo temático. (E14)
- Botão **Sair** na barra do topo: sai da sessão ou troca de nome sem perder o personagem, e o navegador para de entrar sozinho. (E13)
- README: como o jogador troca para a rede do mestre no Tailscale e o que fazer quando a página fica carregando para sempre. (E13)

### Corrigido
- Dois tokens podiam ficar na mesma casa; agora o servidor recusa ("Essa casa já está ocupada por …") e, ao soltar da lista numa casa ocupada, o token vai para a livre mais perto. (E17)
- Contorno de seleção/turno deslocado nos tokens de inimigo. (E13)
- Painéis laterais cortando botões e textos (ex.: linhas da iniciativa, "Iniciar combate"). (E13)
- Slider de deslocamento do grid que, no final, fazia o grid voltar ao início. (E13)
- Mobs de template com nome longo perdiam o número ("Goblin 1" e "Goblin 2" ficavam iguais): agora o nome é encurtado antes do número. (E13)

## [1.1.0] - 2026-10-23

Primeira versão distribuída: quem vai mestrar só baixa e abre.

### Adicionado
- **Executável** para Windows, Linux e macOS (Node SEA): dois cliques sobem a sessão e abrem o navegador do mestre; nada para instalar. Ícone e versão nas propriedades do arquivo no Windows. (E10)
- **Imagem Docker** no GitHub Container Registry, com healthcheck e usuário sem privilégios. (E9)
- **Link de mestre** (`/?gm=<chave>`): entrar como mestre de outro dispositivo ou no Docker. Chave fixa com `GM_KEY`. (E8)
- Opções por variável de ambiente ou argumento: `--port`, `--max-players`, `--no-open`, `--gm-key`, `--no-gm-loopback`, `--public-urls`, `--no-detect-addresses`, `--help`. (E8)
- Endpoint `/healthz` e versão do app visível na interface e no console. (E8)
- Releases automáticas: uma tag gera os executáveis, a imagem e as notas. (E11)

### Alterado
- Porta ocupada não derruba mais o servidor: ele usa a próxima livre e avisa. (E8)
- `npm start` roda o servidor empacotado (`dist/server.cjs`); requer `npm run build` antes. (E8)
- No Docker, os endereços de convite vêm de `PUBLIC_URLS` em vez dos IPs internos do container. (E9)

### Corrigido
- O link "abrir como mestre em outro dispositivo" (console e painel) usava `localhost`, que não abre em outro aparelho. (E9/E10)

## [1.0.0] - 2026-10-23

Primeira versão jogável (E1–E7), rodando pelo código-fonte com Node.

### Adicionado
- Sessão local com o mestre como host; jogadores entram pelo navegador (LAN ou VPN), até 6 por padrão, com reconexão.
- Combatentes: bestiário com templates, N mobs de uma vez, aliados dos jogadores; vida controlada à mão (mestre nos mobs, cada jogador no seu personagem); remoção de mob com desfazer.
- Dados d4–d100 com quantidade, modificador, expressão livre, vantagem/desvantagem e log compartilhado (rolagem oculta do mestre).
- Mapa com upload, grid calibrável (1 quadrado = 5 ft), tokens com avatar, movimento livre e régua compartilhada.
- Iniciativa (d20 + DES) com desempate, turnos e rounds, entrada no meio do combate.
- Slots de magia e lista de magias de referência, com "recuperar slots" e "restaurar tudo".
- Limpar o campo de batalha mantendo jogadores e personagens.

[Não lançado]: https://github.com/JorgeMombach/RpgTabletop/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/JorgeMombach/RpgTabletop/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/JorgeMombach/RpgTabletop/releases/tag/v1.0.0
