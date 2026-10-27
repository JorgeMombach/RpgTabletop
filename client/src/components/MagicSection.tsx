import { ActionIcon, Button, Divider, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { LIMITS, SPELL_LEVELS, type Combatant, type SpellLevel, type SpellSlot } from "@rpg/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { act } from "../actions";
import { RestButton } from "./RestButton";
import { Abbr } from "./Abbr";

const ORDINAL = ["Truque", "1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
const EMPTY: SpellSlot = { max: 0, used: 0 };

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.04em" }}>
        {children}
      </Text>
      {aside}
    </Group>
  );
}

/** Slots e magias de um aliado. O dono gerencia tudo livremente (SPEC F3). */
export function MagicSection({ c, editable }: { c: Combatant; editable: boolean }) {
  const [editingSlots, setEditingSlots] = useState(false);
  const slot = (l: SpellLevel) => c.spellSlots?.[l] ?? EMPTY;
  const levels = SPELL_LEVELS.filter((l) => slot(l).max > 0);
  const anyUsed = levels.some((l) => slot(l).used > 0);

  return (
    <Stack gap="sm">
      <Divider />
      <SectionTitle
        aside={
          editable && (
            <Button variant={editingSlots ? "filled" : "default"} onClick={() => setEditingSlots((v) => !v)}>
              {editingSlots ? "Pronto" : "Ajustar"}
            </Button>
          )
        }
      >
        Slots de magia
      </SectionTitle>

      {editingSlots ? (
        <SimpleGrid cols={3} spacing="xs" verticalSpacing="xs">
          {SPELL_LEVELS.map((l) => (
            <NumberInput
              key={l}
              leftSection={<Text size="xs">{ORDINAL[l]}</Text>}
              min={0}
              max={LIMITS.slotMax}
              allowDecimal={false}
              allowNegative={false}
              clampBehavior="strict"
              value={slot(l).max}
              onChange={(v) => void act("slot:set", { id: c.id, level: l, max: Number(v) || 0 })}
              aria-label={`Slots de ${l}º nível`}
            />
          ))}
        </SimpleGrid>
      ) : levels.length === 0 ? (
        <Text size="xs" c="dimmed">
          {editable ? "Sem slots. Use “Ajustar” para definir quantos tem por nível." : "Sem slots."}
        </Text>
      ) : (
        <Stack gap={6}>
          {levels.map((l) => {
            const { max, used } = slot(l);
            return (
              <Group key={l} gap="sm" wrap="nowrap">
                <Text size="xs" fw={600} c="dimmed" w={34}>
                  <Abbr title={`Slots de magia de ${l}º nível`}>{ORDINAL[l]}</Abbr>
                </Text>
                <Group gap={6} style={{ flex: 1 }}>
                  {Array.from({ length: max }, (_, i) => {
                    // Disponíveis primeiro, gastos depois: clicar gasta ou recupera um slot.
                    const spent = i >= max - used;
                    return (
                      <UnstyledButton
                        key={i}
                        className={`pip ${spent ? "spent" : ""}`}
                        disabled={!editable}
                        title={editable ? (spent ? "Recuperar slot" : "Gastar slot") : undefined}
                        aria-label={`${ORDINAL[l]} nível: slot ${i + 1} ${spent ? "gasto" : "disponível"}`}
                        onClick={() => act("slot:set", { id: c.id, level: l, used: spent ? used - 1 : used + 1 })}
                      />
                    );
                  })}
                </Group>
                <Text size="xs" c="dimmed">
                  {max - used}/{max}
                </Text>
              </Group>
            );
          })}
        </Stack>
      )}

      {editable && (
        <Group gap="xs" wrap="wrap">
          <Button variant="default" style={{ flex: "1 1 auto" }} disabled={!anyUsed} onClick={() => act("slots:restore", { id: c.id })}>
            Recuperar slots
          </Button>
          <RestButton who={c} kind="long" style={{ flex: "1 1 auto" }} />
        </Group>
      )}

      {c.spells !== undefined || editable ? <SpellList c={c} editable={editable} /> : null}
    </Stack>
  );
}

function SpellList({ c, editable }: { c: Combatant; editable: boolean }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<string | null>("1");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const spells = c.spells ?? [];

  async function add(e: FormEvent) {
    e.preventDefault();
    const res = await act("spell:add", { id: c.id, name, level: Number(level ?? 0), note: note || undefined });
    if (res.ok) {
      setName("");
      setNote("");
    }
  }

  return (
    <Stack gap="sm">
      <Divider />
      <SectionTitle
        aside={
          editable &&
          !adding && (
            <Button variant="default" onClick={() => setAdding(true)}>
              + Magia
            </Button>
          )
        }
      >
        Magias (referência)
      </SectionTitle>

      {adding && (
        <Paper component="form" onSubmit={add} p="sm" bg="dark.7">
          <Stack gap="xs">
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput
                style={{ flex: 1 }}
                autoFocus
                required
                placeholder="Nome da magia"
                maxLength={LIMITS.spellName}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                aria-label="Nome da magia"
              />
              <Select
                w={92}
                data={ORDINAL.map((label, l) => ({ value: String(l), label }))}
                value={level}
                onChange={setLevel}
                aria-label="Nível"
              />
            </Group>
            <TextInput
              placeholder="Nota (opcional): dano, alcance…"
              maxLength={LIMITS.spellNote}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              aria-label="Nota"
            />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={() => setAdding(false)}>
                Fechar
              </Button>
              <Button type="submit">Adicionar</Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {spells.length === 0
        ? !adding && (
            <Text size="xs" c="dimmed">
              Nenhuma magia anotada.
            </Text>
          )
        : spells.map((s) => (
            <Group key={s.id} gap="sm" wrap="nowrap" align="flex-start">
              <Text size="xs" fw={600} c="dimmed" w={44} pt={2}>
                {s.level === 0 ? (
                  <Abbr title="Truque: magia de nível 0, não gasta slot">Truque</Abbr>
                ) : (
                  <Abbr title={`Magia de ${s.level}º nível`}>{ORDINAL[s.level] ?? s.level}</Abbr>
                )}
              </Text>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm">{s.name}</Text>
                {s.note && (
                  <Text size="xs" c="dimmed">
                    {s.note}
                  </Text>
                )}
              </div>
              {editable && (
                <ActionIcon size="sm" aria-label={`Remover ${s.name}`} onClick={() => act("spell:remove", { id: c.id, spellId: s.id })}>
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Group>
          ))}
    </Stack>
  );
}
