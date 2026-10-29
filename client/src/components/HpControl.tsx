import { ActionIcon, Badge, Button, Group, NumberInput, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArrowBigUpLine, IconX } from "@tabler/icons-react";
import type { Combatant } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { HpBar } from "./HpBar";
import { usePulse } from "./usePulse";

/** Chefe com fases: "Fase 2 de 3" e uma barra cheia para cada fase que ainda vem. */
function PhaseBars({ c }: { c: Combatant }) {
  const t = useT();
  const current = c.phase ?? 1;
  const next = c.phases ?? [];
  return (
    <Stack gap={4}>
      <Text size="xs" c="bronze.4">
        {t("phases.current", { n: current, total: current + next.length })}
      </Text>
      {next.map((p, i) => (
        <Group key={i} gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed" w={44} style={{ flex: "none" }}>
            {t("phases.label", { n: current + i + 1 })}
          </Text>
          <div style={{ flex: 1 }}>
            <HpBar hp={p.hpMax} hpMax={p.hpMax} />
          </div>
          <Text size="xs" c="dimmed" truncate maw={140} title={p.name}>
            {p.hpMax}
            {p.name ? ` · ${p.name}` : ""}
            {p.ac !== undefined ? ` · CA ${p.ac}` : ""}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

/**
 * Vida de um combatente: o sistema só soma/subtrai o que a pessoa informar (ADR-06).
 * Vida temporária à parte: o dano tira dela primeiro (o servidor faz a conta).
 */
export function HpControl({ c }: { c: Combatant }) {
  const pulse = usePulse(c.hp);
  const t = useT();
  const [amount, setAmount] = useState<string | number>("");
  const [editing, setEditing] = useState<string | number | null>(null);
  const down = c.hp <= 0;
  const value = Math.abs(Math.trunc(Number(amount)));

  function apply(sign: 1 | -1) {
    if (!value) return;
    void act("hp:change", { id: c.id, delta: sign * value });
    setAmount("");
  }

  function setTemp() {
    if (!value) return;
    void act("hp:temp", { id: c.id, value });
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
          <Tooltip label={t("hp.editTip")}>
            <UnstyledButton className="hp-value" onClick={() => setEditing(c.hp)}>
              <Text key={pulse.pulseKey} fz={24} fw={700} lh={1.1} className={pulse.className}>
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
              aria-label={t("hp.current")}
            />
          </form>
        )}
        <Text size="lg" c="dimmed">
          / {c.hpMax}
        </Text>
        {c.tempHp !== undefined && (
          <Tooltip label={t("hp.tempTip")}>
            <Badge
              variant="light"
              color="gray"
              rightSection={
                <ActionIcon size={14} variant="transparent" color="gray" onClick={() => act("hp:temp", { id: c.id, value: 0 })} aria-label={t("hp.tempClear")}>
                  <IconX size={10} />
                </ActionIcon>
              }
            >
              {t("hp.tempBadge", { n: c.tempHp })}
            </Badge>
          </Tooltip>
        )}
        {down && (
          <Group gap={6} ml="auto" wrap="nowrap">
            <Badge color="red" variant="light">
              {c.type === "mob" ? t("hp.downMob") : t("hp.down")}
            </Badge>
            {/* Levantar = cura de 1 (zera os testes contra a morte); curar mais também levanta. */}
            <Tooltip label={t("hp.raiseTip")} multiline w={240}>
              <Button size="compact-xs" variant="light" color="copper" leftSection={<IconArrowBigUpLine size={12} />} onClick={() => void act("hp:change", { id: c.id, delta: 1 })}>
                {t("hp.raise")}
              </Button>
            </Tooltip>
          </Group>
        )}
      </Group>

      <HpBar hp={c.hp} hpMax={c.hpMax} tempHp={c.tempHp} thick boss={c.boss} />
      {(c.phases || c.phase) && <PhaseBars c={c} />}

      <Group gap="xs" wrap="nowrap">
        <NumberInput
          flex={1}
          miw={56}
          min={1}
          allowDecimal={false}
          allowNegative={false}
          placeholder={t("hp.amount")}
          value={amount}
          onChange={setAmount}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(e.shiftKey ? 1 : -1);
          }}
          aria-label={t("hp.amountLabel")}
        />
        <Button color="red" variant="light" onClick={() => apply(-1)} disabled={!value}>
          {t("hp.damage")}
        </Button>
        <Button color="copper" variant="light" onClick={() => apply(1)} disabled={!value}>
          {t("hp.heal")}
        </Button>
      </Group>
      <Group justify="space-between" gap="xs" wrap="wrap">
        <Text size="xs" c="dimmed" className="keyboard-hint">
          {t("hp.keys")}
        </Text>
        <Group gap="xs" ml="auto">
          <Tooltip label={t("hp.tempSetTip")}>
            <Button variant="default" onClick={setTemp} disabled={!value}>
              {t("hp.temp")}
            </Button>
          </Tooltip>
          <Button variant="default" onClick={() => act("hp:full", { id: c.id })} disabled={c.hp === c.hpMax}>
            {t("hp.full")}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
