import { Checkbox, Stack } from "@mantine/core";
import { RULE_KEYS, type TableRules } from "@rpg/shared";
import { act } from "../actions";
import { useT, type MessageKey } from "../i18n";
import { Panel } from "./Panel";

const LABEL: Record<keyof TableRules, [MessageKey, MessageKey]> = {
  moveOnTurn: ["rules.moveOnTurn", "rules.moveOnTurnHint"],
  summonOnTurn: ["rules.summonOnTurn", "rules.summonOnTurnHint"],
};

/** Regras da mesa (aba Mesa do mestre): opções que travam o jogador em combate. O mestre nunca é travado. */
export function RulesPanel({ rules }: { rules: TableRules }) {
  const t = useT();
  return (
    <Panel title={t("rules.title")}>
      <Stack gap="sm">
        {RULE_KEYS.map((key) => (
          <Checkbox
            key={key}
            label={t(LABEL[key][0])}
            description={t(LABEL[key][1])}
            checked={rules[key]}
            onChange={(e) => void act("rules:set", { [key]: e.currentTarget.checked })}
          />
        ))}
      </Stack>
    </Panel>
  );
}
