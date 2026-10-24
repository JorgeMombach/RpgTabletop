import {
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
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DICE, LIMITS, type ActionPayloads, type ClientState, type CombatantView, type RollMode } from "@rpg/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { act } from "../actions";
import { allCombatants } from "../format";
import { useApp } from "../store";
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

export function DicePanel({ state }: { state: ClientState }) {
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
  // Escolha manual do "rolar como" vale só para o turno em que foi feita.
  const [asChoice, setAsChoice] = useState<{ turn: number; id: string } | null>(null);

  const current = combat.active ? allCombatants(state).find((c) => c.id === combat.order[combat.turnIndex]) : undefined;
  const side = gm ? gmSide(state) : [];
  const defaultAs = current && side.some((c) => c.id === current.id) ? current.id : AS_MASTER;
  const asId = asChoice && asChoice.turn === combat.turn && (asChoice.id === AS_MASTER || side.some((c) => c.id === asChoice.id)) ? asChoice.id : defaultAs;

  // Trava por turno: o servidor também recusa; aqui só desabilita e explica.
  const me = state.self.id;
  const myTurn = current?.ownerId === me;
  const request = rolls.request;
  const requested = !!request && request.playerIds.includes(me) && !request.done.includes(me);
  const reactionOpen = rolls.reactions.some((r) => r.playerId === me && r.turn === combat.turn);
  const reactionUsed = rolls.reactions.some((r) => r.playerId === me && r.round === combat.round);
  const locked = !gm && combat.active && !myTurn && !requested && !reactionOpen;

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
        <Tooltip label="Nome que aparece no log. Muda sozinho para o combatente da vez.">
          <Select
            label="Rolar como"
            data={[{ value: AS_MASTER, label: "Mestre" }, ...side.map((c) => ({ value: c.id, label: c.name }))]}
            value={asId}
            onChange={(v) => setAsChoice(v ? { turn: combat.turn, id: v } : null)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </Tooltip>
      )}

      {!gm && combat.active && <TurnLock state={state} myTurn={myTurn} requested={requested} reactionOpen={reactionOpen} reactionUsed={reactionUsed} />}
      {gm && combat.active && <RequestControl state={state} />}

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
        <Button type="submit" style={{ flex: 1 }} disabled={locked}>
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
        <Button type="submit" disabled={locked || !damage.trim()}>
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
            <Button variant="default" size="sm" fw={700} px={0} disabled={locked} onClick={() => rollDie(f)}>
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
        <Button type="submit" disabled={locked || !expr.trim()}>
          Rolar
        </Button>
      </Group>

      {gm && <Checkbox checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} label="Rolagem oculta (só você vê)" />}

      <Divider />
      <RollLog log={state.log} selfId={state.self.id} />
    </Panel>
  );
}

/** Jogador em combate: de quem é a vez e o que pode rolar fora dela. */
function TurnLock(props: { state: ClientState; myTurn: boolean; requested: boolean; reactionOpen: boolean; reactionUsed: boolean }) {
  const { state, myTurn, requested, reactionOpen, reactionUsed } = props;
  if (myTurn) return null;
  if (requested)
    return (
      <Alert variant="light" color="gold" p="xs" title={`O mestre pediu: ${state.battle.rolls.request?.label}`}>
        <Text size="xs">Role uma vez (ex.: d20 + modificador nos dados livres).</Text>
      </Alert>
    );
  if (reactionOpen)
    return (
      <Alert variant="light" color="gold" p="xs" title="Reação liberada">
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
      <Alert variant="light" color="gold" p="xs" title={`Pedido: ${request.label}`}>
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
      <Tooltip label="Libera uma rolagem fora da vez (resistência, teste…). Acaba quando todos rolarem ou o turno mudar.">
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
