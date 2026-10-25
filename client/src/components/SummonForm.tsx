import { Checkbox, Group, NumberInput, SegmentedControl, Select, Stack, Text, Tooltip } from "@mantine/core";
import { ALLY_COLORS, LIMITS, MOB_COLORS, NPC_COLORS, type Combatant, type MobTemplate } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
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
  const t = templates.find((x) => x.id === templateId);

  return (
    <>
      {templates.length > 0 && (
        <Select
          label="Partir de um template (opcional)"
          placeholder="Do zero"
          clearable
          data={templates.map((x) => ({ value: x.id, label: x.name }))}
          value={templateId}
          onChange={setTemplateId}
        />
      )}
      <CombatantForm
        // Trocar o template refaz o formulário com os dados dele.
        key={templateId ?? "novo"}
        initial={t ? { name: t.name, hpMax: t.hpMax, dexMod: t.dexMod, avatar: t.avatar, animal: t.animal } : undefined}
        palette={PALETTE[summoner.type]}
        submitLabel="Conjurar"
        onCancel={onClose}
        extra={
          <Stack gap="sm">
            <Group gap="sm" grow align="flex-start">
              <NumberInput
                label="Quantidade"
                min={LIMITS.qty.min}
                max={LIMITS.qty.max}
                allowDecimal={false}
                allowNegative={false}
                clampBehavior="strict"
                value={qty}
                onChange={setQty}
              />
              <Tooltip label={`Conta no início do turno de ${summoner.name}; ao zerar, o conjurado some. Vazio = sem duração.`}>
                <NumberInput
                  label="Duração (rounds)"
                  placeholder="Sem duração"
                  min={LIMITS.conditionRounds.min}
                  max={LIMITS.conditionRounds.max}
                  allowDecimal={false}
                  allowNegative={false}
                  value={rounds}
                  onChange={setRounds}
                />
              </Tooltip>
            </Group>
            <Tooltip label={`Somem quando ${summoner.name} perder a Concentração (ex.: Conjurar Animais). ${summoner.name} ganha a condição.`}>
              <Checkbox
                w="fit-content"
                label="Depende de concentração"
                checked={concentration}
                onChange={(e) => setConcentration(e.currentTarget.checked)}
              />
            </Tooltip>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Onde aparece
              </Text>
              <SegmentedControl
                fullWidth
                value={where}
                onChange={(v) => setWhere(v as "near" | "pick")}
                data={[
                  { value: "near", label: "Ao lado" },
                  { value: "pick", label: "Escolher no mapa" },
                ]}
              />
              <Text size="xs" c="dimmed">
                {where === "near"
                  ? summoner.pos
                    ? `Nas casas livres em volta de ${summoner.name}.`
                    : `${summoner.name} está fora do mapa: os conjurados também ficam.`
                  : "Depois de conjurar, clique no mapa onde cada um aparece; a distância até o conjurador aparece em pés (o alcance da magia é com você)."}
              </Text>
            </Stack>
          </Stack>
        }
        onSubmit={async (v) => {
          // O avatar do template vai junto mesmo sem trocar (o formulário só manda avatar alterado).
          const avatar = v.avatar === undefined && t?.avatar ? t.avatar : v.avatar;
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
              const place = summoner.pos ? `ao lado de ${summoner.name}` : "(fora do mapa: arraste da lista)";
              toast({ kind: "info", text: ids.length > 1 ? `${ids.length} conjurados ${place}.` : `${v.name} conjurado ${place}.` });
            }
            onClose();
          }
          return res.ok;
        }}
      />
    </>
  );
}
