import { ActionIcon, Button, Divider, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff, IconFlame, IconPencil, IconWand, IconX } from "@tabler/icons-react";
import { ALLY_COLORS, MOB_COLORS, NPC_COLORS, type ClientState, type Combatant } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { removeMob } from "../commands";
import { confirmAction } from "../confirm";
import { allCombatants, fmtMod, turnLocked } from "../format";
import { useT } from "../i18n";
import { cellAt, placeFor } from "../map/geometry";
import { useMobileLayout } from "../layout";
import { select, setPlacing, useApp } from "../store";
import { Abbr } from "./Abbr";
import { AuraControl } from "./AuraControl";
import { CombatantAvatar } from "./CombatantAvatar";
import { StatsSection } from "./StatsSection";
import { SummonForm } from "./SummonForm";
import { CombatantForm } from "./CombatantForm";
import { DeathSaves } from "./DeathSaves";
import { DescriptionSection } from "./DescriptionSection";
import { ConditionsSection } from "./ConditionsSection";
import { HpBar } from "./HpBar";
import { HpControl } from "./HpControl";
import { SheetTabs } from "./SheetTabs";
import { Panel } from "./Panel";

/** Coloca o token no quadrado livre mais perto do centro da visão do mapa. */
export function placeOnMap(state: ClientState, id: string) {
  const { viewCenter } = useApp.getState();
  const all = allCombatants(state);
  const c = all.find((o) => o.id === id);
  if (c) void act("token:move", { id, pos: placeFor(c, cellAt(viewCenter, state.battle.map), all) });
}

const PALETTE = { ally: ALLY_COLORS, mob: MOB_COLORS, npc: NPC_COLORS };

export function SelectedPanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summoningId, setSummoningId] = useState<string | null>(null);
  const t = useT();

  const gm = state.self.role === "gm";
  const mobile = useMobileLayout(gm);
  const ally = state.allies.find((a) => a.id === selectedId);
  const mobView = [...state.battle.mobs, ...state.battle.npcs].find((m) => m.id === selectedId);
  // Jogadores não recebem vida de mob nem de NPC, então só o mestre tem o combatente completo.
  const c: Combatant | undefined = ally ?? (gm ? (mobView as Combatant | undefined) : undefined);
  const close = (
    <Tooltip label={t("common.close")}>
      <ActionIcon size="sm" onClick={() => select(null)} aria-label={t("common.close")}>
        <IconX size={16} />
      </ActionIcon>
    </Tooltip>
  );

  if (!c && mobView) {
    return (
      <Panel title={t("selected.title")} aside={close}>
        <Group gap="sm" wrap="nowrap">
          <CombatantAvatar c={mobView} />
          <div style={{ minWidth: 0 }}>
            <Text fw={600} truncate title={mobView.name}>
              {mobView.name}
            </Text>
            <Text size="xs" c="dimmed">
              {mobView.type === "npc" ? t("kind.npc") : t("kind.enemy")}
              {mobView.animal && ` · ${t("kind.animal")}`}
            </Text>
          </div>
        </Group>
        <DescriptionSection c={mobView} gm={false} />
        <ConditionsSection c={mobView} editable={false} />
      </Panel>
    );
  }

  if (!c) {
    return (
      <Panel title={t("selected.title")}>
        <Text size="xs" c="dimmed">
          {t(gm ? "selected.emptyGm" : "selected.empty")}
        </Text>
      </Panel>
    );
  }

  const canEdit = gm || c.ownerId === state.self.id;
  const owner = state.players.find((p) => p.id === c.ownerId);
  const editing = editingId === c.id;
  const summoner = c.summonerId ? allCombatants(state).find((o) => o.id === c.summonerId) : undefined;
  const summoning = summoningId === c.id;
  // Regras da mesa: em combate, fora da vez, o jogador não mexe no mapa nem invoca. `data-disabled`
  // (e não `disabled`) para o tooltip explicar o porquê.
  const moveLocked = turnLocked(state, "moveOnTurn");
  const summonLocked = turnLocked(state, "summonOnTurn");
  const kind =
    (c.type === "mob" ? t("kind.mob") : c.type === "npc" ? t("kind.npc") : owner ? `${t("kind.ally")} · ${owner.name}` : t("kind.ally")) +
    (summoner ? ` · ${t("kind.summonedBy", { name: summoner.name })}` : "") +
    (c.summonRounds !== undefined ? ` · ${t("common.rounds", { n: c.summonRounds })}` : "") +
    (c.animal ? ` · ${t("kind.animal")}` : "") +
    (c.darkvision ? ` · ${t("form.darkvision").toLocaleLowerCase()}` : "") +
    (c.hidden ? ` · ${t("kind.hidden")}` : "");

  async function remove(target: Combatant) {
    if (target.type !== "ally") return void removeMob(target);
    const ok = await confirmAction({ title: t("selected.removeTitle", { name: target.name }), message: t("selected.removeMessage"), confirmLabel: t("common.remove"), danger: true });
    if (ok) void act("ally:remove", { id: target.id }).then((r) => r.ok && select(null));
  }

  return (
    <Panel title={t("selected.title")} aside={close}>
      <Group gap="sm" wrap="nowrap">
        <CombatantAvatar c={c} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text fw={600} truncate title={c.name}>
            {c.name}
          </Text>
          <Text size="xs" c="dimmed" truncate title={`${kind} · ${t("selected.initiative")} ${fmtMod(c.dexMod)}`}>
            {kind} · <Abbr title={t("selected.initTip")}>{t("selected.init")}</Abbr> {fmtMod(c.dexMod)}
          </Text>
        </div>
        {canEdit && !editing && !summoning && (
          <Tooltip label={t("selected.editTip")}>
            <Button variant="default" leftSection={<IconPencil size={14} />} onClick={() => setEditingId(c.id)}>
              {t("selected.edit")}
            </Button>
          </Tooltip>
        )}
      </Group>

      {summoning ? (
        <SummonForm summoner={c} templates={state.templates} onClose={() => setSummoningId(null)} />
      ) : editing ? (
        <CombatantForm
          initial={c}
          palette={PALETTE[c.type]}
          submitLabel={t("common.save")}
          withNotes={gm}
          withDarkvision={c.type === "ally" && !c.summonerId}
          withPhases={gm && c.type !== "ally"}
          onCancel={() => setEditingId(null)}
          onSubmit={async (v) => {
            // `notes` é do template; aqui valem `description` e (só o mestre) `gmNotes`.
            const { notes: _notes, ...fields } = v;
            const ok = (await act("combatant:update", { id: c.id, ...fields })).ok;
            if (ok) setEditingId(null);
            return ok;
          }}
        />
      ) : canEdit ? (
        <HpControl c={c} />
      ) : (
        <Stack gap="xs">
          <Text fz={24} fw={700} lh={1.1}>
            {c.hp}{" "}
            <Text span size="lg" c="dimmed" fw={400}>
              / {c.hpMax}
            </Text>
          </Text>
          <HpBar hp={c.hp} hpMax={c.hpMax} tempHp={c.tempHp} thick />
        </Stack>
      )}

      {!editing && !summoning && <DescriptionSection c={c} gm={gm} />}

      {!editing && !summoning && c.type === "ally" && c.hp <= 0 && <DeathSaves c={c} editable={canEdit} gm={gm} />}

      {!editing && !summoning && <StatsSection c={c} canRoll={canEdit} gm={gm} />}

      {!editing && !summoning && <ConditionsSection c={c} editable={canEdit} />}

      {!editing && !summoning && (c.type === "ally" || gm) && <SheetTabs c={c} editable={canEdit} gm={gm} />}

      {canEdit && !editing && !summoning && (
        <>
          <Divider />
          <Group justify="space-between" gap="xs" wrap="wrap">
            <Tooltip label={t("rules.moveLocked")} disabled={!moveLocked}>
              {c.pos ? (
                <Button variant="default" data-disabled={moveLocked || undefined} onClick={() => !moveLocked && act("token:move", { id: c.id, pos: null })}>
                  {t("selected.offMap")}
                </Button>
              ) : (
                // Celular: troca para a aba Mapa e espera o toque onde ele entra.
                <Button
                  variant="default"
                  data-disabled={moveLocked || undefined}
                  onClick={() => !moveLocked && (mobile ? setPlacing({ ids: [c.id], fromId: c.summonerId }) : placeOnMap(state, c.id))}
                >
                  {t("selected.onMap")}
                </Button>
              )}
            </Tooltip>
            {!c.summonerId && (
              <Tooltip label={summonLocked ? t("rules.summonLocked") : t("selected.summonTip")}>
                <Button variant="default" leftSection={<IconWand size={14} />} data-disabled={summonLocked || undefined} onClick={() => !summonLocked && setSummoningId(c.id)}>
                  {t("selected.summon")}
                </Button>
              </Tooltip>
            )}
            <Tooltip label={t(c.torch ? "torch.offTip" : "torch.onTip")}>
              <Button
                variant={c.torch ? "light" : "default"}
                color={c.torch ? "bronze" : undefined}
                leftSection={<IconFlame size={14} />}
                aria-pressed={!!c.torch}
                onClick={() => act("torch:set", { id: c.id, lit: !c.torch })}
              >
                {t(c.torch ? "torch.off" : "torch.on")}
              </Button>
            </Tooltip>
            <AuraControl c={c} />
            {gm && c.type !== "ally" && (
              <Tooltip label={c.hidden ? t("selected.revealTip") : t("selected.hideTip")}>
                <Button
                  variant="default"
                  leftSection={c.hidden ? <IconEye size={14} /> : <IconEyeOff size={14} />}
                  onClick={() => act("combatant:setHidden", { id: c.id, hidden: !c.hidden })}
                >
                  {c.hidden ? t("selected.reveal") : t("selected.hide")}
                </Button>
              </Tooltip>
            )}
            <Button variant="subtle" color="red" onClick={() => void remove(c)}>
              {t("common.remove")}
            </Button>
          </Group>
        </>
      )}
    </Panel>
  );
}
