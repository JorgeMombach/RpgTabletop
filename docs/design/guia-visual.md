# Guia visual — Grimório sombrio (E20)

Identidade visual do Jamal's Tabletop, aprovada no E20. Referência viva (pranchas de fundamentos, componentes e tela do mestre): [Guia visual E20](https://claude.ai/artifact/3TGZPQiqzPR3wXAnUEBFzM) — privado; compartilhe pelo menu *Share* da página para outras pessoas abrirem.

**Clima:** taverna/grimório, intensidade **equilibrada** — o clima mora nas bordas, títulos e ícones; o conteúdo (listas, números, campos) continua limpo e legível por horas de jogo. Tema sempre escuro. Tudo embutido no app (fontes e ícones), funciona offline.

Implementação: tokens em `client/src/theme.ts` (cores Mantine) e peças sem equivalente no Mantine em `client/src/styles.css`.

## Paleta

| Nome | Cor | Uso | No tema |
|---|---|---|---|
| Tinta | `#141218` | Fundo da página e das colunas | `dark.9` / `--mantine-color-body` |
| Couro | `#1F1B25` | Painéis (placas) | `dark.7` |
| Couro claro | `#2B2433` | Linhas destacadas, botões secundários, hover | `dark.6` |
| Costura | `#3D3446` | Bordas e divisórias | `dark.5` |
| Bronze | `#A9844F` | Ação principal, borda de destaque, cantos das placas | `bronze.6` (cor primária) |
| Bronze claro | `#D8B47A` | Títulos, marca, "na vez", seleção | `bronze.4` |
| Verde-cobre | `#2F7D65` | Cor secundária: selos (Round), cura, sucesso, condições | `copper.6` |
| Cobre claro | `#4FAE8C` | Vida alta, 20 natural, confirmações | `copper.4` |
| Sangue | `#A8323A` | Dano, remover, perigo, vida baixa | `red.6` (substitui o vermelho do Mantine) |
| Pergaminho | `#ECE4D4` | Texto principal | `dark.0` |
| Pergaminho gasto | `#B9AE9C` | Texto secundário | `dark.2` |
| Cinza de vela | `#8A8073` | Dicas, rótulos pequenos | `dark.3` |

Cores que **não** mudam (identificam combatentes): azul dos aliados (`player`), tons quentes dos mobs, tons neutros dos NPCs, e as texturas dos efeitos (E19).

Campos de texto ficam um tom **abaixo** do painel (`#15121A`), para parecerem "afundados" na placa.

## Tipografia

| Uso | Fonte | Peso · tamanho |
|---|---|---|
| Marca e títulos de tela | **Cinzel** | 700 · 24 (marca no topo: 18) |
| Título de painel | **Cinzel**, caixa alta, espaçamento 0,12 em | 700 · 12–13 |
| Números de destaque (vida, total do dado) | Alegreya Sans | 700 · 20–28 |
| Nomes nas listas | Alegreya Sans | 500 · 14–16 |
| Texto de interface | **Alegreya Sans** | 400 · 14 |
| Dicas e rótulos | Alegreya Sans | 400 · 12 |

Cinzel **só** em títulos (nunca em botões ou texto corrido). Escala 12/14/16/20/24; espaçamentos em múltiplos de 4 px.

## Componentes

- **Placa (painel lateral):** fundo couro, borda costura de 1 px, raio 6 px, leve brilho interno no topo e sombra; **cantos ornamentados** em bronze (cantoneira de 2 px no canto superior esquerdo e no inferior direito). Título: losango de bronze + texto em Cinzel + filete que se desfaz para a direita; selos/ações à direita.
- **Botões:** principal = bronze com texto escuro e borda bronze claro (uma ação principal por painel); secundário = couro claro com borda costura; perigo = contorno sangue, texto rosado; discreto = só texto.
- **Selos (badges):** Round = verde-cobre; Mestre = couro claro com borda bronze; Jogador = azul escuro; Abatido = sangue; "Não salvo" = âmbar.
- **Condições:** pílulas arredondadas verde-cobre; negativas (envenenado…) em sangue; Concentração em bronze.
- **Linha da vez (iniciativa):** fundo couro claro, borda bronze, seta e número em bronze claro.
- **Barra de vida:** trilho afundado (`#15121A` com borda costura); cobre claro → bronze → sangue conforme cai.
- **Log de dados:** cartão afundado; cabeçalho do turno em Cinzel pequena ("ROUND 2 · GOBLIN 2"); 20 natural em cobre claro com "CRÍTICO".
- **Avisos (toasts):** placa com borda bronze e ícone à esquerda (sem faixa colorida lateral).
- **Barra do topo:** um tom acima da tinta, filete bronze sutil embaixo; marca com ícone de d20 + "Jamal's Tabletop" em Cinzel bronze claro.
- **Barra do mapa:** uma placa flutuante; ferramenta ativa em bronze.
- **Tokens:** como no E19 (contorno escuro); anel da vez em bronze claro tracejado.

## Ícones

Biblioteca **Tabler** (`@tabler/icons-react`), traço 1,6–1,8 px, sempre na cor do texto ao redor. **Nada de emoji** na interface. Ornamentos e ícones de jogo desenhados no mapa (moldura de chefe e, depois, condições) vêm do **game-icons.net** (CC BY 3.0, crédito na tela *Sobre*), pintados no código com o kit visual (`client/src/map/tokenArt.ts`).

| Uso | Ícone Tabler |
|---|---|
| Marca, dados, rolar | `IconDice` / d20 desenhado no emblema |
| Ataque | `IconSword` |
| Aliado / defesa | `IconShield` |
| Mob abatido | `IconSkull` |
| Vida | `IconHeart` |
| Restaurar | `IconFlask` |
| Efeito no mapa | `IconFlame` |
| Área | `IconSparkles` |
| Régua | `IconRuler2` |
| Mover | `IconHandStop` |
| Turno / round | `IconHourglass` |
| Magias | `IconScript` |
| Salvar / carregar | `IconDeviceFloppy` / `IconFolderOpen` |
| Editar | `IconPencil` |
| Remover | `IconTrash` |
| Limpar campo | `IconBrush` |
| Fixar efeito | `IconPin` |
| Fechar / tirar | `IconX` |
| Anterior / próximo | `IconPlayerTrackPrev` / `IconPlayerTrackNext` |
| Subir / descer | `IconChevronUp` / `IconChevronDown` |
| Recolher painel | `IconChevronDown` |

Para um uso novo, escolha em [tabler.io/icons](https://tabler.io/icons) a versão de contorno (*outline*).
