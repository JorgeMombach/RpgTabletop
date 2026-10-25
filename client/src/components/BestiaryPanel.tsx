import { ActionIcon, Button, Checkbox, Group, NumberInput, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconPaw, IconPencil, IconTrash } from "@tabler/icons-react";
import { LIMITS, MOB_COLORS, type MobTemplate } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { fmtMod } from "../format";
import { Abbr } from "./Abbr";
import { CombatantAvatar } from "./CombatantAvatar";
import { CombatantForm } from "./CombatantForm";
import { Panel } from "./Panel";

type Mode = { kind: "none" } | { kind: "newTemplate" } | { kind: "newMob" } | { kind: "edit"; id: string };

/** Mestre: modelos de mob da sessão e criação de mobs na batalha. */
export function BestiaryPanel({ templates }: { templates: MobTemplate[] }) {
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const close = () => setMode({ kind: "none" });

  return (
    <Panel
      title="Bestiário"
      aside={
        mode.kind === "none" && (
          <Group gap="xs">
            <Tooltip label="Um mob único, sem template">
              <Button variant="default" onClick={() => setMode({ kind: "newMob" })}>
                + Avulso
              </Button>
            </Tooltip>
            <Tooltip label="Modelo para adicionar vários mobs iguais (ex.: Goblin)">
              <Button variant="default" onClick={() => setMode({ kind: "newTemplate" })}>
                + Template
              </Button>
            </Tooltip>
          </Group>
        )
      }
    >
      {mode.kind === "newTemplate" && (
        <CombatantForm
          palette={MOB_COLORS}
          submitLabel="Criar template"
          withNotes
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
          submitLabel="Adicionar à batalha"
          withHidden
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
          Crie templates (ex.: Goblin) para adicionar vários mobs iguais de uma vez.
        </Text>
      )}

      {templates.map((t) =>
        mode.kind === "edit" && mode.id === t.id ? (
          <CombatantForm
            key={t.id}
            initial={t}
            palette={MOB_COLORS}
            submitLabel="Salvar"
            withNotes
            onCancel={close}
            onSubmit={async (v) => {
              const ok = (await act("template:upsert", { ...v, id: t.id })).ok;
              if (ok) close();
              return ok;
            }}
          />
        ) : (
          <TemplateRow key={t.id} t={t} onEdit={() => setMode({ kind: "edit", id: t.id })} />
        ),
      )}
    </Panel>
  );
}

function TemplateRow({ t, onEdit }: { t: MobTemplate; onEdit: () => void }) {
  const [qty, setQty] = useState<string | number>(1);
  const [hidden, setHidden] = useState(false);

  async function remove() {
    const ok = await confirmAction({
      title: `Excluir o template "${t.name}"?`,
      message: "Mobs já criados com ele continuam na batalha.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (ok) void act("template:remove", { id: t.id });
  }

  return (
    <Paper p="xs" bg="dark.7">
      <Stack gap="xs">
        <Group gap="sm" wrap="nowrap">
          <CombatantAvatar c={{ ...t, type: "mob" }} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" truncate title={t.notes ? `${t.name} — ${t.notes}` : t.name}>
              {t.animal && <IconPaw size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-label="Animal" />}
              {t.name}
            </Text>
            <Text size="xs" c="dimmed">
              Vida {t.hpMax} · <Abbr title="Modificador de Destreza (usado na iniciativa: d20 + mod. DES)">DES</Abbr> {fmtMod(t.dexMod)}
            </Text>
          </div>
          <Tooltip label="Editar template">
            <ActionIcon size="sm" onClick={onEdit} aria-label={`Editar ${t.name}`}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Excluir template">
            <ActionIcon size="sm" onClick={() => void remove()} aria-label={`Excluir ${t.name}`}>
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
            void act("mob:addFromTemplate", { templateId: t.id, qty: Number(qty) || 1, hidden });
          }}
        >
          <Tooltip label="Quantidade">
            <NumberInput
              w={64}
              min={LIMITS.qty.min}
              max={LIMITS.qty.max}
              allowDecimal={false}
              allowNegative={false}
              clampBehavior="strict"
              value={qty}
              onChange={setQty}
              aria-label="Quantidade"
            />
          </Tooltip>
          <Tooltip label="Adicionar essa quantidade de mobs à batalha (Goblin 1, Goblin 2…)">
            <Button type="submit" style={{ flex: "1 1 auto" }}>
              + Mobs
            </Button>
          </Tooltip>
          <Tooltip label="Adicionar um NPC (neutro) com os dados deste template">
            <Button variant="default" style={{ flex: "1 1 auto" }} onClick={() => act("npc:addFromTemplate", { templateId: t.id, hidden })}>
              + NPC
            </Button>
          </Tooltip>
        </Group>
        <Tooltip label="Os próximos mobs/NPCs deste template entram ocultos: só você vê, fora da iniciativa até revelar">
          <Checkbox size="xs" label="Adicionar ocultos" checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} w="fit-content" />
        </Tooltip>
      </Stack>
    </Paper>
  );
}
