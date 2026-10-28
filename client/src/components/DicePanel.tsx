import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconWindowMaximize } from "@tabler/icons-react";
import { DICE, LIMITS, type ActionPayloads, type ClientState, type CombatantView, type OutsideRolls, type RollMode } from "@rpg/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { act } from "../actions";
import { useT, type MessageKey } from "../i18n";
import { bringLogBack, popOutLog } from "../logWindow";
import { allCombatants } from "../format";
import { setDicePrefs, useApp } from "../store";
import { Abbr } from "./Abbr";
import { Panel } from "./Panel";
import { naturalD20, RollLog } from "./RollLog";

const MODES: { value: RollMode; label: MessageKey }[] = [
  { value: "normal", label: "dice.normal" },
  { value: "adv", label: "dice.adv" },
  { value: "dis", label: "dice.dis" },
];

const ATTACK_KEY = "rpg.attack";
const AS_MASTER = "__mestre";

function buildExpr(count: number, faces: number, mod: number) {
  const m = mod === 0 ? "" : mod > 0 ? `+${mod}` : `${mod}`;
  return `${count}d${faces}${m}`;
}

/** Crítico: dobra só a quantidade de dados ("2d6+3" → "4d6+3"). O modificador não muda. */
export function doubleDice(expr: string): string {
  return expr.replace(/(\d*)\s*d\s*(\d+|%)/gi, (_, n: string, faces: string) => `${(Number(n) || 1) * 2}d${faces}`);
}

/** Último ataque e dano usados, lembrados por navegador (ataques não ficam salvos no servidor). */
function readAttack(): { mod: number; damage: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(ATTACK_KEY) ?? "{}");
    return { mod: Number(saved.mod) || 0, damage: typeof saved.damage === "string" ? saved.damage : "" };
  } catch {
    return { mod: 0, damage: "" };
  }
}

function saveAttack(value: { mod: number; damage: string }) {
  try {
    localStorage.setItem(ATTACK_KEY, JSON.stringify(value));
  } catch {
    // ignora
  }
}

/** Combatentes que o mestre controla: mobs, NPCs e os aliados criados por ele. */
function gmSide(state: ClientState): CombatantView[] {
  return [...state.battle.mobs, ...state.battle.npcs, ...state.allies.filter((a) => a.ownerId === state.self.id)];
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.04em" }}>
      {children}
    </Text>
  );
}

/** `inline` = tela de celular (E23): o log fica sempre no painel, sem janela flutuante. */
export function DicePanel({ state, inline = false }: { state: ClientState; inline?: boolean }) {
  const t = useT();
  const logDetached = useApp((s) => s.logDetached) && !inline;
  const logOut = useApp((s) => s.logOut);
  const gm = state.self.role === "gm";
  const { combat, rolls } = state.battle;
  const saved = useState(readAttack)[0];
  const [count, setCount] = useState<string | number>(1);
  const [mod, setMod] = useState<string | number>(0);
  const [mode, setMode] = useState<RollMode>("normal");
  const [expr, setExpr] = useState("");
  const [attackMod, setAttackMod] = useState<string | number>(saved.mod);
  const [damage, setDamage] = useState(saved.damage);
  const [crit, setCrit] = useState(false);
  // Mestre rola atrás do escudo por padrão (SPEC E16); desmarca para mostrar.
  const [hidden, setHidden] = useState(gm);
  const selectedId = useApp((s) => s.selectedId);
  const rolling = useApp((s) => s.rolling);
  // Escolha manual do "rolar como" vale até a seleção ou o turno mudar.
  const asKey = `${combat.turn}:${selectedId ?? ""}`;
  const [asChoice, setAsChoice] = useState<{ key: string; id: string } | null>(null);

  const current = combat.active ? allCombatants(state).find((c) => c.id === combat.order[combat.turnIndex]) : undefined;
  const side = gm ? gmSide(state) : [];
  // "Rolar como" (E26): o combatente selecionado do lado do mestre; senão, o da vez; senão, Mestre.
  const defaultAs = side.find((c) => c.id === selectedId)?.id ?? (current && side.some((c) => c.id === current.id) ? current.id : AS_MASTER);
  const asId = asChoice && asChoice.key === asKey && (asChoice.id === AS_MASTER || side.some((c) => c.id === asChoice.id)) ? asChoice.id : defaultAs;

  // Trava por turno: o servidor também recusa; aqui só desabilita e explica.
  const me = state.self.id;
  const myTurn = current?.ownerId === me;
  const request = rolls.request;
  const requested = !!request && request.playerIds.includes(me) && !request.done.includes(me);
  const reactionOpen = rolls.reactions.some((r) => r.playerId === me && r.turn === combat.turn);
  const reactionUsed = rolls.reactions.some((r) => r.playerId === me && r.round === combat.round);
  const outside = rolls.outside;
  const locked = !gm && (combat.active ? !myTurn && !requested && !reactionOpen : outside !== "free" && !requested);
  // Antispam (E26): enquanto os dados desta pessoa caem na tela, não rola de novo.
  const waiting = !gm && state.log.some((e) => e.authorId === me && rolling.includes(e.id));
  const blocked = locked || waiting;

  async function roll(payload: ActionPayloads["dice:roll"]) {
    return act("dice:roll", { ...payload, hidden: gm && hidden, asId: gm && asId !== AS_MASTER ? asId : undefined });
  }

  function rollDie(faces: number) {
    const n = Math.max(1, Math.trunc(Number(count)) || 1);
    const m = Math.trunc(Number(mod)) || 0;
    // Vantagem/desvantagem só faz sentido num único d20.
    const useMode = faces === 20 ? mode : "normal";
    void roll({ expr: buildExpr(useMode === "normal" ? n : 1, faces, m), mode: useMode });
  }

  async function rollExpr(e: FormEvent) {
    e.preventDefault();
    if (!expr.trim()) return;
    const res = await roll({ expr, mode });
    if (res.ok) setExpr("");
  }

  async function rollAttack(e: FormEvent) {
    e.preventDefault();
    const m = Math.trunc(Number(attackMod)) || 0;
    saveAttack({ mod: m, damage });
    const res = await roll({ expr: buildExpr(1, 20, m), mode, kind: "attack" });
    if (!res.ok) return;
    // O estado novo chega antes do ack: dá para ver se foi 20 natural e já marcar o crítico.
    const entry = useApp.getState().state?.log.find((l) => l.id === res.ids?.[0]);
    setCrit(!!entry?.roll && naturalD20(entry.roll.terms) === 20);
  }

  async function rollDamage(e: FormEvent) {
    e.preventDefault();
    if (!damage.trim()) return;
    saveAttack({ mod: Math.trunc(Number(attackMod)) || 0, damage });
    const res = await roll({ expr: crit ? doubleDice(damage) : damage, kind: "damage", crit });
    if (res.ok) setCrit(false);
  }

  return (
    <Panel title={t("dice.title")}>
      {gm && side.length > 0 && (
        <Tooltip label={t("dice.asTip")}>
          <Select
            label={t("dice.as")}
            data={[{ value: AS_MASTER, label: t("common.gm") }, ...side.map((c) => ({ value: c.id, label: c.name }))]}
            value={asId}
            onChange={(v) => setAsChoice(v ? { key: asKey, id: v } : null)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </Tooltip>
      )}

      {!gm && combat.active && <TurnLock state={state} myTurn={myTurn} requested={requested} reactionOpen={reactionOpen} reactionUsed={reactionUsed} />}
      {!gm && !combat.active && outside !== "free" && <OutsideLock state={state} requested={requested} />}
      {gm && !combat.active && <OutsideControl mode={outside} />}
      {gm && <RequestControl state={state} />}
      {waiting && (
        <Text size="xs" c="dimmed">
          {t("dice.waiting")}
        </Text>
      )}

      <SectionTitle>{t("dice.attack")}</SectionTitle>
      <Group component="form" gap="xs" wrap="nowrap" align="flex-end" onSubmit={rollAttack}>
        <Tooltip label={t("dice.attackBonusTip")}>
          <NumberInput
            w={96}
            leftSection={<Text size="xs" c="dimmed">d20 +</Text>}
            leftSectionWidth={40}
            allowDecimal={false}
            value={attackMod}
            onChange={setAttackMod}
            aria-label={t("dice.attackBonus")}
          />
        </Tooltip>
        <Button type="submit" style={{ flex: 1 }} disabled={blocked}>
          {t("dice.rollAttack")}
        </Button>
      </Group>
      <Tooltip label={t("dice.modeTip")}>
        <SegmentedControl data={MODES.map((m) => ({ value: m.value, label: t(m.label) }))} value={mode} onChange={(v) => setMode(v as RollMode)} aria-label={t("dice.mode")} />
      </Tooltip>

      <SectionTitle>{t("dice.damage")}</SectionTitle>
      <Group component="form" gap="xs" wrap="nowrap" onSubmit={rollDamage}>
        <TextInput
          style={{ flex: 1, minWidth: 0 }}
          value={damage}
          maxLength={LIMITS.dice.exprLength}
          onChange={(e) => setDamage(e.currentTarget.value)}
          placeholder={t("dice.damagePlaceholder")}
          aria-label={t("dice.damage")}
        />
        <Button type="submit" disabled={blocked || !damage.trim()}>
          {t("dice.rollDamage")}
        </Button>
      </Group>
      <Tooltip label={t("dice.critTip")}>
        <Checkbox checked={crit} onChange={(e) => setCrit(e.currentTarget.checked)} label={crit && damage.trim() ? t("dice.critWith", { expr: doubleDice(damage) }) : t("dice.crit")} />
      </Tooltip>

      <Divider label={t("dice.free")} labelPosition="left" />
      <SimpleGrid cols={4} spacing={6} verticalSpacing={6}>
        {DICE.map((f) => (
          <Tooltip key={f} label={t("dice.rollDie", { expr: `${Number(count) > 1 ? `${count}` : "1"}d${f}${Number(mod) ? ` ${Number(mod) > 0 ? "+" : ""}${mod}` : ""}` })}>
            <Button variant="default" size="sm" fw={700} px={0} disabled={blocked} onClick={() => rollDie(f)}>
              d{f}
            </Button>
          </Tooltip>
        ))}
      </SimpleGrid>

      <Group grow gap="sm" align="flex-start">
        <NumberInput
          label={<Abbr title={t("dice.countTitle")}>{t("dice.count")}</Abbr>}
          min={1}
          max={LIMITS.dice.count}
          allowDecimal={false}
          allowNegative={false}
          clampBehavior="strict"
          value={count}
          onChange={setCount}
        />
        <NumberInput label={t("dice.modifier")} allowDecimal={false} value={mod} onChange={setMod} />
      </Group>

      <Group component="form" gap="xs" wrap="nowrap" onSubmit={rollExpr}>
        <TextInput
          style={{ flex: 1, minWidth: 0 }}
          value={expr}
          maxLength={LIMITS.dice.exprLength}
          onChange={(e) => setExpr(e.currentTarget.value)}
          placeholder={t("dice.exprPlaceholder")}
          aria-label={t("dice.expr")}
        />
        <Button type="submit" disabled={blocked || !expr.trim()}>
          {t("dice.roll")}
        </Button>
      </Group>

      {gm && <Checkbox checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} label={t("dice.hidden")} />}

      <Divider />
      <LogHeader canDetach={!inline} />
      {logOut && !inline ? (
        <Group gap="xs" wrap="nowrap" justify="space-between">
          <Text size="xs" c="dimmed">
            {t("logWindow.isOut")}
          </Text>
          <Button size="compact-xs" variant="default" onClick={bringLogBack} style={{ flex: "none" }}>
            {t("logWindow.bringBack")}
          </Button>
        </Group>
      ) : logDetached ? (
        <Text size="xs" c="dimmed">
          {t("dice.logFloating")}
        </Text>
      ) : (
        <RollLog log={state.log} selfId={state.self.id} />
      )}
    </Panel>
  );
}

/** Cabeçalho do log (E22): animação dos dados no centro e destacar o log numa janela. Valem só para este navegador. */
function LogHeader({ canDetach }: { canDetach: boolean }) {
  const t = useT();
  const diceAnim = useApp((s) => s.diceAnim);
  const logDetached = useApp((s) => s.logDetached || s.logOut) || !canDetach;
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Tooltip label={t("dice.animTip")}>
        <Switch size="xs" label={t("dice.anim")} checked={diceAnim} onChange={(e) => setDicePrefs({ diceAnim: e.currentTarget.checked })} />
      </Tooltip>
      {!logDetached && (
        <Tooltip label={t("logWindow.detachTip")}>
          <ActionIcon size="sm" aria-label={t("logWindow.open")} onClick={() => popOutLog()}>
            <IconWindowMaximize size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

/** Jogador em combate: de quem é a vez e o que pode rolar fora dela. */
function TurnLock(props: { state: ClientState; myTurn: boolean; requested: boolean; reactionOpen: boolean; reactionUsed: boolean }) {
  const { state, myTurn, requested, reactionOpen, reactionUsed } = props;
  const t = useT();
  if (myTurn) return null;
  if (requested)
    return (
      <Alert variant="light" color="bronze" p="xs" title={t("dice.requested", { label: state.battle.rolls.request?.label ?? "" })}>
        <Text size="xs">{t("dice.rollOnce")}</Text>
      </Alert>
    );
  if (reactionOpen)
    return (
      <Alert variant="light" color="bronze" p="xs" title={t("dice.reactionOpen")}>
        <Text size="xs">{t("dice.reactionUntil")}</Text>
      </Alert>
    );
  return (
    <Group gap="xs" wrap="nowrap" justify="space-between">
      <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
        {t("dice.offTurn")}
      </Text>
      <Tooltip label={reactionUsed ? t("dice.reactionUsed") : t("dice.reactionTip")}>
        <Button variant="default" disabled={reactionUsed} onClick={() => act("reaction:use", {})} style={{ flex: "none" }}>
          {t("dice.useReaction")}
        </Button>
      </Tooltip>
    </Group>
  );
}

const OUTSIDE: { value: OutsideRolls; label: MessageKey }[] = [
  { value: "free", label: "dice.outsideFree" },
  { value: "request", label: "dice.outsideRequest" },
  { value: "locked", label: "dice.outsideLocked" },
];

/** Mestre, fora de combate (E26): os jogadores rolam livres, só quando ele pedir, ou nada. */
function OutsideControl({ mode }: { mode: OutsideRolls }) {
  const t = useT();
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        {t("dice.outside")}
      </Text>
      <Tooltip label={t("dice.outsideTip")}>
        <SegmentedControl
          fullWidth
          data={OUTSIDE.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={mode}
          onChange={(v) => act("roll:outside", { mode: v as OutsideRolls })}
          aria-label={t("dice.outside")}
        />
      </Tooltip>
    </Stack>
  );
}

/** Jogador fora de combate com as rolagens limitadas pelo mestre (E26). */
function OutsideLock({ state, requested }: { state: ClientState; requested: boolean }) {
  const t = useT();
  if (requested)
    return (
      <Alert variant="light" color="bronze" p="xs" title={t("dice.requested", { label: state.battle.rolls.request?.label ?? "" })}>
        <Text size="xs">{t("dice.rollOnce")}</Text>
      </Alert>
    );
  return (
    <Text size="xs" c="dimmed">
      {state.battle.rolls.outside === "locked" ? t("dice.lockedByGm") : t("dice.waitRequest")}
    </Text>
  );
}

/** Mestre: pedir uma rolagem fora da vez (ex.: "Resistência DES") a todos ou a alguns jogadores. */
function RequestControl({ state }: { state: ClientState }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [who, setWho] = useState<string[]>([]);
  const request = state.battle.rolls.request;
  const players = state.players.filter((p) => p.role === "player");
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  if (request)
    return (
      <Alert variant="light" color="bronze" p="xs" title={t("dice.request", { label: request.label })}>
        <Stack gap={6}>
          <Text size="xs">
            {request.playerIds.map((id) => `${request.done.includes(id) ? "✓" : "…"} ${nameOf(id)}`).join(" · ")}
          </Text>
          <Button variant="default" onClick={() => act("roll:cancel", {})}>
            {t("dice.cancelRequest")}
          </Button>
        </Stack>
      </Alert>
    );

  if (!open)
    return (
      <Tooltip label={t("dice.askTip")}>
        <Button variant="default" disabled={players.length === 0} onClick={() => setOpen(true)}>
          {t("dice.ask")}
        </Button>
      </Tooltip>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await act("roll:request", { label, playerIds: who });
    if (res.ok) {
      setOpen(false);
      setLabel("");
      setWho([]);
    }
  }

  return (
    <Stack component="form" gap="xs" onSubmit={submit}>
      <TextInput
        autoFocus
        placeholder={t("dice.askPlaceholder")}
        maxLength={LIMITS.rollLabel}
        value={label}
        onChange={(e) => setLabel(e.currentTarget.value)}
        aria-label={t("dice.askWhat")}
      />
      <MultiSelect
        placeholder={who.length === 0 ? t("dice.allPlayers") : undefined}
        data={players.map((p) => ({ value: p.id, label: p.name }))}
        value={who}
        onChange={setWho}
        aria-label={t("dice.askWho")}
        comboboxProps={{ withinPortal: true }}
      />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={() => setOpen(false)}>
          {t("common.close")}
        </Button>
        <Button type="submit" disabled={!label.trim()}>
          {t("dice.askSend")}
        </Button>
      </Group>
    </Stack>
  );
}
