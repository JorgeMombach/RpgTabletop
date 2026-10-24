import { Badge, Button, Group, NumberInput, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import type { Combatant } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { HpBar } from "./HpBar";

/** Vida de um combatente: o sistema só soma/subtrai o que a pessoa informar (ADR-06). */
export function HpControl({ c }: { c: Combatant }) {
  const [amount, setAmount] = useState<string | number>("");
  const [editing, setEditing] = useState<string | number | null>(null);
  const down = c.hp <= 0;

  function apply(sign: 1 | -1) {
    const n = Math.abs(Math.trunc(Number(amount)));
    if (!n) return;
    void act("hp:change", { id: c.id, delta: sign * n });
    setAmount("");
  }

  function commitEdit(e?: FormEvent) {
    e?.preventDefault();
    if (editing !== null && String(editing).trim() !== "") void act("hp:set", { id: c.id, value: Number(editing) });
    setEditing(null);
  }

  return (
    <Stack gap="xs">
      <Group gap={6} align="baseline" wrap="nowrap">
        {editing === null ? (
          <Tooltip label="Clique para digitar a vida atual">
            <UnstyledButton className="hp-value" onClick={() => setEditing(c.hp)}>
              <Text fz={24} fw={700} lh={1.1}>
                {c.hp}
              </Text>
            </UnstyledButton>
          </Tooltip>
        ) : (
          <form onSubmit={commitEdit}>
            <NumberInput
              size="sm"
              w={90}
              autoFocus
              min={0}
              max={c.hpMax}
              allowDecimal={false}
              value={editing}
              onChange={setEditing}
              onBlur={() => commitEdit()}
              onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
              aria-label="Vida atual"
            />
          </form>
        )}
        <Text size="lg" c="dimmed">
          / {c.hpMax}
        </Text>
        {down && (
          <Badge color="red" variant="light" ml="auto">
            {c.type === "mob" ? "Abatido" : "Caído"}
          </Badge>
        )}
      </Group>

      <HpBar hp={c.hp} hpMax={c.hpMax} thick />

      <Group gap="xs" wrap="nowrap">
        <NumberInput
          flex={1}
          miw={56}
          min={1}
          allowDecimal={false}
          allowNegative={false}
          placeholder="Valor"
          value={amount}
          onChange={setAmount}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(e.shiftKey ? 1 : -1);
          }}
          aria-label="Valor de dano ou cura"
        />
        <Button color="red" variant="light" onClick={() => apply(-1)} disabled={!amount}>
          − Dano
        </Button>
        <Button color="copper" variant="light" onClick={() => apply(1)} disabled={!amount}>
          + Cura
        </Button>
      </Group>
      <Group justify="space-between" gap="xs" wrap="wrap">
        <Text size="xs" c="dimmed">
          Enter = dano · Shift+Enter = cura
        </Text>
        <Button variant="default" onClick={() => act("hp:full", { id: c.id })} disabled={c.hp === c.hpMax}>
          Vida cheia
        </Button>
      </Group>
    </Stack>
  );
}
