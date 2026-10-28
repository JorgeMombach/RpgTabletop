import { Checkbox, Group, NumberInput, SegmentedControl, Select, Stack, Text, Tooltip } from "@mantine/core";
import { ALLY_COLORS, LIMITS, MOB_COLORS, NPC_COLORS, type Combatant, type MobTemplate } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { toast } from "../notify";
import { setPlacing } from "../store";
import { CombatantForm } from "./CombatantForm";

const PALETTE = { ally: ALLY_COLORS, mob: MOB_COLORS, npc: NPC_COLORS };

/**
 * Conjurar (E21): familiar, esqueletos, animais… do lado de quem conjurou e com o mesmo controle.
 * O mestre pode partir de um template do bestiário (só preenche o formulário).
 */
export function SummonForm({ summoner, templates, onClose }: { summoner: Combatant; templates: MobTemplate[]; onClose: () => void }) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [qty, setQty] = useState<string | number>(1);
  const [concentration, setConcentration] = useState(false);
  const [rounds, setRounds] = useState<string | number>("");
  const [where, setWhere] = useState<"near" | "pick">("near");
  const tpl = templates.find((x) => x.id === templateId);
  const t = useT();

  return (
    <>
      {templates.length > 0 && (
        <Select
          label={t("summon.fromTemplate")}
          placeholder={t("summon.fromScratch")}
          clearable
          data={templates.map((x) => ({ value: x.id, label: x.name }))}
          value={templateId}
          onChange={setTemplateId}
        />
      )}
      <CombatantForm
        // Trocar o template refaz o formulário com os dados dele.
        key={templateId ?? "novo"}
        initial={tpl ? { name: tpl.name, hpMax: tpl.hpMax, dexMod: tpl.dexMod, ac: tpl.ac, abilities: tpl.abilities, size: tpl.size, avatar: tpl.avatar, animal: tpl.animal } : undefined}
        palette={PALETTE[summoner.type]}
        submitLabel={t("selected.summon")}
        onCancel={onClose}
        extra={
          <Stack gap="sm">
            <Group gap="sm" grow align="flex-start">
              <NumberInput
                label={t("summon.qty")}
                min={LIMITS.qty.min}
                max={LIMITS.qty.max}
                allowDecimal={false}
                allowNegative={false}
                clampBehavior="strict"
                value={qty}
                onChange={setQty}
              />
              <Tooltip label={t("summon.durationTip", { name: summoner.name })}>
                <NumberInput
                  label={t("summon.duration")}
                  placeholder={t("summon.noDuration")}
                  min={LIMITS.conditionRounds.min}
                  max={LIMITS.conditionRounds.max}
                  allowDecimal={false}
                  allowNegative={false}
                  value={rounds}
                  onChange={setRounds}
                />
              </Tooltip>
            </Group>
            <Tooltip label={t("summon.concentrationTip", { name: summoner.name })}>
              <Checkbox
                w="fit-content"
                label={t("summon.concentration")}
                checked={concentration}
                onChange={(e) => setConcentration(e.currentTarget.checked)}
              />
            </Tooltip>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {t("summon.where")}
              </Text>
              <SegmentedControl
                fullWidth
                value={where}
                onChange={(v) => setWhere(v as "near" | "pick")}
                data={[
                  { value: "near", label: t("summon.near") },
                  { value: "pick", label: t("summon.pick") },
                ]}
              />
              <Text size="xs" c="dimmed">
                {where === "near"
                  ? summoner.pos
                    ? t("summon.nearHint", { name: summoner.name })
                    : t("summon.offMapHint", { name: summoner.name })
                  : t("summon.pickHint")}
              </Text>
            </Stack>
          </Stack>
        }
        onSubmit={async (v) => {
          // O avatar do template vai junto mesmo sem trocar (o formulário só manda avatar alterado).
          const avatar = v.avatar === undefined && tpl?.avatar ? tpl.avatar : v.avatar;
          const res = await act("summon:add", {
            ...v,
            avatar,
            summonerId: summoner.id,
            qty: Number(qty) || 1,
            concentration,
            rounds: String(rounds).trim() === "" ? null : Number(rounds),
            near: where === "near",
          });
          if (res.ok) {
            const ids = res.ids ?? [];
            if (where === "pick") setPlacing({ ids, fromId: summoner.id });
            else {
              const place = summoner.pos ? t("summon.placeNear", { name: summoner.name }) : t("summon.placeOff");
              toast({ kind: "info", text: ids.length > 1 ? t("summon.doneMany", { n: ids.length, place }) : t("summon.doneOne", { name: v.name, place }) });
            }
            onClose();
          }
          return res.ok;
        }}
      />
    </>
  );
}
