import { Anchor, Badge, Group, Progress, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconCheck, IconChevronRight } from "@tabler/icons-react";
import type { ClientState } from "@rpg/shared";
import { useState } from "react";
import { useT, type MessageKey } from "../i18n";
import { openGmTab, type GmTab } from "./GmTabs";
import { Panel } from "./Panel";

/** Escolhas do cartão nesta aba do navegador (sessionStorage): "só o grid" e "pular". Sessão nova, cartão de novo. */
const KEY = "rpg.setup";

function readFlags(): { gridOnly?: boolean; skipped?: boolean } {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeFlags(flags: { gridOnly?: boolean; skipped?: boolean }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(flags));
  } catch {
    // sem armazenamento: vale até recarregar
  }
}

interface Step {
  id: "map" | "mobs" | "players";
  title: MessageKey;
  hint: MessageKey;
  done: boolean;
  tab: GmTab;
  anchor: string;
}

/**
 * Cartão "Preparar a mesa" (L8), só do mestre, no topo da aba Combate: Mapa → Monstros → Convidar jogadores.
 * Cada passo leva à aba e ao painel certos; os passos se marcam sozinhos pelo estado da mesa (convidar
 * conta feito se algum jogador entrou ou já existe personagem, de uma sessão carregada). Some quando os
 * três estão feitos ou com "Pular".
 */
export function SetupCard({ state }: { state: ClientState }) {
  const t = useT();
  const [flags, setFlags] = useState(readFlags);
  const update = (next: typeof flags) => {
    setFlags(next);
    writeFlags(next);
  };

  const steps: Step[] = [
    { id: "map", title: "setup.map", hint: "setup.mapHint", done: state.battle.map.hasImage || !!flags.gridOnly, tab: "map", anchor: "map" },
    {
      id: "mobs",
      title: "setup.mobs",
      hint: "setup.mobsHint",
      done: state.battle.mobs.length > 0 || state.templates.length > 0,
      tab: "table",
      anchor: "bestiary",
    },
    { id: "players", title: "setup.players", hint: "setup.playersHint", done: state.players.some((p) => p.role === "player") || state.allies.length > 0, tab: "table", anchor: "invite" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (flags.skipped || doneCount === steps.length || state.self.role !== "gm") return null;
  const next = steps.find((s) => !s.done)?.id;

  return (
    <Panel
      title={t("setup.title")}
      className="setup-card highlighted"
      aside={
        <Badge color="copper" variant="light" size="sm">
          {t("setup.progress", { n: doneCount })}
        </Badge>
      }
    >
      <Progress value={(doneCount / steps.length) * 100} size={4} color="bronze" mt={-6} />
      <Stack gap={4}>
        {steps.map((s, i) => (
          <UnstyledButton
            key={s.id}
            className={`setup-step${s.done ? " done" : ""}${s.id === next ? " next" : ""}`}
            onClick={() => openGmTab(s.tab, s.anchor)}
          >
            <span className="setup-num" aria-hidden>
              {s.done ? <IconCheck size={15} stroke={3} /> : i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={700} td={s.done ? "line-through" : undefined} c={s.done ? "dimmed" : undefined}>
                {t(s.title)}
              </Text>
              <Text size="xs" c="dimmed" lh={1.3}>
                {t(s.hint)}
                {s.id === "map" && !s.done && (
                  <>
                    {" "}
                    <Anchor
                      component="span"
                      size="xs"
                      c="bronze.4"
                      onClick={(e) => {
                        e.stopPropagation();
                        update({ ...flags, gridOnly: true });
                      }}
                    >
                      {t("setup.gridOnly")}
                    </Anchor>
                  </>
                )}
              </Text>
            </span>
            <IconChevronRight size={14} className="setup-go" aria-hidden />
          </UnstyledButton>
        ))}
      </Stack>
      <Group justify="space-between" gap="xs" className="setup-foot">
        <Text size="xs" c="dimmed">
          {t("setup.footer")}
        </Text>
        <Tooltip label={t("setup.skipTip")}>
          <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => update({ ...flags, skipped: true })}>
            {t("setup.skip")}
          </Anchor>
        </Tooltip>
      </Group>
    </Panel>
  );
}
