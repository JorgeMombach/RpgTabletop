import { Button, Group, Kbd, NumberInput, Portal, Text, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import {
  IconArrowBarToDown,
  IconArrowBigUpLine,
  IconChevronRight,
  IconDroplet,
  IconEye,
  IconEyeOff,
  IconFlame,
  IconHeartPlus,
  IconId,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { CONDITIONS, LIMITS, type ClientState, type CombatantView } from "@rpg/shared";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { act } from "../actions";
import { removeCombatant } from "../commands";
import { CombatantAvatar } from "../components/CombatantAvatar";
import { HpBar } from "../components/HpBar";
import { allCombatants, conditionLabel, conditionName, turnLocked } from "../format";
import { useT } from "../i18n";
import { select } from "../store";
import { CONDITION_ICONS, CONDITION_OTHER } from "./gameIcons";

/** Atalho que abriu o menu (L8): D = dano, C = cura (o Enter aplica esse), K = já com as condições. */
export type MenuFocus = "damage" | "heal" | "conditions";

/** Margem até a borda da janela ao encaixar o menu. */
const EDGE = 8;

/**
 * Menu de contexto do token (L8): botão direito no mapa, ou tocar e segurar no celular. Vida rápida (Enter =
 * dano, Shift+Enter = cura), condições em medalhões, ver no painel, tocha, esconder (mestre), tirar do mapa e
 * remover. As mesmas ações do painel Selecionado, com as mesmas permissões (o servidor confere de novo).
 */
export function TokenMenu({ state, id, x, y, focus, onClose }: { state: ClientState; id: string; x: number; y: number; focus?: MenuFocus; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const condRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [condOpen, setCondOpen] = useState(focus === "conditions");
  const [amount, setAmount] = useState<string | number>("");
  const c = allCombatants(state).find((o) => o.id === id);

  // Encaixa na janela: se não couber à direita ou embaixo do ponteiro, abre para o outro lado.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: x + width + EDGE > window.innerWidth ? Math.max(EDGE, x - width) : x,
      top: y + height + EDGE > window.innerHeight ? Math.max(EDGE, window.innerHeight - height - EDGE) : y,
    });
  }, [x, y]);

  // Fecha com Esc, clique fora ou a roda do mouse (zoom do mapa).
  useEffect(() => {
    const outside = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".token-menu")) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("wheel", outside, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("wheel", outside, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  // Saiu do jogo (removido por alguém): o menu some.
  useEffect(() => {
    if (!c) onClose();
  }, [c, onClose]);
  if (!c) return null;

  const gm = state.self.role === "gm";
  const canEdit = gm || (c.type === "ally" && c.ownerId === state.self.id);
  const moveLocked = turnLocked(state, "moveOnTurn");
  const knownHp = c.hp !== undefined && c.hpMax !== undefined;

  function applyHp(sign: 1 | -1) {
    const value = Math.abs(Math.trunc(Number(amount)));
    if (!value || !c) return;
    void act("hp:change", { id: c.id, delta: sign * value });
    setAmount("");
  }

  const run = (fn: () => unknown) => () => {
    fn();
    onClose();
  };

  return (
    <Portal>
      <div ref={ref} className="token-menu" role="menu" aria-label={t("menu.label", { name: c.name })} style={pos} onContextMenu={(e) => e.preventDefault()}>
        <Group gap={8} wrap="nowrap" className="token-menu-head">
          <CombatantAvatar c={c} size={28} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={700} truncate title={c.name}>
              {c.name}
            </Text>
            {knownHp && (
              <>
                <Text size="xs" c="dimmed">
                  {c.hp}/{c.hpMax}
                  {c.tempHp ? ` + ${c.tempHp}` : ""}
                </Text>
                <HpBar hp={c.hp!} hpMax={c.hpMax!} tempHp={c.tempHp} boss={c.boss} />
              </>
            )}
          </div>
        </Group>

        {canEdit && (
          <Group gap={4} wrap="nowrap" className="token-menu-hp">
            <Tooltip label={t("menu.amountTip")}>
              <NumberInput
                w={64}
                min={0}
                max={LIMITS.hpMax.max}
                allowDecimal={false}
                allowNegative={false}
                hideControls
                data-autofocus
                autoFocus
                placeholder={t("menu.amount")}
                aria-label={t("hp.amountLabel")}
                value={amount}
                onChange={setAmount}
                onKeyDown={(e) => {
                  // Enter aplica o do atalho (C = cura); Shift+Enter, o outro.
                  const heal = focus === "heal" ? !e.shiftKey : e.shiftKey;
                  if (e.key === "Enter") applyHp(heal ? 1 : -1);
                }}
              />
            </Tooltip>
            <Button variant="light" color="red" style={{ flex: 1 }} leftSection={<IconDroplet size={14} />} onClick={() => applyHp(-1)}>
              {t("menu.damage")}
            </Button>
            <Button variant="light" color="copper" style={{ flex: 1 }} leftSection={<IconHeartPlus size={14} />} onClick={() => applyHp(1)}>
              {t("menu.heal")}
            </Button>
          </Group>
        )}

        {canEdit && knownHp && c.hp! <= 0 && (
          <MenuItem icon={<IconArrowBigUpLine size={16} />} onClick={run(() => act("hp:change", { id: c.id, delta: 1 }))} onMouseEnter={() => setCondOpen(false)}>
            {t("hp.raise")}
          </MenuItem>
        )}
        {canEdit && (
          <MenuItem
            ref={condRef}
            icon={<IconSparkles size={16} />}
            kbd="K"
            open={condOpen}
            onClick={() => setCondOpen(true)}
            onMouseEnter={() => setCondOpen(true)}
            right={
              <>
                {c.conditions.length > 0 && <span className="token-menu-count">{c.conditions.length}</span>}
                <IconChevronRight size={14} color="var(--mantine-color-dark-3)" />
              </>
            }
          >
            {t("menu.conditions")}
          </MenuItem>
        )}
        <MenuItem icon={<IconId size={16} />} onClick={run(() => select(c.id))} onMouseEnter={() => setCondOpen(false)}>
          {t("menu.view")}
        </MenuItem>
        {canEdit && (
          <>
            <MenuItem icon={<IconFlame size={16} />} kbd="T" onClick={run(() => act("torch:set", { id: c.id, lit: !c.torch }))} onMouseEnter={() => setCondOpen(false)}>
              {c.torch ? t("torch.off") : t("menu.torchOn")}
            </MenuItem>
            {gm && c.type !== "ally" && (
              <MenuItem
                icon={c.hidden ? <IconEye size={16} /> : <IconEyeOff size={16} />}
                kbd="H"
                onClick={run(() => act("combatant:setHidden", { id: c.id, hidden: !c.hidden }))}
                onMouseEnter={() => setCondOpen(false)}
              >
                {c.hidden ? t("selected.reveal") : t("menu.hide")}
              </MenuItem>
            )}
            {c.pos && (
              <Tooltip label={t("rules.moveLocked")} disabled={!moveLocked} position="right">
                <MenuItem
                  icon={<IconArrowBarToDown size={16} />}
                  disabled={moveLocked}
                  onClick={run(() => !moveLocked && act("token:move", { id: c.id, pos: null }))}
                  onMouseEnter={() => setCondOpen(false)}
                >
                  {t("selected.offMap")}
                </MenuItem>
              </Tooltip>
            )}
            {(gm || c.type === "ally") && (
              <>
                <div className="token-menu-sep" />
                <MenuItem danger icon={<IconTrash size={16} />} kbd="Del" onClick={run(() => void removeCombatant(c))} onMouseEnter={() => setCondOpen(false)}>
                  {t("common.remove")}
                  {c.type === "ally" ? "…" : ""}
                </MenuItem>
              </>
            )}
          </>
        )}
      </div>
      {condOpen && canEdit && <ConditionGrid c={c} menu={ref} anchor={condRef} />}
    </Portal>
  );
}

function MenuItem({
  icon,
  children,
  right,
  kbd,
  danger = false,
  disabled = false,
  open = false,
  onClick,
  onMouseEnter,
  ref,
}: {
  icon: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  /** Tecla de atalho mostrada à direita (L8). */
  kbd?: string;
  danger?: boolean;
  disabled?: boolean;
  open?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <UnstyledButton
      ref={ref}
      role="menuitem"
      className={`token-menu-item${danger ? " danger" : ""}${open ? " open" : ""}`}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <span className="token-menu-icon">{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {kbd && <Kbd className="game-kbd small">{kbd}</Kbd>}
      {right}
    </UnstyledButton>
  );
}

/** Grade de condições ao lado do menu: os medalhões do token; clicar liga ou desliga. Embaixo, outra condição. */
function ConditionGrid({ c, menu, anchor }: { c: CombatantView; menu: React.RefObject<HTMLDivElement | null>; anchor: React.RefObject<HTMLButtonElement | null> }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState<string | number>("");

  // Ao lado do menu, na altura do item; sem espaço à direita, abre à esquerda.
  useLayoutEffect(() => {
    const m = menu.current?.getBoundingClientRect();
    const a = anchor.current?.getBoundingClientRect();
    const el = ref.current?.getBoundingClientRect();
    if (!m || !a || !el) return;
    const right = m.right + 4;
    setPos({
      left: right + el.width + EDGE > window.innerWidth ? Math.max(EDGE, m.left - el.width - 4) : right,
      top: Math.max(EDGE, Math.min(a.top - 8, window.innerHeight - el.height - EDGE)),
    });
  }, [menu, anchor]);

  function toggle(cond: string) {
    const on = c.conditions.find((k) => k.name === cond);
    if (on) void act("condition:remove", { id: c.id, conditionId: on.id });
    else void act("condition:add", { id: c.id, name: cond, rounds: null });
  }

  async function addOther() {
    if (!name.trim()) return;
    const res = await act("condition:add", { id: c.id, name: conditionName(name), rounds: rounds === "" ? null : Number(rounds) });
    if (res.ok) {
      setName("");
      setRounds("");
    }
  }

  return (
    <div ref={ref} className="token-menu token-menu-conditions" style={pos} onContextMenu={(e) => e.preventDefault()}>
      <Text ff="heading" fz={11} fw={700} tt="uppercase" c="bronze.4" mb={6} style={{ letterSpacing: "0.08em" }}>
        {t("menu.conditions")}
      </Text>
      <div className="token-menu-grid">
        {CONDITIONS.map((cond) => {
          const on = c.conditions.some((k) => k.name === cond);
          const label = conditionLabel(cond);
          return (
            <UnstyledButton key={cond} className={`token-menu-medal${on ? " on" : ""}`} aria-pressed={on} title={label} onClick={() => toggle(cond)}>
              <span className="disc">
                <svg viewBox="0 0 512 512" aria-hidden>
                  <path d={CONDITION_ICONS[cond] ?? CONDITION_OTHER} />
                </svg>
              </span>
              <span className="name">{label}</span>
            </UnstyledButton>
          );
        })}
      </div>
      <Group gap={4} wrap="nowrap" mt={8} pt={8} className="token-menu-other">
        <TextInput
          style={{ flex: 1 }}
          placeholder={t("menu.otherCondition")}
          aria-label={t("conditions.name")}
          value={name}
          maxLength={LIMITS.conditionName}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && void addOther()}
        />
        <Tooltip label={t("conditions.durationTip")}>
          <NumberInput w={48} min={1} hideControls allowDecimal={false} placeholder={t("conditions.rounds")} aria-label={t("conditions.duration")} value={rounds} onChange={setRounds} />
        </Tooltip>
        <Button variant="default" onClick={() => void addOther()} disabled={!name.trim()}>
          {t("menu.addCondition")}
        </Button>
      </Group>
    </div>
  );
}
