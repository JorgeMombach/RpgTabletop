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
import { allCombatants } from "../format";
import { setDicePrefs, useApp } from "../store";
import { Abbr } from "./Abbr";
import { Panel } from "./Panel";
import { naturalD20, RollLog } from "./RollLog";

const MODES: { value: RollMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "adv", label: "Vantagem" },
  { value: "dis", label: "Desvant." },
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
  const logDetached = useApp((s) => s.logDetached) && !inline;
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
    <Panel title="Dados">
      {gm && side.length > 0 && (
        <Tooltip label="Nome que aparece no log. Muda sozinho para o combatente selecionado no mapa ou, sem seleção, para o da vez.">
          <Select
            label="Rolar como"
            data={[{ value: AS_MASTER, label: "Mestre" }, ...side.map((c) => ({ value: c.id, label: c.name }))]}
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
          Esperando seus dados pararem…
        </Text>
      )}

      <SectionTitle>Ataque</SectionTitle>
      <Group component="form" gap="xs" wrap="nowrap" align="flex-end" onSubmit={rollAttack}>
        <Tooltip label="Bônus de ataque (d20 + este valor)">
          <NumberInput
            w={96}
            leftSection={<Text size="xs" c="dimmed">d20 +</Text>}
            leftSectionWidth={40}
            allowDecimal={false}
            value={attackMod}
            onChange={setAttackMod}
            aria-label="Bônus de ataque"
          />
        </Tooltip>
        <Button type="submit" style={{ flex: 1 }} disabled={blocked}>
          Rolar ataque
        </Button>
      </Group>
      <Tooltip label="Vale para o ataque e para o d20: rola dois e usa o maior (vantagem) ou o menor (desvantagem)">
        <SegmentedControl data={MODES} value={mode} onChange={(v) => setMode(v as RollMode)} aria-label="Modo do d20" />
      </Tooltip>

      <SectionTitle>Dano</SectionTitle>
      <Group component="form" gap="xs" wrap="nowrap" onSubmit={rollDamage}>
        <TextInput
          style={{ flex: 1, minWidth: 0 }}
          value={damage}
          maxLength={LIMITS.dice.exprLength}
          onChange={(e) => setDamage(e.currentTarget.value)}
          placeholder="Ex.: 1d8+3"
          aria-label="Dano"
        />
        <Button type="submit" disabled={blocked || !damage.trim()}>
          Rolar dano
        </Button>
      </Group>
      <Tooltip label="Dobra a quantidade de dados (2d6+3 → 4d6+3). Marca sozinho quando o ataque tira 20 natural.">
        <Checkbox checked={crit} onChange={(e) => setCrit(e.currentTarget.checked)} label={crit && damage.trim() ? `Crítico: ${doubleDice(damage)}` : "Crítico"} />
      </Tooltip>

      <Divider label="Dados livres" labelPosition="left" />
      <SimpleGrid cols={4} spacing={6} verticalSpacing={6}>
        {DICE.map((f) => (
          <Tooltip key={f} label={`Rolar ${Number(count) > 1 ? `${count}` : "1"}d${f}${Number(mod) ? ` ${Number(mod) > 0 ? "+" : ""}${mod}` : ""}`}>
            <Button variant="default" size="sm" fw={700} px={0} disabled={blocked} onClick={() => rollDie(f)}>
              d{f}
            </Button>
          </Tooltip>
        ))}
      </SimpleGrid>

      <Group grow gap="sm" align="flex-start">
        <NumberInput
          label={<Abbr title="Quantidade de dados">Qtd.</Abbr>}
          min={1}
          max={LIMITS.dice.count}
          allowDecimal={false}
          allowNegative={false}
          clampBehavior="strict"
          value={count}
          onChange={setCount}
        />
        <NumberInput label="Modificador" allowDecimal={false} value={mod} onChange={setMod} />
      </Group>

      <Group component="form" gap="xs" wrap="nowrap" onSubmit={rollExpr}>
        <TextInput
          style={{ flex: 1, minWidth: 0 }}
          value={expr}
          maxLength={LIMITS.dice.exprLength}
          onChange={(e) => setExpr(e.currentTarget.value)}
          placeholder="Ex.: 2d6+1d4+3"
          aria-label="Expressão de dados"
        />
        <Button type="submit" disabled={blocked || !expr.trim()}>
          Rolar
        </Button>
      </Group>

      {gm && <Checkbox checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} label="Rolagem oculta (só você vê)" />}

      <Divider />
      <LogHeader canDetach={!inline} />
      {logDetached ? (
        <Text size="xs" c="dimmed">
          O log está numa janela flutuante. Minimize a janela para ele voltar aqui.
        </Text>
      ) : (
        <RollLog log={state.log} selfId={state.self.id} />
      )}
    </Panel>
  );
}

/** Cabeçalho do log (E22): animação dos dados no centro e destacar o log numa janela. Valem só para este navegador. */
function LogHeader({ canDetach }: { canDetach: boolean }) {
  const diceAnim = useApp((s) => s.diceAnim);
  const logDetached = useApp((s) => s.logDetached) || !canDetach;
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Tooltip label="Dados rolando no centro do mapa a cada rolagem (só neste navegador)">
        <Switch size="xs" label="Animar rolagens" checked={diceAnim} onChange={(e) => setDicePrefs({ diceAnim: e.currentTarget.checked })} />
      </Tooltip>
      {!logDetached && (
        <Tooltip label="Abrir o log numa janela que dá para arrastar e redimensionar">
          <ActionIcon size="sm" aria-label="Destacar o log" onClick={() => setDicePrefs({ logDetached: true })}>
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
  if (myTurn) return null;
  if (requested)
    return (
      <Alert variant="light" color="bronze" p="xs" title={`O mestre pediu: ${state.battle.rolls.request?.label}`}>
        <Text size="xs">Role uma vez (ex.: d20 + modificador nos dados livres).</Text>
      </Alert>
    );
  if (reactionOpen)
    return (
      <Alert variant="light" color="bronze" p="xs" title="Reação liberada">
        <Text size="xs">Pode rolar até o turno mudar.</Text>
      </Alert>
    );
  return (
    <Group gap="xs" wrap="nowrap" justify="space-between">
      <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
        Fora da sua vez: dados travados.
      </Text>
      <Tooltip label={reactionUsed ? "Você já usou a reação neste round" : "Ataque de oportunidade, Escudo… Libera a rolagem até o turno mudar (1 por round)"}>
        <Button variant="default" disabled={reactionUsed} onClick={() => act("reaction:use", {})} style={{ flex: "none" }}>
          Usar reação
        </Button>
      </Tooltip>
    </Group>
  );
}

const OUTSIDE: { value: OutsideRolls; label: string }[] = [
  { value: "free", label: "Livres" },
  { value: "request", label: "Só com pedido" },
  { value: "locked", label: "Travadas" },
];

/** Mestre, fora de combate (E26): os jogadores rolam livres, só quando ele pedir, ou nada. */
function OutsideControl({ mode }: { mode: OutsideRolls }) {
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        Rolagens dos jogadores fora de combate
      </Text>
      <Tooltip label="Livres: todos rolam. Só com pedido: cada um rola uma vez quando você pedir (Percepção…). Travadas: só você rola.">
        <SegmentedControl fullWidth data={OUTSIDE} value={mode} onChange={(v) => act("roll:outside", { mode: v as OutsideRolls })} aria-label="Rolagens fora de combate" />
      </Tooltip>
    </Stack>
  );
}

/** Jogador fora de combate com as rolagens limitadas pelo mestre (E26). */
function OutsideLock({ state, requested }: { state: ClientState; requested: boolean }) {
  if (requested)
    return (
      <Alert variant="light" color="bronze" p="xs" title={`O mestre pediu: ${state.battle.rolls.request?.label}`}>
        <Text size="xs">Role uma vez (ex.: d20 + modificador nos dados livres).</Text>
      </Alert>
    );
  return (
    <Text size="xs" c="dimmed">
      {state.battle.rolls.outside === "locked" ? "O mestre travou as rolagens por enquanto." : "Dados travados: role quando o mestre pedir."}
    </Text>
  );
}

/** Mestre: pedir uma rolagem fora da vez (ex.: "Resistência DES") a todos ou a alguns jogadores. */
function RequestControl({ state }: { state: ClientState }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [who, setWho] = useState<string[]>([]);
  const request = state.battle.rolls.request;
  const players = state.players.filter((p) => p.role === "player");
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  if (request)
    return (
      <Alert variant="light" color="bronze" p="xs" title={`Pedido: ${request.label}`}>
        <Stack gap={6}>
          <Text size="xs">
            {request.playerIds.map((id) => `${request.done.includes(id) ? "✓" : "…"} ${nameOf(id)}`).join(" · ")}
          </Text>
          <Button variant="default" onClick={() => act("roll:cancel", {})}>
            Cancelar pedido
          </Button>
        </Stack>
      </Alert>
    );

  if (!open)
    return (
      <Tooltip label="Pede uma rolagem a todos ou a alguns jogadores (resistência, Percepção…). Cada um rola uma vez; em combate, acaba quando o turno mudar.">
        <Button variant="default" disabled={players.length === 0} onClick={() => setOpen(true)}>
          Pedir rolagem
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
        placeholder="Ex.: Resistência DES"
        maxLength={LIMITS.rollLabel}
        value={label}
        onChange={(e) => setLabel(e.currentTarget.value)}
        aria-label="O que rolar"
      />
      <MultiSelect
        placeholder={who.length === 0 ? "Todos os jogadores" : undefined}
        data={players.map((p) => ({ value: p.id, label: p.name }))}
        value={who}
        onChange={setWho}
        aria-label="Quem rola"
        comboboxProps={{ withinPortal: true }}
      />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={() => setOpen(false)}>
          Fechar
        </Button>
        <Button type="submit" disabled={!label.trim()}>
          Pedir
        </Button>
      </Group>
    </Stack>
  );
}
