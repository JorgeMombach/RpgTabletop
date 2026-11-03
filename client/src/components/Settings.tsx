import { ActionIcon, Checkbox, Modal, SegmentedControl, Select, Slider, Stack, Switch, Text, Tooltip } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import type { ClientState, OutsideRolls, TableRules } from "@rpg/shared";
import { useState, type ReactNode } from "react";
import { act } from "../actions";
import { LANGS, setLang, useLang, useT, type Lang, type MessageKey } from "../i18n";
import { setDicePrefs, setVolume, useApp, useVolume } from "../store";

/** Regras da mesa, cada uma com nome e explicação. */
const RULE: Record<keyof TableRules, [MessageKey, MessageKey]> = {
  moveOnTurn: ["rules.moveOnTurn", "rules.moveOnTurnHint"],
  summonOnTurn: ["rules.summonOnTurn", "rules.summonOnTurnHint"],
  effectOnTurn: ["rules.effectOnTurn", "rules.effectOnTurnHint"],
  hideFoeHits: ["rules.hideFoeHits", "rules.hideFoeHitsHint"],
  darkReminder: ["rules.darkReminder", "rules.darkReminderHint"],
};
const TURN_RULES: (keyof TableRules)[] = ["moveOnTurn", "summonOnTurn", "effectOnTurn"];
const SEEN_RULES: (keyof TableRules)[] = ["hideFoeHits", "darkReminder"];

const OUTSIDE: { value: OutsideRolls; label: MessageKey }[] = [
  { value: "free", label: "dice.outsideFree" },
  { value: "request", label: "dice.outsideRequest" },
  { value: "locked", label: "dice.outsideLocked" },
];

/**
 * Configurações (depois da 2.11): a engrenagem no topo junta as opções que estavam espalhadas. "Mesa" (só o
 * mestre) vale para todos e vai no arquivo de sessão; "Este dispositivo" vale só para quem mexe, neste navegador.
 * Os atalhos de sempre (idioma e volume no topo, efeitos na barra do mapa, animação no log) continuam onde estão.
 */
export function SettingsButton({ state, size = "lg" }: { state: ClientState; size?: "md" | "lg" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip label={t("settings.tip")}>
        <ActionIcon variant="default" size={size} aria-label={t("settings.title")} onClick={() => setOpen(true)}>
          <IconSettings size={18} />
        </ActionIcon>
      </Tooltip>
      <Modal opened={open} onClose={() => setOpen(false)} title={t("settings.title")} size="md">
        <SettingsBody state={state} />
      </Modal>
    </>
  );
}

function SettingsBody({ state }: { state: ClientState }) {
  const t = useT();
  const gm = state.self.role === "gm";
  const [tab, setTab] = useState<"table" | "device">(gm ? "table" : "device");
  return (
    <Stack gap="md">
      {gm && (
        <SegmentedControl
          fullWidth
          data={[
            { value: "table", label: t("settings.table") },
            { value: "device", label: t("settings.device") },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "table" | "device")}
          aria-label={t("settings.title")}
        />
      )}
      {gm && tab === "table" ? <TableSettings state={state} /> : <DeviceSettings />}
    </Stack>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <div>
        <Text size="xs" fw={600} tt="uppercase" c="bronze.4" style={{ letterSpacing: "0.06em" }}>
          {title}
        </Text>
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </div>
      {children}
    </Stack>
  );
}

/** Mestre: o que vale para a mesa toda (regras e rolagens), com aviso no log. */
function TableSettings({ state }: { state: ClientState }) {
  const t = useT();
  const rule = (key: keyof TableRules) => (
    <Checkbox
      key={key}
      label={t(RULE[key][0])}
      description={t(RULE[key][1])}
      checked={state.rules[key]}
      onChange={(e) => void act("rules:set", { [key]: e.currentTarget.checked })}
    />
  );
  return (
    <Stack gap="lg">
      <Text size="xs" c="dimmed">
        {t("settings.tableHint")}
      </Text>
      <Section title={t("settings.turn")} hint={t("settings.turnHint")}>
        {TURN_RULES.map(rule)}
      </Section>
      <Section title={t("dice.outside")} hint={t("dice.outsideTip")}>
        <SegmentedControl
          fullWidth
          data={OUTSIDE.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={state.battle.rolls.outside}
          onChange={(v) => void act("roll:outside", { mode: v as OutsideRolls })}
          aria-label={t("dice.outside")}
        />
      </Section>
      <Section title={t("settings.seen")}>{SEEN_RULES.map(rule)}</Section>
    </Stack>
  );
}

/** Cada um, só neste navegador. */
function DeviceSettings() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { volume, muted } = useVolume();
  const { diceAnim, reduceFx, followTurn } = useApp();
  return (
    <Stack gap="lg">
      <Text size="xs" c="dimmed">
        {t("settings.deviceHint")}
      </Text>
      <Select
        label={t("lang.label")}
        data={(Object.keys(LANGS) as Lang[]).map((l) => ({ value: l, label: LANGS[l] }))}
        value={lang}
        onChange={(v) => v && setLang(v as Lang)}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
      />
      <Section title={t("volume.overall")} hint={t("volume.hint")}>
        <Slider
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(v) => setVolume({ volume: v / 100, muted: false })}
          label={(v) => `${v}%`}
          aria-label={t("volume.overall")}
        />
        <Switch label={t("volume.mute")} checked={muted} onChange={(e) => setVolume({ muted: e.currentTarget.checked })} />
      </Section>
      <Section title={t("settings.screen")}>
        <Switch label={t("dice.anim")} description={t("settings.diceAnimHint")} checked={diceAnim} onChange={(e) => setDicePrefs({ diceAnim: e.currentTarget.checked })} />
        <Switch label={t("map.reduceFx")} description={t("settings.reduceFxHint")} checked={reduceFx} onChange={(e) => setDicePrefs({ reduceFx: e.currentTarget.checked })} />
        <Switch label={t("map.followTurn")} description={t("settings.followTurnHint")} checked={followTurn} onChange={(e) => setDicePrefs({ followTurn: e.currentTarget.checked })} />
      </Section>
    </Stack>
  );
}
