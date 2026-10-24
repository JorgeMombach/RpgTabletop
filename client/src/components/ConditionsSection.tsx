import { ActionIcon, Autocomplete, Badge, Button, Divider, Group, NumberInput, Stack, Text, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { CONDITIONS, LIMITS, type CombatantView } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { fmtCondition } from "../format";

const ROUNDS_TIP = "Desconta 1 no início de cada turno de quem tem a condição; ao chegar a 0, ela sai.";

/** Condições do combatente. O app só anota: nenhum efeito é aplicado (ADR-06). */
export function ConditionsSection({ c, editable }: { c: CombatantView; editable: boolean }) {
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState<string | number>("");
  const [adding, setAdding] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const res = await act("condition:add", { id: c.id, name, rounds: rounds === "" ? null : Number(rounds) });
    if (res.ok) {
      setName("");
      setRounds("");
    }
  }

  if (!editable && c.conditions.length === 0) return null;

  return (
    <Stack gap="xs">
      <Divider />
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.04em" }}>
          Condições
        </Text>
        {editable && !adding && (
          <Button variant="default" onClick={() => setAdding(true)}>
            + Condição
          </Button>
        )}
      </Group>

      {c.conditions.length === 0 && !adding && (
        <Text size="xs" c="dimmed">
          Nenhuma condição.
        </Text>
      )}

      {c.conditions.length > 0 && (
        <Group gap={6}>
          {c.conditions.map((k) => (
            <Tooltip key={k.id} label={k.rounds === null ? "Sem duração: fica até alguém tirar" : `${k.rounds} round(s) restante(s). ${ROUNDS_TIP}`}>
              <Badge
                variant="light"
                // Concentração em bronze; as demais em verde-cobre (guia visual E20).
                color={k.name === "Concentração" ? "bronze" : "copper"}
                radius="xl"
                size="md"
                tt="none"
                maw="100%"
                pr={editable ? 2 : undefined}
                rightSection={
                  editable && (
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      color={k.name === "Concentração" ? "bronze" : "copper"}
                      aria-label={`Tirar ${k.name}`}
                      onClick={() => act("condition:remove", { id: c.id, conditionId: k.id })}
                    >
                      <IconX size={12} stroke={2.5} />
                    </ActionIcon>
                  )
                }
              >
                {fmtCondition(k)}
              </Badge>
            </Tooltip>
          ))}
        </Group>
      )}

      {adding && (
        <Stack component="form" gap="xs" onSubmit={add}>
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <Autocomplete
              style={{ flex: 1, minWidth: 0 }}
              autoFocus
              placeholder="Condição (ou texto livre)"
              data={CONDITIONS}
              maxLength={LIMITS.conditionName}
              value={name}
              onChange={setName}
              aria-label="Condição"
              comboboxProps={{ withinPortal: true }}
            />
            <Tooltip label={`Duração em rounds (opcional). ${ROUNDS_TIP}`}>
              <NumberInput
                w={72}
                placeholder="Rounds"
                min={LIMITS.conditionRounds.min}
                max={LIMITS.conditionRounds.max}
                allowDecimal={false}
                allowNegative={false}
                clampBehavior="strict"
                value={rounds}
                onChange={setRounds}
                aria-label="Duração em rounds"
              />
            </Tooltip>
          </Group>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setAdding(false)}>
              Fechar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Adicionar
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
