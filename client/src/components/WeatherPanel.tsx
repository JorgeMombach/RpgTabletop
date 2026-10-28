import { Button, SegmentedControl, Select, Slider, Stack, Text } from "@mantine/core";
import { IconVolume } from "@tabler/icons-react";
import { LIGHTS, LIMITS, WEATHERS, type ClientState, type LightId, type WeatherId } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { inTheDark } from "../format";
import { t as tr, useT } from "../i18n";
import { lightLabel, soundLabel, weatherGroupLabel, weatherLabel } from "../labels";
import { Panel } from "./Panel";

const NONE = "__nenhum";

/** Climas agrupados para o seletor, com "Sem clima" no topo (no idioma de quem lê). */
const options = () => [
  { group: tr("weather.clearSky"), items: [{ value: NONE, label: tr("weather.none") }] },
  ...[...new Set(Object.values(WEATHERS).map((w) => w.group))].map((group) => ({
    group: weatherGroupLabel(group),
    items: Object.entries(WEATHERS)
      .filter(([, w]) => w.group === group)
      .map(([id]) => ({ value: id, label: weatherLabel(id as WeatherId) })),
  })),
];

/** Controle deslizante que só manda ao servidor quando solta (como os volumes do E25). */
function LiveSlider(props: { value: number; min: number; max: number; label: (v: number) => string; onCommit: (v: number) => void; ariaLabel: string; marks?: { value: number; label: string }[] }) {
  const [local, setLocal] = useState<number | null>(null);
  return (
    <Slider
      min={props.min}
      max={props.max}
      value={local ?? props.value}
      onChange={setLocal}
      onChangeEnd={(v) => {
        setLocal(null);
        props.onCommit(v);
      }}
      label={props.label}
      marks={props.marks}
      aria-label={props.ariaLabel}
    />
  );
}

/**
 * Clima e luz do mapa (E26), só para o mestre: todos veem igual, por cima do mapa.
 * Sugere o ambiente sonoro que combina (E25), sem ligar sozinho.
 */
export function WeatherPanel({ state }: { state: ClientState }) {
  const t = useT();
  const w = state.battle.weather;
  // Lembrete de escuridão: o mestre vê quem está sem visão no escuro.
  const dark = inTheDark(state);
  const info = w.kind ? WEATHERS[w.kind] : null;
  const sound = info?.sound ?? null;
  const ambient = state.sound.ambient?.source;
  const soundPlaying = !!sound && ambient?.kind === "gen" && ambient.id === sound;

  return (
    <Panel title={t("weather.title")}>
      <Select
        label={t("weather.title")}
        data={options()}
        value={w.kind ?? NONE}
        onChange={(v) => v && act("weather:set", { kind: v === NONE ? null : (v as WeatherId) })}
        allowDeselect={false}
        searchable
        selectFirstOptionOnChange
        comboboxProps={{ withinPortal: true }}
      />
      {w.kind && (
        <>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              {t("weather.intensity")}
            </Text>
            <LiveSlider
              min={Math.round(LIMITS.weatherIntensity.min * 100)}
              max={100}
              value={Math.round(w.intensity * 100)}
              label={(v) => `${v}%`}
              onCommit={(v) => act("weather:set", { intensity: v / 100 })}
              ariaLabel={t("weather.intensityLabel")}
            />
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              {t("weather.wind")}
            </Text>
            <LiveSlider
              min={LIMITS.weatherWind.min}
              max={LIMITS.weatherWind.max}
              value={w.wind}
              label={(v) => (v === 0 ? t("weather.noWind") : t(v < 0 ? "weather.windLeft" : "weather.windRight", { deg: Math.abs(v) }))}
              onCommit={(v) => act("weather:set", { wind: v })}
              ariaLabel={t("weather.windLabel")}
            />
          </Stack>
          {sound && !soundPlaying && (
            <Button
              variant="default"
              leftSection={<IconVolume size={14} />}
              onClick={() => act("sound:play", { channel: "ambient", source: { kind: "gen", id: sound } })}
            >
              {t("weather.playAmbient", { name: soundLabel(sound) })}
            </Button>
          )}
        </>
      )}
      <Stack gap={2}>
        <Text size="xs" c="dimmed">
          {t("weather.light")}
        </Text>
        <SegmentedControl
          fullWidth
          data={(Object.keys(LIGHTS) as LightId[]).map((value) => ({ value, label: lightLabel(value) }))}
          value={w.light}
          onChange={(v) => act("weather:set", { light: v as LightId })}
          aria-label={t("weather.lightLabel")}
        />
        {dark.length > 0 && (
          <Text size="xs" c="bronze.4" mt={4}>
            {t("dark.gmList", { names: dark.map((a) => a.name).join(", ") })}
          </Text>
        )}
      </Stack>
    </Panel>
  );
}
