import { Menu, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { ABILITIES, abilityMod, type Ability, type Combatant } from "@rpg/shared";
import { act } from "../actions";
import { fmtMod } from "../format";
import { useT } from "../i18n";

/** "1d20+3", "1d20-1" ou "1d20". */
function d20(mod: number) {
  return mod === 0 ? "1d20" : `1d20${mod > 0 ? "+" : ""}${mod}`;
}

/** CA, primeira caixinha da linha de atributos. Sem CA (arquivo antigo): "—", pedindo para editar. */
function AcCell({ c }: { c: Combatant }) {
  const t = useT();
  const has = c.ac !== undefined;
  return (
    <Tooltip label={has ? t("stats.acTitle") : t("stats.noAcTitle")}>
      <Stack gap={0} align="center" className="ability-cell ac-cell">
        <Text size="xs" c="bronze.4" fw={700}>
          {t("form.ac")}
        </Text>
        <Text fw={700} lh={1.1}>
          {has ? c.ac : "—"}
        </Text>
      </Stack>
    </Tooltip>
  );
}

/**
 * CA e atributos preenchidos com o modificador; clicar rola o teste (d20 + mod) no log como "Teste de SAB".
 * Quem rola é quem pode mexer na ficha: o dono ou o mestre.
 */
export function StatsSection({ c, canRoll, gm }: { c: Combatant; canRoll: boolean; gm: boolean }) {
  const t = useT();
  const filled = ABILITIES.filter((k) => c.abilities?.[k] !== undefined);

  // Mestre no personagem de um jogador: escolhe rolar à vista ou em segredo (só ele vê; o jogador nem fica sabendo).
  const secretChoice = gm && c.type === "ally";

  function roll(k: Ability, secret = false) {
    const mod = abilityMod(c.abilities![k]!);
    // Mestre: assina com o combatente; oculta a de mob/NPC (e a do personagem, se pediu em segredo).
    void act("dice:roll", { expr: d20(mod), check: k, ...(gm ? { asId: c.id, hidden: c.type !== "ally" || secret } : {}) });
  }

  return (
    <SimpleGrid cols={7} spacing={4}>
      <AcCell c={c} />
      {filled.map((k) => {
        const score = c.abilities![k]!;
        const mod = fmtMod(abilityMod(score));
        const body = (
          <Stack gap={0} align="center" className="ability-cell">
            <Text size="xs" c="dimmed" fw={600}>
              {t(`ability.${k}`)}
            </Text>
            <Text fw={700} lh={1.1}>
              {mod}
            </Text>
            <Text size="xs" c="dimmed">
              {score}
            </Text>
          </Stack>
        );
        if (canRoll && secretChoice) {
          return (
            <Menu key={k} position="bottom" withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label={t("stats.roll", { ability: t(`ability.${k}.name`), mod })}>{body}</UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t("stats.roll", { ability: t(`ability.${k}.name`), mod })}</Menu.Label>
                <Menu.Item leftSection={<IconEye size={14} />} onClick={() => roll(k)}>
                  {t("stats.rollOpen")}
                </Menu.Item>
                <Menu.Item leftSection={<IconEyeOff size={14} />} onClick={() => roll(k, true)}>
                  {t("stats.rollSecret")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          );
        }
        return (
          <Tooltip key={k} label={canRoll ? t("stats.roll", { ability: t(`ability.${k}.name`), mod }) : t(`ability.${k}.name`)}>
            {canRoll ? (
              <UnstyledButton onClick={() => roll(k)} aria-label={t("stats.roll", { ability: t(`ability.${k}.name`), mod })}>
                {body}
              </UnstyledButton>
            ) : (
              body
            )}
          </Tooltip>
        );
      })}
    </SimpleGrid>
  );
}
