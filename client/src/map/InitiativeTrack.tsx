import { Group, Popover, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconCaretRightFilled, IconHourglass } from "@tabler/icons-react";
import { groupName, type ClientState, type CombatantView } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { CombatantAvatar } from "../components/CombatantAvatar";
import { groupsOf } from "../components/InitiativePanel";
import { allCombatants } from "../format";
import { useT } from "../i18n";
import { select, useApp } from "../store";
import { initials } from "./geometry";
import { tokenArt, type FrameKind } from "./tokenArt";
import { useImage } from "./useImage";

/** Tamanhos na trilha (px): a vez, os outros, e quanto cada peça ocupa (com o espaço entre elas). */
const BIG = 60;
const SMALL = 44;
const GAP = 6;
/** Grupo de mobs: o token de trás aparece à direita. */
const GROUP_EXTRA = 12;
/** Round à esquerda, marcador do próximo round, "+N" e o acolchoado da faixa. */
const ROUND_W = 52;
const NEXT_W = 36;
const MORE_W = 44;
const PAD = 20;
/** Largura máxima da faixa: com muita gente ela não cresce; o resto fica na lista do "+N". */
const MAX_W = 720;

interface Block {
  members: CombatantView[];
  /** Já agiu neste round: só volta depois do marcador do próximo round. */
  done: boolean;
}

/**
 * Trilha de iniciativa no topo do mapa (L7), só durante o combate: a vez primeiro (maior, com halo e o nome),
 * depois quem vem; um marcador separa quem já agiu e só volta no round seguinte. Os tokens são os mesmos do
 * mapa (kit visual). Clicar seleciona e leva a câmera até o token. Não cabe tudo: "+N" no fim.
 */
export function InitiativeTrack({ state, width, onFocus }: { state: ClientState; width: number; onFocus: (c: CombatantView) => void }) {
  const t = useT();
  const reduceFx = useApp((s) => s.reduceFx);
  const { combat } = state.battle;
  if (!combat.active) return null;

  const byId = new Map(allCombatants(state).map((c) => [c.id, c]));
  // Oculto fica fora da trilha (também para o mestre): é surpresa até ser revelado.
  const order = combat.order.map((id) => byId.get(id)).filter((c): c is CombatantView => !!c && !c.hidden);
  if (order.length === 0) return null;
  const currentId = combat.order[combat.turnIndex];
  const blocks = groupsOf(order);
  const at = Math.max(0, blocks.findIndex((b) => b.members.some((c) => c.id === currentId)));
  const ring: Block[] = [...blocks.slice(at), ...blocks.slice(0, at)].map((b, k) => ({ members: b.members, done: k >= blocks.length - at }));
  const delayed = combat.delayed?.round === combat.round ? new Set(combat.delayed.ids) : new Set<string>();

  // Quantos cabem na largura do mapa (a vez sempre entra).
  let room = Math.min(MAX_W, Math.max(0, width - 24)) - PAD - ROUND_W - (BIG + GAP);
  let shown = 1;
  for (let k = 1; k < ring.length; k++) {
    const need = (ring[k].members.length > 1 ? SMALL + GROUP_EXTRA : SMALL) + GAP + (ring[k].done && !ring[k - 1].done ? NEXT_W : 0);
    const last = k === ring.length - 1;
    if (room - need < (last ? 0 : MORE_W)) break;
    room -= need;
    shown++;
  }
  const hidden = ring.slice(shown).reduce((n, b) => n + b.members.length, 0);

  return (
    <nav className={`init-track${reduceFx ? " still" : ""}`} aria-label={t("track.label")}>
      <span className="init-track-round">
        <small>{t("track.round")}</small>
        {combat.round}
      </span>
      {ring.slice(0, shown).map((b, k) => (
        <TrackBlock
          key={b.members[0].id}
          block={b}
          current={k === 0}
          marker={k > 0 && b.done && !ring[k - 1].done ? combat.round + 1 : null}
          delayed={b.members.some((c) => delayed.has(c.id))}
          onFocus={onFocus}
        />
      ))}
      {hidden > 0 && <OrderList ring={ring} round={combat.round} selfId={state.self.id} hidden={hidden} onFocus={onFocus} />}
    </nav>
  );
}

function TrackBlock({
  block,
  current,
  marker,
  delayed,
  onFocus,
}: {
  block: Block;
  current: boolean;
  marker: number | null;
  delayed: boolean;
  onFocus: (c: CombatantView) => void;
}) {
  const t = useT();
  const { members, done } = block;
  const head = members[0];
  const group = members.length > 1;
  const name = group ? groupName(members.map((c) => c.name)) : head.name;
  const size = current ? BIG : SMALL;
  // Vida da trilha: soma do grupo; só aparece para quem recebe a vida (o jogador não vê a dos mobs).
  const known = members.filter((c) => c.hp !== undefined && c.hpMax !== undefined);
  const hp = known.reduce((n, c) => n + Math.max(0, c.hp!), 0);
  const max = known.reduce((n, c) => n + c.hpMax!, 0);
  const ratio = max > 0 ? hp / max : null;
  const down = members.every((c) => c.hp !== undefined && c.hp <= 0);
  // Num grupo, a câmera vai para o primeiro que está no mapa.
  const target = members.find((c) => c.pos) ?? head;

  return (
    <>
      {marker !== null && (
        <Tooltip label={t("track.nextRound", { round: marker })}>
          <span className="init-track-next">R{marker}</span>
        </Tooltip>
      )}
      <Tooltip label={t("track.tip", { name, init: head.initiative ?? "—" })}>
        <button
          type="button"
          className={`init-chip${current ? " current" : ""}${done ? " done" : ""}${group ? " group" : ""}`}
          aria-label={name}
          aria-current={current ? "step" : undefined}
          onClick={() => {
            select(target.id);
            if (target.pos) onFocus(target);
          }}
        >
          <span className="init-chip-face">
            {group && <TokenCanvas c={members[1]} size={size * 0.86} down={down} back />}
            <TokenCanvas c={head} size={size} down={down} />
            {group && <span className="init-chip-count">×{members.length}</span>}
            {delayed && (
              <span className="init-chip-mark" title={t("track.delayed")}>
                <IconHourglass size={11} />
              </span>
            )}
          </span>
          {ratio !== null && (
            <span className="init-chip-hp">
              <i style={{ width: `${ratio * 100}%`, background: ratio > 0.5 ? "#7fc06a" : ratio > 0.25 ? "#e0b050" : "#d0443a" }} />
            </span>
          )}
          {current && <span className="init-chip-plate">{name}</span>}
        </button>
      </Tooltip>
    </>
  );
}

/** O token do mapa (moldura e retrato do kit visual) num canvas pequeno. */
function TokenCanvas({ c, size, down, back = false }: { c: CombatantView; size: number; down: boolean; back?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const avatar = useImage(c.avatar);
  const kind: FrameKind = c.type === "npc" ? "npc" : c.type === "mob" ? "mob" : "ally";
  const boss = c.boss === true && c.type !== "ally";
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.height = Math.round(size * dpr);
    const ctx = cv.getContext("2d")!;
    // Raio = metade da peça; a imagem cobre um pouco mais (ornamentos), então cabe pela extensão dela.
    const art = tokenArt({ kind, boss, r: size / 2, color: c.color, avatar, initials: initials(c.name), down }, dpr * 1.5);
    const k = (size / 2 / art.extent) * dpr;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(art.canvas, cv.width / 2 - art.extent * k, cv.height / 2 - art.extent * k, art.extent * 2 * k, art.extent * 2 * k);
  }, [kind, boss, size, c.color, c.name, avatar, down]);
  return <canvas ref={ref} className={back ? "back" : undefined} style={{ width: size, height: size }} aria-hidden />;
}

/**
 * "+N" no fim da trilha: abre a ordem inteira numa lista simples (passar o mouse ou tocar), a partir da vez,
 * com os seus personagens destacados e "Sua vez daqui a N". Clicar numa linha leva a câmera até o token.
 */
function OrderList({ ring, round, selfId, hidden, onFocus }: { ring: Block[]; round: number; selfId: string; hidden: number; onFocus: (c: CombatantView) => void }) {
  const t = useT();
  const [opened, setOpened] = useState(false);
  const closing = useRef(0);
  // Mouse: abre ao passar e fecha um instante depois de sair (dá tempo de chegar na lista). Toque: o clique abre e tocar fora fecha.
  const hover = {
    onMouseEnter: () => {
      window.clearTimeout(closing.current);
      setOpened(true);
    },
    onMouseLeave: () => {
      closing.current = window.setTimeout(() => setOpened(false), 200);
    },
  };
  useEffect(() => () => window.clearTimeout(closing.current), []);
  const mine = ring.findIndex((b) => b.members.some((c) => c.ownerId === selfId));

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" shadow="md" width={260} withinPortal={false}>
      <Popover.Target>
        <UnstyledButton className="init-track-more" aria-label={t("track.showAll")} aria-expanded={opened} onClick={() => setOpened(true)} {...hover}>
          +{hidden}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p="xs" {...hover}>
        <Stack gap={4}>
          <Group justify="space-between" wrap="nowrap">
            <Text ff="heading" size="sm" fw={700} c="bronze.4">
              {t("track.listTitle")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("top.round", { round })}
            </Text>
          </Group>
          {mine >= 0 && (
            <Text size="xs" c="bronze.4" fw={600}>
              {mine === 0 ? t("track.yourTurnNow") : t("track.yourTurnIn", { n: mine })}
            </Text>
          )}
          <ol className="init-order">
            {ring.map((b, k) => {
              const head = b.members[0];
              const name = b.members.length > 1 ? groupName(b.members.map((c) => c.name)) : head.name;
              const own = b.members.some((c) => c.ownerId === selfId);
              const target = b.members.find((c) => c.pos) ?? head;
              return (
                <li key={head.id}>
                  {k > 0 && b.done && !ring[k - 1].done && <div className="init-order-next">{t("track.nextRound", { round: round + 1 })}</div>}
                  <UnstyledButton
                    className={`init-order-row${k === 0 ? " current" : ""}${b.done ? " done" : ""}`}
                    onClick={() => {
                      select(target.id);
                      if (target.pos) onFocus(target);
                      setOpened(false);
                    }}
                  >
                    <Text component="span" size="xs" c={k === 0 ? "bronze.4" : "dimmed"} w={36} style={{ flex: "none", display: "flex", alignItems: "center", gap: 2 }}>
                      {k === 0 ? (
                        <>
                          <IconCaretRightFilled size={10} />
                          {t("track.now")}
                        </>
                      ) : (
                        k
                      )}
                    </Text>
                    <CombatantAvatar c={head} size={20} />
                    <Text size="sm" truncate c={own ? "bronze.4" : undefined} fw={k === 0 || own ? 600 : 400} style={{ flex: 1, minWidth: 0 }} title={name}>
                      {name}
                      {b.members.length > 1 && ` ×${b.members.length}`}
                      {own && (
                        <Text span size="xs" c="dimmed" fw={400}>
                          {" "}
                          {t("common.yours")}
                        </Text>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ flex: "none" }}>
                      {head.initiative ?? "—"}
                    </Text>
                  </UnstyledButton>
                </li>
              );
            })}
          </ol>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
