import { ActionIcon, Badge, Button, Group, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { LIMITS, type ClientState } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT } from "../i18n";
import { Panel } from "./Panel";

type SceneRow = NonNullable<ClientState["scenes"]>[number];

/**
 * Cenas (vários mapas na sessão), só o mestre: cada uma guarda imagem e grid, mobs, NPCs, efeitos,
 * desenhos, paredes, clima e onde os aliados estavam. Trocar guarda a atual e carrega a outra.
 */
export function ScenesPanel({ state }: { state: ClientState }) {
  const t = useT();
  const scenes = state.scenes ?? [];
  const inCombat = state.battle.combat.active;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function add() {
    const res = await act("scene:add", { name: name.trim() || t("scenes.defaultName", { n: scenes.length + 1 }) });
    if (res.ok) {
      setAdding(false);
      setName("");
    }
  }

  async function open(s: SceneRow) {
    // A iniciativa é da cena que sai: avisa antes de zerar uma ordem já rolada.
    if (state.battle.combat.order.length > 0) {
      const ok = await confirmAction({ title: t("scenes.switchTitle", { name: s.name }), message: t("scenes.switchMessage"), confirmLabel: t("scenes.open") });
      if (!ok) return;
    }
    void act("scene:switch", { id: s.id });
  }

  async function remove(s: SceneRow) {
    const ok = await confirmAction({ title: t("scenes.removeTitle", { name: s.name }), message: t("scenes.removeMessage"), confirmLabel: t("scenes.remove") });
    if (ok) void act("scene:remove", { id: s.id });
  }

  return (
    <Panel
      title={t("scenes.title")}
      aside={
        <Tooltip label={t("scenes.addTip")}>
          <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>
            {t("scenes.add")}
          </Button>
        </Tooltip>
      }
    >
      {adding && (
        <Group
          component="form"
          gap="xs"
          wrap="nowrap"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <TextInput
            autoFocus
            style={{ flex: 1 }}
            maxLength={LIMITS.sceneName}
            placeholder={t("scenes.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            aria-label={t("scenes.name")}
          />
          <Button type="submit">{t("scenes.create")}</Button>
        </Group>
      )}
      <Stack gap={4}>
        {scenes.map((s) => (
          <SceneItem
            key={s.id}
            s={s}
            active={s.id === state.sceneId}
            inCombat={inCombat}
            onOpen={() => void open(s)}
            onRemove={() => void remove(s)}
          />
        ))}
      </Stack>
      <Text size="xs" c="dimmed">
        {t("scenes.hint")}
      </Text>
    </Panel>
  );
}

function SceneItem({ s, active, inCombat, onOpen, onRemove }: { s: SceneRow; active: boolean; inCombat: boolean; onOpen: () => void; onRemove: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState<string | null>(null);

  if (editing !== null) {
    const save = async () => {
      if ((await act("scene:rename", { id: s.id, name: editing })).ok) setEditing(null);
    };
    return (
      <Group
        component="form"
        gap={4}
        wrap="nowrap"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextInput
          autoFocus
          style={{ flex: 1 }}
          maxLength={LIMITS.sceneName}
          value={editing}
          onChange={(e) => setEditing(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
          aria-label={t("scenes.name")}
        />
        <ActionIcon type="submit" variant="filled" aria-label={t("scenes.save")}>
          <IconCheck size={14} />
        </ActionIcon>
        <ActionIcon onClick={() => setEditing(null)} aria-label={t("scenes.cancel")}>
          <IconX size={14} />
        </ActionIcon>
      </Group>
    );
  }

  const detail = [s.hasImage ? t("scenes.withMap") : t("scenes.noMap"), t("scenes.mobs", { n: s.mobs })].join(" · ");
  return (
    <Group gap={6} wrap="nowrap" className={`scene-row ${active ? "active" : ""}`}>
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={active ? 600 : 400} truncate title={s.name}>
          {s.name}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {detail}
        </Text>
      </Stack>
      {active ? (
        <Badge variant="light" color="bronze" size="sm">
          {t("scenes.current")}
        </Badge>
      ) : (
        <Tooltip label={inCombat ? t("scenes.inCombat") : t("scenes.openTip")}>
          <Button size="compact-sm" variant="default" disabled={inCombat} onClick={onOpen}>
            {t("scenes.open")}
          </Button>
        </Tooltip>
      )}
      <Tooltip label={t("scenes.rename")}>
        <ActionIcon size="sm" aria-label={t("scenes.rename")} onClick={() => setEditing(s.name)}>
          <IconPencil size={14} />
        </ActionIcon>
      </Tooltip>
      {!active && (
        <Tooltip label={t("scenes.remove")}>
          <ActionIcon size="sm" color="red" aria-label={t("scenes.remove")} onClick={onRemove}>
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
