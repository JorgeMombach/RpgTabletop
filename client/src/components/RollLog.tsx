import { Badge, Code, Group, Loader, Paper, Stack, Text, Tooltip } from "@mantine/core";
import type { LogEntry, RollTerm } from "@rpg/shared";
import { rollerName } from "../format";
import { useApp } from "../store";

interface TurnGroup {
  key: string;
  /** "Round 2 · Goblin 2"; ausente = fora de combate. */
  title?: string;
  entries: LogEntry[];
}

/** Agrupa entradas seguidas do mesmo turno (mais recentes primeiro). */
function groupByTurn(log: LogEntry[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  for (const e of [...log].reverse()) {
    const last = groups.at(-1);
    if (last && e.turn && last.key === `t${e.turn.seq}`) last.entries.push(e);
    else
      groups.push({
        key: e.turn ? `t${e.turn.seq}` : e.id,
        title: e.turn ? `Round ${e.turn.round} · ${e.turn.name}` : undefined,
        entries: [e],
      });
  }
  return groups;
}

export function RollLog({ log, selfId }: { log: LogEntry[]; selfId: string }) {
  const rolling = useApp((s) => s.rolling);
  if (log.length === 0)
    return (
      <Text size="xs" c="dimmed">
        Nenhuma rolagem ainda.
      </Text>
    );

  return (
    <Stack component="ol" gap={6} className="roll-log">
      {groupByTurn(log).map((g) => (
        <li key={g.key}>
          <Stack gap={4}>
            {g.title && (
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" truncate title={g.title} style={{ letterSpacing: "0.04em" }}>
                {g.title}
              </Text>
            )}
            {g.entries.map((e) => (
              <Entry key={e.id} e={e} selfId={selfId} rolling={rolling.includes(e.id)} />
            ))}
          </Stack>
        </li>
      ))}
    </Stack>
  );
}

function Entry({ e, selfId, rolling }: { e: LogEntry; selfId: string; rolling: boolean }) {
  // "Personagem (jogador)"; do lado do mestre, "Goblin 2 (Mestre)" (E26).
  const author = rollerName(e);
  return (
    <Paper p="xs" bg="dark.7" style={e.hidden ? { borderStyle: "dashed" } : undefined}>
      <Group gap={6} wrap="nowrap" mb={4}>
        <Text size="xs" fw={600} c={e.system ? "dimmed" : e.authorId === selfId ? "bronze.4" : undefined} truncate title={author}>
          {author}
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
      {rolling ? (
        // Os dados ainda estão caindo na tela: o resultado aparece junto com eles (E26).
        <Group gap={6} wrap="nowrap">
          <Loader size={12} color="bronze" />
          <Text size="sm" c="dimmed">
            {e.label ? `${e.label}: rolando…` : "Rolando…"}
          </Text>
        </Group>
      ) : e.roll ? (
        <RollBody entry={e} />
      ) : (
        <Text size="sm">{e.text}</Text>
      )}
    </Paper>
  );
}

/** Valor natural do d20 que valeu, para destacar 20 e 1. */
export function naturalD20(terms: RollTerm[]): number | null {
  const d = terms.find((t) => t.kind === "dice" && t.faces === 20 && (t.count === 1 || t.keptIndex !== undefined));
  if (!d || d.kind !== "dice") return null;
  return d.rolls[d.keptIndex ?? 0];
}

function RollBody({ entry }: { entry: LogEntry }) {
  const r = entry.roll!;
  const nat = naturalD20(r.terms);
  const critHit = entry.kind === "attack" && nat === 20;
  const totalColor = nat === 20 ? "copper.4" : nat === 1 ? "red.4" : entry.crit ? "bronze.4" : undefined;

  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        {entry.label && (
          <Text size="xs" fw={600} truncate title={entry.label}>
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
                  const color = t.faces === 20 && v === 20 ? "copper" : t.faces === 20 && v === 1 ? "red" : "gray";
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
        {critHit ? (
          <Text size="xs" fw={700} c="copper.4">
            Crítico!
          </Text>
        ) : nat === 20 ? (
          <Text size="xs" c="copper.4">
            20 natural
          </Text>
        ) : null}
        {nat === 1 && (
          <Text size="xs" c="red.4">
            1 natural
          </Text>
        )}
      </Stack>
    </Group>
  );
}
