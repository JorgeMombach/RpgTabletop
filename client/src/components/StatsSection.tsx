import { Menu, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { ABILITIES, abilityMod, type Ability, type Combatant } from "@rpg/shared";
import { act } from "../actions";
import { fmtMod } from "../format";
import { useT } from "../i18n";
import { useRollLock } from "../rollLock";

/** "1d20+3", "1d20-1" ou "1d20". */
function d20(mod: number) {
  return mod === 0 ? "1d20" : `1d20${mod > 0 ? "+" : ""}${mod}`;
}

/** CA, primeira caixinha da linha de atributos (só quando tem: a CA é opcional, há sistemas sem ela). */
function AcCell({ c }: { c: Combatant }) {
  const t = useT();
  return (
    <Tooltip label={t("stats.acTitle")}>
      <Stack gap={0} align="center" className="ability-cell ac-cell">
        <Text size="xs" c="bronze.4" fw={700}>
          {t("form.ac")}
        </Text>
        <Text fw={700} lh={1.1}>
          {c.ac}
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
  // Mesma trava do painel Dados (o mestre nunca é travado).
  const lock = useRollLock();

  function roll(k: Ability, secret = false) {
    const mod = abilityMod(c.abilities![k]!);
    // Mestre: assina com o combatente; oculta a de mob/NPC (e a do personagem, se pediu em segredo).
    void act("dice:roll", { expr: d20(mod), check: k, ...(gm ? { asId: c.id, hidden: c.type !== "ally" || secret } : {}) });
  }

  if (c.ac === undefined && filled.length === 0) return null;
  return (
    <SimpleGrid cols={7} spacing={4}>
      {c.ac !== undefined && <AcCell c={c} />}
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
          <Tooltip key={k} label={canRoll ? (lock.reason ? t(lock.reason) : t("stats.roll", { ability: t(`ability.${k}.name`), mod })) : t(`ability.${k}.name`)}>
            {canRoll ? (
              <UnstyledButton data-disabled={lock.blocked || undefined} onClick={() => !lock.blocked && roll(k)} aria-label={t("stats.roll", { ability: t(`ability.${k}.name`), mod })}>
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
