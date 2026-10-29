import { ActionIcon, Button, Group, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff, IconPlus, IconSkull, IconTrash, IconUser, type Icon } from "@tabler/icons-react";
import { NPC_COLORS, type Combatant, type MobTemplate } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { removeMob } from "../commands";
import { select, useApp } from "../store";
import { BestiaryModal } from "./BestiaryPanel";
import { CombatantForm } from "./CombatantForm";
import { CombatantRow } from "./CombatantRow";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";

/** Olho na linha do mob/NPC: oculta dos jogadores ou revela (E21). */
export function HideToggle({ c }: { c: Combatant }) {
  const t = useT();
  const tip = c.hidden ? t("mobs.revealTip") : t("mobs.hideTip");
  return (
    <Tooltip label={tip}>
      <ActionIcon
        size="sm"
        aria-label={t(c.hidden ? "mobs.revealOf" : "mobs.hideOf", { name: c.name })}
        onClick={(e) => {
          e.stopPropagation();
          void act("combatant:setHidden", { id: c.id, hidden: !c.hidden });
        }}
      >
        {c.hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** Lista de mobs ou NPCs (só o mestre), com ocultar e remover + "Desfazer". */
function GmList({ list, empty, icon }: { list: Combatant[]; empty: string; icon: Icon }) {
  const t = useT();
  const selectedId = useApp((s) => s.selectedId);
  if (list.length === 0)
    return <EmptyState icon={icon} text={empty} compact />;
  return (
    <ul className="list">
      {list.map((m) => (
        <CombatantRow
          key={m.id}
          c={m}
          selected={m.id === selectedId}
          draggable
          trailing={
            <Group gap={2} wrap="nowrap">
              <HideToggle c={m} />
              <Tooltip label={t("mobs.removeTip")}>
                <ActionIcon
                  size="sm"
                  aria-label={t("mobs.removeOf", { name: m.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeMob(m);
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          }
        />
      ))}
    </ul>
  );
}

/** Mestre: mobs da batalha atual; *+ Mobs* abre o bestiário sem sair do combate. */
export function MobsPanel({ mobs, templates }: { mobs: Combatant[]; templates: MobTemplate[] }) {
  const t = useT();
  const [bestiary, setBestiary] = useState(false);
  // A janela fica fora do painel: com o painel recolhido, o conteúdo dele não é desenhado.
  return (
    <>
      <Panel
        title={t("mobs.title")}
        aside={
          // Só o ícone: o título do painel é longo e a coluna pode estar estreita.
          <Tooltip label={t("mobs.addTip")}>
            <ActionIcon variant="default" size="md" aria-label={t("mobs.addTip")} onClick={() => setBestiary(true)}>
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
        }
      >
        <GmList list={mobs} empty={t("mobs.empty")} icon={IconSkull} />
      </Panel>
      <BestiaryModal templates={templates} opened={bestiary} onClose={() => setBestiary(false)} />
    </>
  );
}

/** Mestre: NPCs neutros (vida oculta para os jogadores, como a dos mobs). */
export function NpcsPanel({ npcs }: { npcs: Combatant[] }) {
  const t = useT();
  const [creating, setCreating] = useState(false);

  return (
    <Panel
      title={t("npcs.title")}
      aside={
        !creating && (
          <Tooltip label={t("npcs.addTip")}>
            <Button variant="default" onClick={() => setCreating(true)}>
              {t("npcs.add")}
            </Button>
          </Tooltip>
        )
      }
    >
      {creating && (
        <CombatantForm
          palette={NPC_COLORS}
          withNotes
          withPhases
          submitLabel={t("npcs.create")}
          withHidden
          onCancel={() => setCreating(false)}
          onSubmit={async (v) => {
            const res = await act("npc:add", v);
            if (res.ok) {
              setCreating(false);
              if (res.ids?.[0]) select(res.ids[0]);
            }
            return res.ok;
          }}
        />
      )}
      {!creating && <GmList list={npcs} empty={t("npcs.empty")} icon={IconUser} />}
    </Panel>
  );
}
