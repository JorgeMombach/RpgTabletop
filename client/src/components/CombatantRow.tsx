import { Box, Group, Stack, Text } from "@mantine/core";
import { IconSkull } from "@tabler/icons-react";
import type { Combatant } from "@rpg/shared";
import type { ReactNode } from "react";
import { DRAG_MIME } from "../map/BattleMap";
import { select } from "../store";
import { CombatantAvatar } from "./CombatantAvatar";
import { HpBar } from "./HpBar";

interface Props {
  c: Combatant;
  selected: boolean;
  /** Complemento ao lado do nome (ex.: "(seu)", "· Ana"). */
  suffix?: string;
  /** Pode ser arrastado para o mapa. */
  draggable: boolean;
  /** Ação à direita (ex.: remover). */
  trailing?: ReactNode;
}

/** Linha de aliado/mob nas listas laterais: clicar seleciona, arrastar posiciona no mapa. */
export function CombatantRow({ c, selected, suffix, draggable, trailing }: Props) {
  const down = c.hp <= 0;
  const status = down ? (c.type === "mob" ? "Abatido" : "Caído") : `${c.hp}/${c.hpMax}`;
  const hint = draggable && !c.pos ? "Fora do mapa: arraste para posicionar" : undefined;

  return (
    <Box
      component="li"
      className={`crow ${selected ? "selected" : ""} ${down ? "down" : ""}`}
      onClick={() => select(c.id)}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, c.id)}
      title={hint}
    >
      <Group gap="sm" wrap="nowrap">
        <CombatantAvatar c={c} size={28} />
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap" justify="space-between">
            <Text size="sm" truncate title={c.name} style={{ minWidth: 0 }}>
              {down && c.type === "mob" && <IconSkull size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-label="Abatido" />}
              {c.name}
              {suffix && (
                <Text span size="xs" c="dimmed">
                  {" "}
                  {suffix}
                </Text>
              )}
              {draggable && !c.pos && (
                <Text span size="xs" c="dimmed">
                  {" "}
                  · fora do mapa
                </Text>
              )}
            </Text>
            <Text size="xs" c={down ? "red.4" : "dimmed"} style={{ flex: "none" }}>
              {status}
            </Text>
          </Group>
          <HpBar hp={c.hp} hpMax={c.hpMax} />
        </Stack>
        {trailing}
      </Group>
    </Box>
  );
}
