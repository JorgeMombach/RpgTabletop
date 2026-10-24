# Changelog

Mudanças de cada versão do Jamal's Tabletop (antes chamado Simulador de Encontros). Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

A seção da versão vira o texto da GitHub Release. Antes de criar a tag `vX.Y.Z`, mova o que estiver em *Não lançado* para `## [X.Y.Z] - AAAA-MM-DD` e atualize `version` no `package.json`.

## [Não lançado]

### Alterado
- O app agora se chama **Jamal's Tabletop**; os executáveis passam a `jamals-tabletop-<versão>-<sistema>-<arch>`, com "Jorge Mombach" como fabricante nas propriedades do `.exe` no Windows. (E13)
- Cada jogador cria **um personagem só**; para mudar nome, vida máxima ou mod. DES, use **✎ Editar**, agora no topo do painel *Selecionado*. O mestre continua criando quantos aliados quiser. (E13)
- Abreviações (DES, ft, Qtd., níveis de slot…) mostram explicação ao passar o mouse. (E13)

### Adicionado
- Botão **Sair** na barra do topo: sai da sessão ou troca de nome sem perder o personagem, e o navegador para de entrar sozinho. (E13)
- README: como o jogador troca para a rede do mestre no Tailscale e o que fazer quando a página fica carregando para sempre. (E13)

### Corrigido
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
