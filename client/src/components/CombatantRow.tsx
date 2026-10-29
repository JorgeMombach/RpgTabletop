import { Box, Group, Stack, Text } from "@mantine/core";
import { IconEyeOff, IconFlame, IconPaw, IconSkull, IconWand } from "@tabler/icons-react";
import type { Combatant } from "@rpg/shared";
import type { ReactNode } from "react";
import { DRAG_MIME } from "../map/BattleMap";
import { allCombatants } from "../format";
import { useT } from "../i18n";
import { select, useApp } from "../store";
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
  const t = useT();
  const down = c.hp <= 0;
  const status = down ? (c.type === "mob" ? t("hp.downMob") : t("hp.down")) : `${c.hp}/${c.hpMax}`;
  const hint = draggable && !c.pos ? t("row.dragHint") : undefined;
  const summoner = useApp((s) => (c.summonerId && s.state ? allCombatants(s.state).find((o) => o.id === c.summonerId)?.name : undefined));
  const rounds = c.summonRounds !== undefined ? t("common.rounds", { n: c.summonRounds }) : null;
  // Chefe: fase atual (e o total, para o mestre, que recebe as próximas fases).
  const nextPhases = "phases" in c ? (c.phases?.length ?? 0) : 0;
  const phase = c.phase ?? 1;
  const phaseText = nextPhases > 0 || phase > 1 ? t(nextPhases > 0 ? "phases.short" : "phases.only", { n: phase, total: phase + nextPhases }) : null;
  // Na coluna estreita o complemento corta: o texto completo fica no title.
  const full = [c.name, summoner && t("kind.summonedBy", { name: summoner }), rounds && t("row.left", { rounds })].filter(Boolean).join(" · ");

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
            <Text size="sm" truncate title={full} style={{ minWidth: 0 }}>
              {down && c.type === "mob" && <IconSkull size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-label={t("hp.downMob")} />}
              {c.hidden && <IconEyeOff size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-label={t("kind.hidden")} />}
              {c.animal && <IconPaw size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-label={t("kind.animal")} />}
              {c.summonerId && <IconWand size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-label={t("row.summoned")} />}
              {c.torch && <IconFlame size={14} color="var(--mantine-color-bronze-4)" style={{ verticalAlign: -2, marginRight: 4 }} aria-label={t("torch.lit")} />}
              {c.name}
              {suffix && (
                <Text span size="xs" c="dimmed">
                  {" "}
                  {suffix}
                </Text>
              )}
              {summoner && (
                <Text span size="xs" c="dimmed">
                  {" "}
                  · {t("row.of", { name: summoner })}
                  {rounds && ` · ${rounds}`}
                </Text>
              )}
              {phaseText && (
                <Text span size="xs" c="bronze.4">
                  {" "}
                  · {phaseText}
                </Text>
              )}
              {c.hidden && (
                <Text span size="xs" c="dimmed">
                  {" "}
                  · {t("kind.hidden")}
                </Text>
              )}
              {draggable && !c.pos && (
                <Text span size="xs" c="dimmed">
                  {" "}
                  · {t("row.offMap")}
                </Text>
              )}
            </Text>
            <Text size="xs" c={down ? "red.4" : "dimmed"} style={{ flex: "none" }}>
              {status}
            </Text>
          </Group>
          <HpBar hp={c.hp} hpMax={c.hpMax} tempHp={c.tempHp} boss={c.boss} />
        </Stack>
        {trailing}
      </Group>
    </Box>
  );
}
