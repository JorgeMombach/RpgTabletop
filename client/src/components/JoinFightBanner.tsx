import { Alert, Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconDice5, IconMapPin, IconSwords } from "@tabler/icons-react";
import type { ClientState } from "@rpg/shared";
import { act } from "../actions";
import { turnLocked } from "../format";
import { useT } from "../i18n";
import { useMobileLayout } from "../layout";
import { setPlacing } from "../store";
import { placeOnMap } from "./SelectedPanel";

/**
 * Jogador que chega com o combate andando: o personagem sem iniciativa ou fora do mapa ganha uma faixa
 * no topo da ficha com o que falta (rolar a iniciativa, colocar no mapa). Some quando estiver tudo feito.
 */
export function JoinFightBanner({ state }: { state: ClientState }) {
  const t = useT();
  const mobile = useMobileLayout(false);
  if (state.self.role === "gm" || !state.battle.combat.active) return null;
  // Invocados entram pela vez de quem invocou: só os personagens.
  const pending = state.allies.filter((a) => a.ownerId === state.self.id && !a.summonerId && (a.initiative === null || !a.pos));
  if (pending.length === 0) return null;
  const moveLocked = turnLocked(state, "moveOnTurn");

  return (
    // flex: none: na coluna (flex) a faixa encolheria até sumir.
    <Alert variant="light" color="bronze" p="xs" icon={<IconSwords size={18} />} title={t("joinFight.title")} style={{ flex: "none" }}>
      <Stack gap="xs">
        {pending.map((c) => (
          <Stack key={c.id} gap={4}>
            <Text size="xs">{t(c.initiative === null && !c.pos ? "joinFight.both" : c.initiative === null ? "joinFight.init" : "joinFight.map", { name: c.name })}</Text>
            <Group gap="xs" wrap="wrap">
              {c.initiative === null && (
                <Button size="compact-sm" leftSection={<IconDice5 size={14} />} onClick={() => void act("init:roll", { id: c.id })}>
                  {t("joinFight.rollInit")}
                </Button>
              )}
              {!c.pos && (
                <Tooltip label={t("rules.moveLocked")} disabled={!moveLocked}>
                  <Button
                    size="compact-sm"
                    variant={c.initiative === null ? "default" : "filled"}
                    leftSection={<IconMapPin size={14} />}
                    data-disabled={moveLocked || undefined}
                    onClick={() => !moveLocked && (mobile ? setPlacing({ ids: [c.id] }) : placeOnMap(state, c.id))}
                  >
                    {t("selected.onMap")}
                  </Button>
                </Tooltip>
              )}
            </Group>
          </Stack>
        ))}
      </Stack>
    </Alert>
  );
}
