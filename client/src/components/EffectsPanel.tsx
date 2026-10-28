import { ActionIcon, Badge, Group, Stack, Switch, Text, Tooltip } from "@mantine/core";
import { IconLink, IconLinkOff, IconTransform, IconTrash } from "@tabler/icons-react";
import type { ClientState, MapEffect } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { allCombatants } from "../format";
import { useT } from "../i18n";
import { EffectSwatch } from "./FixEffectModal";
import { Panel } from "./Panel";
import { TransformEffectModal } from "./TransformEffectModal";

/** Efeitos persistentes no mapa (E19): quem conjurou, rounds restantes, transformar (E24), ligar/desligar e remover. */
export function EffectsPanel({ state }: { state: ClientState }) {
  const t = useT();
  const gm = state.self.role === "gm";
  const { effects } = state.battle;
  const nameOf = (id: string | null) => (id ? allCombatants(state).find((c) => c.id === id)?.name : undefined);
  const [transforming, setTransforming] = useState<MapEffect | null>(null);

  return (
    <Panel
      title={t("effects.title")}
      aside={
        <Badge variant="default" size="sm">
          {effects.length}
        </Badge>
      }
    >
      {effects.length === 0 ? (
        <Text size="xs" c="dimmed">
          {t("effects.none")}
        </Text>
      ) : (
        <Stack gap={6}>
          {effects.map((e) => {
            const canEdit = gm || e.ownerId === state.self.id;
            const caster = nameOf(e.casterId) ?? t("effects.ambient");
            const detail =
              `${caster}${e.rounds !== null ? ` · ${t("common.rounds", { n: e.rounds })}` : ""}${e.concentration ? ` · ${t("effects.concentration")}` : ""}` +
              // Quem conjurou já está no começo: preso a ele, basta "anda junto".
              (e.followId ? ` · ${e.followId === e.casterId ? t("effects.followingCaster") : t("effects.following", { name: nameOf(e.followId) ?? "?" })}` : "") +
              (e.revertTo ? ` · ${t("effects.revertsTo", { name: e.revertTo.name })}` : "");
            const follows = !!e.followId;
            return (
              <Group key={e.id} gap="xs" wrap="nowrap" style={{ opacity: e.active ? 1 : 0.55 }}>
                <EffectSwatch preset={e.preset} color={e.color} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" truncate title={e.name}>
                    {e.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate title={detail}>
                    {detail}
                  </Text>
                </div>
                {/* Qualquer um transforma um efeito que vê: é a magia dele agindo na área (E24). */}
                {(gm || e.active) && (
                  <Tooltip label={t("effects.transformTip")}>
                    <ActionIcon size="sm" aria-label={t("effects.transformOf", { name: e.name })} onClick={() => setTransforming(e)}>
                      <IconTransform size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {canEdit && e.casterId && (
                  <Tooltip label={t(follows ? "effects.unfollow" : "effects.followTip", { name: caster })}>
                    <ActionIcon
                      size="sm"
                      variant={follows ? "light" : "subtle"}
                      color={follows ? "bronze" : undefined}
                      aria-label={t(follows ? "effects.unfollow" : "effects.followTip", { name: caster })}
                      aria-pressed={follows}
                      onClick={() => act("effect:follow", { id: e.id, follow: !follows })}
                    >
                      {follows ? <IconLink size={16} /> : <IconLinkOff size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip label={e.active ? t("effects.disableTip") : t("effects.enable")}>
                    <Switch
                      size="xs"
                      checked={e.active}
                      onChange={(ev) => void act("effect:toggle", { id: e.id, active: ev.currentTarget.checked })}
                      aria-label={t(e.active ? "effects.disableOf" : "effects.enableOf", { name: e.name })}
                    />
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip label={t("effects.remove")}>
                    <ActionIcon size="sm" aria-label={t("mobs.removeOf", { name: e.name })} onClick={() => act("effect:remove", { id: e.id })}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            );
          })}
        </Stack>
      )}
      {transforming && <TransformEffectModal state={state} effect={transforming} onClose={() => setTransforming(null)} />}
    </Panel>
  );
}
