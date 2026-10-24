import { Badge, Button, Checkbox, Code, Group, NumberInput, Paper, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { DICE, LIMITS, type ClientState, type LogEntry, type RollMode, type RollTerm } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { Abbr } from "./Abbr";
import { Panel } from "./Panel";

const MODES: { value: RollMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "adv", label: "Vantagem" },
  { value: "dis", label: "Desvant." },
];

function buildExpr(count: number, faces: number, mod: number) {
  const m = mod === 0 ? "" : mod > 0 ? `+${mod}` : `${mod}`;
  return `${count}d${faces}${m}`;
}

export function DicePanel({ state }: { state: ClientState }) {
  const gm = state.self.role === "gm";
  const [count, setCount] = useState<string | number>(1);
  const [mod, setMod] = useState<string | number>(0);
  const [mode, setMode] = useState<RollMode>("normal");
  const [expr, setExpr] = useState("");
  const [hidden, setHidden] = useState(false);

  function rollDie(faces: number) {
    const n = Math.max(1, Math.trunc(Number(count)) || 1);
    const m = Math.trunc(Number(mod)) || 0;
    // Vantagem/desvantagem só faz sentido num único d20.
    const useMode = faces === 20 ? mode : "normal";
    void act("dice:roll", { expr: buildExpr(useMode === "normal" ? n : 1, faces, m), mode: useMode, hidden });
  }

  async function rollExpr(e: FormEvent) {
    e.preventDefault();
    if (!expr.trim()) return;
    const res = await act("dice:roll", { expr, mode, hidden });
    if (res.ok) setExpr("");
  }

  return (
    <Panel title="Dados">
      <SimpleGrid cols={4} spacing={6} verticalSpacing={6}>
        {DICE.map((f) => (
          <Tooltip key={f} label={`Rolar ${Number(count) > 1 ? `${count}` : "1"}d${f}${Number(mod) ? ` ${Number(mod) > 0 ? "+" : ""}${mod}` : ""}`}>
            <Button variant="default" size="sm" fw={700} px={0} onClick={() => rollDie(f)}>
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

      <Tooltip label="Vale para o d20: rola dois e usa o maior (vantagem) ou o menor (desvantagem)">
        <SegmentedControl
          data={MODES}
          value={mode}
          onChange={(v) => setMode(v as RollMode)}
          aria-label="Modo do d20"
        />
      </Tooltip>

      <Group component="form" gap="xs" wrap="nowrap" onSubmit={rollExpr}>
        <TextInput
          style={{ flex: 1 }}
          value={expr}
          maxLength={LIMITS.dice.exprLength}
          onChange={(e) => setExpr(e.currentTarget.value)}
          placeholder="Ex.: 2d6+1d4+3"
          aria-label="Expressão de dados"
        />
        <Button type="submit" disabled={!expr.trim()}>
          Rolar
        </Button>
      </Group>

      {gm && <Checkbox checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} label="Rolagem oculta (só você vê)" />}

      <RollLog log={state.log} selfId={state.self.id} />
    </Panel>
  );
}

function RollLog({ log, selfId }: { log: LogEntry[]; selfId: string }) {
  if (log.length === 0)
    return (
      <Text size="xs" c="dimmed">
        Nenhuma rolagem ainda.
      </Text>
    );

  return (
    <Stack component="ol" gap={6} className="roll-log">
      {[...log].reverse().map((e) => (
        <Paper component="li" key={e.id} p="xs" bg="dark.7" style={e.hidden ? { borderStyle: "dashed" } : undefined}>
          <Group gap={6} wrap="nowrap" mb={4}>
            <Text size="xs" fw={600} c={e.authorId === selfId ? "gold.4" : undefined} truncate>
              {e.author}
            </Text>
            {e.hidden && (
              <Badge size="xs" variant="default">
                oculta
              </Badge>
            )}
            <Text size="xs" c="dimmed" ml="auto" style={{ flex: "none" }}>
              {new Date(e.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </Text>
          </Group>
          {e.roll ? <RollBody entry={e} /> : <Text size="sm">{e.text}</Text>}
        </Paper>
      ))}
    </Stack>
  );
}

/** Valor natural do d20 que valeu, para destacar 20 e 1. */
function naturalD20(terms: RollTerm[]): number | null {
  const d = terms.find((t) => t.kind === "dice" && t.faces === 20 && (t.count === 1 || t.keptIndex !== undefined));
  if (!d || d.kind !== "dice") return null;
  return d.rolls[d.keptIndex ?? 0];
}

function RollBody({ entry }: { entry: LogEntry }) {
  const r = entry.roll!;
  const nat = naturalD20(r.terms);
  const totalColor = nat === 20 ? "teal.4" : nat === 1 ? "red.4" : undefined;

  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        {entry.label && (
          <Text size="xs" fw={600}>
            {entry.label}
          </Text>
        )}
        <Group gap={6}>
          <Code>{r.expr}</Code>
          {r.mode !== "normal" && (
            <Text size="xs" c="dimmed">
              {r.mode === "adv" ? "vantagem" : "desvantagem"}
            </Text>
          )}
        </Group>
        <Group gap={4}>
          {r.terms.map((t, i) =>
            t.kind === "dice" ? (
              <Group key={i} gap={3} wrap="nowrap">
                {t.sign < 0 && <Text size="xs">−</Text>}
                {t.rolls.map((v, j) => {
                  const dropped = t.keptIndex !== undefined && t.keptIndex !== j;
                  const color = t.faces === 20 && v === 20 ? "teal" : t.faces === 20 && v === 1 ? "red" : "gray";
                  return (
                    <Tooltip key={j} label={`d${t.faces}${dropped ? " (descartado)" : ""}`}>
                      <Badge
                        size="sm"
                        radius="sm"
                        variant={color === "gray" ? "default" : "light"}
                        color={color}
                        miw={24}
                        style={dropped ? { opacity: 0.4, textDecoration: "line-through" } : undefined}
                      >
                        {v}
                      </Badge>
                    </Tooltip>
                  );
                })}
              </Group>
            ) : (
              <Text key={i} size="xs" c="dimmed">
                {t.sign < 0 ? "−" : "+"}
                {t.value}
              </Text>
            ),
          )}
        </Group>
      </Stack>
      <Stack gap={0} align="flex-end">
        <Text fz={22} fw={700} lh={1.1} c={totalColor}>
          {r.total}
        </Text>
        {nat === 20 && (
          <Text size="xs" c="teal.4">
            20 natural
          </Text>
        )}
        {nat === 1 && (
          <Text size="xs" c="red.4">
            1 natural
          </Text>
        )}
      </Stack>
    </Group>
  );
}
