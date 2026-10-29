import { ActionIcon, Badge, Group, Kbd, Modal, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { IconKeyboard } from "@tabler/icons-react";
import type { ClientState } from "@rpg/shared";
import { Fragment, useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { act } from "../actions";
import { useT, type MessageKey } from "../i18n";

/** A janela de ajuda dos atalhos (`?` ou o botão da barra do topo). */
export const useShortcutsHelp = create<{ open: boolean }>(() => ({ open: false }));

/** Foco num campo de texto (ou janela aberta): os atalhos de uma letra não valem. */
export function typingOrDialog(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  return !!document.querySelector(".mantine-Modal-content, .token-menu");
}

/**
 * Atalhos gerais (L8): `?` abre a ajuda; N e Shift+N passam o turno (mestre, em combate). Os do mapa e do token
 * ficam no BattleMap, que tem a visão e a ferramenta.
 */
export function Shortcuts({ state }: { state: ClientState }) {
  const gm = state.self.role === "gm";
  const active = state.battle.combat.active;
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") {
        const el = e.target as HTMLElement | null;
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
        e.preventDefault();
        useShortcutsHelp.setState((s) => ({ open: !s.open }));
        return;
      }
      if (typingOrDialog(e) || e.repeat) return;
      if (gm && active && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void act(e.shiftKey ? "combat:prev" : "combat:next", {});
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [gm, active]);
  return <ShortcutsHelp gm={gm} />;
}

/** Botão da barra do topo que abre a ajuda. */
export function ShortcutsButton() {
  const t = useT();
  return (
    <Tooltip label={t("keys.button")}>
      <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => useShortcutsHelp.setState({ open: true })} aria-label={t("keys.title")}>
        <IconKeyboard size={18} />
      </ActionIcon>
    </Tooltip>
  );
}

type Row = { keys: ReactNode; label: string; gm?: boolean };

/** Teclas lado a lado: "Ctrl" "&" "Z" (o "&" vira um "+" entre elas). Texto solto (ex.: "arrastar") sai sem moldura. */
function keys(...parts: (string | { text: string })[]) {
  return (
    <Group gap={3} wrap="nowrap">
      {parts.map((p, i) =>
        typeof p === "string" ? (
          p === "&" ? (
            <Text key={i} span size="xs" c="dimmed">
              +
            </Text>
          ) : (
            <Kbd key={i} className="game-kbd">
              {p}
            </Kbd>
          )
        ) : (
          <Text key={i} span size="xs" c="dimmed">
            {p.text}
          </Text>
        ),
      )}
    </Group>
  );
}

function ShortcutsHelp({ gm }: { gm: boolean }) {
  const t = useT();
  const open = useShortcutsHelp((s) => s.open);
  const k = (key: MessageKey) => t(key);
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: k("keys.groupToken"),
      rows: [
        { keys: keys("D"), label: k("keys.damage") },
        { keys: keys("C"), label: k("keys.heal") },
        { keys: keys("K"), label: k("keys.conditions") },
        { keys: keys("Enter"), label: k("keys.menu") },
        { keys: keys("←", "↑", "→", "↓"), label: k("keys.step") },
        { keys: keys("T"), label: k("keys.torch") },
        { keys: keys("H"), label: k("keys.hide"), gm: true },
        { keys: keys("Del"), label: k("keys.remove") },
        { keys: keys("Esc"), label: k("keys.deselect") },
      ],
    },
    {
      title: k("keys.groupTools"),
      rows: [
        { keys: keys("V"), label: k("map.move") },
        { keys: keys("R"), label: k("map.ruler") },
        { keys: keys("A"), label: k("map.area") },
        { keys: keys("P"), label: k("map.ping") },
        { keys: keys("B"), label: k("draw.tool"), gm: true },
        { keys: keys("W"), label: k("walls.tool"), gm: true },
        { keys: keys("F"), label: k("fog.tool"), gm: true },
        { keys: keys("Shift", { text: k("keys.drag") }), label: k("keys.quickRuler") },
        { keys: keys("Alt", { text: k("keys.click") }), label: k("keys.quickPing") },
      ],
    },
    {
      title: k("keys.groupView"),
      rows: [
        { keys: keys("+", "−"), label: k("keys.zoom") },
        { keys: keys("0"), label: k("keys.fit") },
      ],
    },
    {
      title: k("keys.groupCombat"),
      rows: [
        { keys: keys("N"), label: k("keys.next"), gm: true },
        { keys: keys("Shift", "&", "N"), label: k("keys.prev"), gm: true },
      ],
    },
    {
      title: k("keys.groupGeneral"),
      rows: [
        { keys: keys("?"), label: k("keys.help") },
        { keys: keys("Ctrl", "&", "Z"), label: k("keys.undoWall"), gm: true },
        { keys: keys("Esc"), label: k("keys.escape") },
      ],
    },
  ];

  return (
    <Modal
      opened={open}
      onClose={() => useShortcutsHelp.setState({ open: false })}
      size={760}
      title={
        <Group gap={8}>
          <IconKeyboard size={20} />
          {t("keys.title")}
        </Group>
      }
      classNames={{ content: "plaque keys-modal" }}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {t("keys.lead")}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" verticalSpacing="xs">
          {[groups.slice(0, 1), groups.slice(1)].map((col, i) => (
            <Stack key={i} gap="sm">
              {col.map((g) => (
                <div key={g.title}>
                  <div className="keys-group">{g.title}</div>
                  {g.rows.map((r) => (
                    <Fragment key={r.label}>
                      <Group justify="space-between" wrap="nowrap" gap="xs" className="keys-row" data-dimmed={r.gm && !gm ? true : undefined}>
                        <Text size="sm" style={{ minWidth: 0 }}>
                          {r.label}
                          {r.gm && (
                            <Badge ml={6} size="xs" variant="outline" color="bronze">
                              {t("keys.gmOnly")}
                            </Badge>
                          )}
                        </Text>
                        {r.keys}
                      </Group>
                    </Fragment>
                  ))}
                </div>
              ))}
            </Stack>
          ))}
        </SimpleGrid>
        <Group gap={6} className="keys-foot">
          <Kbd className="game-kbd">?</Kbd>
          <Text size="xs" c="dimmed">
            {t("keys.footer")}
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
}
