import { ActionIcon, Button, Checkbox, Group, NumberInput, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconPaw, IconPencil, IconTrash } from "@tabler/icons-react";
import { LIMITS, MOB_COLORS, type MobTemplate } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { fmtMod } from "../format";
import { useT } from "../i18n";
import { Abbr } from "./Abbr";
import { CombatantAvatar } from "./CombatantAvatar";
import { CombatantForm } from "./CombatantForm";
import { Panel } from "./Panel";

type Mode = { kind: "none" } | { kind: "newTemplate" } | { kind: "newMob" } | { kind: "edit"; id: string };

/** Mestre: modelos de mob da sessão e criação de mobs na batalha. */
export function BestiaryPanel({ templates }: { templates: MobTemplate[] }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const close = () => setMode({ kind: "none" });

  return (
    <Panel
      title={t("bestiary.title")}
      aside={
        mode.kind === "none" && (
          <Group gap="xs">
            <Tooltip label={t("bestiary.singleTip")}>
              <Button variant="default" onClick={() => setMode({ kind: "newMob" })}>
                {t("bestiary.single")}
              </Button>
            </Tooltip>
            <Tooltip label={t("bestiary.templateTip")}>
              <Button variant="default" onClick={() => setMode({ kind: "newTemplate" })}>
                {t("bestiary.template")}
              </Button>
            </Tooltip>
          </Group>
        )
      }
    >
      {mode.kind === "newTemplate" && (
        <CombatantForm
          palette={MOB_COLORS}
          submitLabel={t("bestiary.createTemplate")}
          withNotes
          withPhases
          onCancel={close}
          onSubmit={async (v) => {
            const ok = (await act("template:upsert", v)).ok;
            if (ok) close();
            return ok;
          }}
        />
      )}

      {mode.kind === "newMob" && (
        <CombatantForm
          palette={MOB_COLORS}
          submitLabel={t("bestiary.addToBattle")}
          withHidden
          withNotes
          withPhases
          onCancel={close}
          onSubmit={async (v) => {
            const ok = (await act("mob:add", v)).ok;
            if (ok) close();
            return ok;
          }}
        />
      )}

      {templates.length === 0 && mode.kind === "none" && (
        <Text size="xs" c="dimmed">
          {t("bestiary.empty")}
        </Text>
      )}

      {templates.map((tpl) =>
        mode.kind === "edit" && mode.id === tpl.id ? (
          <CombatantForm
            key={tpl.id}
            initial={tpl}
            palette={MOB_COLORS}
            submitLabel={t("common.save")}
            withNotes
            withPhases
            onCancel={close}
            onSubmit={async (v) => {
              const ok = (await act("template:upsert", { ...v, id: tpl.id })).ok;
              if (ok) close();
              return ok;
            }}
          />
        ) : (
          <TemplateRow key={tpl.id} t={tpl} onEdit={() => setMode({ kind: "edit", id: tpl.id })} />
        ),
      )}
    </Panel>
  );
}

function TemplateRow({ t: tpl, onEdit }: { t: MobTemplate; onEdit: () => void }) {
  const t = useT();
  const [qty, setQty] = useState<string | number>(1);
  const [hidden, setHidden] = useState(false);

  async function remove() {
    const ok = await confirmAction({
      title: t("bestiary.deleteTitle", { name: tpl.name }),
      message: t("bestiary.deleteMessage"),
      confirmLabel: t("common.delete"),
      danger: true,
    });
    if (ok) void act("template:remove", { id: tpl.id });
  }

  return (
    <Paper p="xs" bg="dark.7">
      <Stack gap="xs">
        <Group gap="sm" wrap="nowrap">
          <CombatantAvatar c={{ ...tpl, type: "mob" }} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" truncate title={tpl.notes ? `${tpl.name} — ${tpl.notes}` : tpl.name}>
              {tpl.animal && <IconPaw size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-label={t("kind.animal")} />}
              {tpl.name}
            </Text>
            <Text size="xs" c="dimmed">
              {t("bestiary.hp", { n: tpl.hpMax })}
              {tpl.ac !== undefined && (
                <>
                  {" · "}
                  <Abbr title={t("bestiary.acTitle")}>{t("bestiary.ac")}</Abbr> {tpl.ac}
                </>
              )}
              {" · "}
              <Abbr title={t("selected.initTip")}>{t("selected.init")}</Abbr> {fmtMod(tpl.dexMod)}
            </Text>
          </div>
          <Tooltip label={t("bestiary.edit")}>
            <ActionIcon size="sm" onClick={onEdit} aria-label={t("bestiary.editOf", { name: tpl.name })}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("bestiary.delete")}>
            <ActionIcon size="sm" onClick={() => void remove()} aria-label={t("bestiary.deleteOf", { name: tpl.name })}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group
          component="form"
          gap="xs"
          wrap="wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void act("mob:addFromTemplate", { templateId: tpl.id, qty: Number(qty) || 1, hidden });
          }}
        >
          <Tooltip label={t("summon.qty")}>
            <NumberInput
              w={64}
              min={LIMITS.qty.min}
              max={LIMITS.qty.max}
              allowDecimal={false}
              allowNegative={false}
              clampBehavior="strict"
              value={qty}
              onChange={setQty}
              aria-label={t("summon.qty")}
            />
          </Tooltip>
          <Tooltip label={t("bestiary.addMobsTip")}>
            <Button type="submit" style={{ flex: "1 1 auto" }}>
              {t("bestiary.addMobs")}
            </Button>
          </Tooltip>
          <Tooltip label={t("bestiary.addNpcTip")}>
            <Button variant="default" style={{ flex: "1 1 auto" }} onClick={() => act("npc:addFromTemplate", { templateId: tpl.id, hidden })}>
              {t("npcs.add")}
            </Button>
          </Tooltip>
        </Group>
        <Tooltip label={t("bestiary.hiddenTip")}>
          <Checkbox size="xs" label={t("bestiary.hidden")} checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} w="fit-content" />
        </Tooltip>
      </Stack>
    </Paper>
  );
}
