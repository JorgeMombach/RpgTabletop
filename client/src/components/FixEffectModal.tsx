import { Button, Checkbox, ColorInput, Group, Image, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { EFFECT_PRESETS, LIMITS, type Area, type ClientState, type EffectPreset } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { allCombatants } from "../format";
import { effectPreview } from "../map/effectTextures";

const PRESETS = Object.keys(EFFECT_PRESETS) as EffectPreset[];
const NO_CASTER = "__ambiente";

function Swatch({ preset, color, size = 20 }: { preset: EffectPreset; color: string; size?: number }) {
  return <Image src={effectPreview(preset, color)} w={size} h={size} radius="sm" style={{ border: `1px solid ${color}`, flex: "none" }} alt="" />;
}

/** Fixar a área desenhada como efeito no mapa (E19). */
export function FixEffectModal({ state, area, onClose, onFixed }: { state: ClientState; area: Area; onClose: () => void; onFixed: () => void }) {
  const gm = state.self.role === "gm";
  // Jogador conjura com o próprio personagem; o mestre, com qualquer combatente ou "ambiente".
  const casters = gm ? allCombatants(state) : state.allies.filter((a) => a.ownerId === state.self.id);
  const [preset, setPreset] = useState<EffectPreset>("web");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(EFFECT_PRESETS.custom.color);
  const [casterId, setCasterId] = useState<string>(gm ? NO_CASTER : (casters[0]?.id ?? ""));
  const [rounds, setRounds] = useState<string | number>("");
  const [concentration, setConcentration] = useState(false);
  const hasCaster = casterId !== NO_CASTER && casterId !== "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await act("effect:add", {
      name: name.trim() || EFFECT_PRESETS[preset].label,
      preset,
      color: preset === "custom" ? color : undefined,
      area,
      casterId: hasCaster ? casterId : null,
      rounds: rounds === "" ? null : Number(rounds),
      concentration: hasCaster && concentration,
    });
    if (res.ok) onFixed();
  }

  return (
    <Modal opened onClose={onClose} title="Fixar como efeito no mapa" centered>
      <Stack component="form" gap="sm" onSubmit={submit}>
        <Select
          label="Efeito"
          data={PRESETS.map((p) => ({ value: p, label: EFFECT_PRESETS[p].label }))}
          value={preset}
          onChange={(v) => v && setPreset(v as EffectPreset)}
          allowDeselect={false}
          leftSection={<Swatch preset={preset} color={color} />}
          renderOption={({ option }) => (
            <Group gap="xs" wrap="nowrap">
              <Swatch preset={option.value as EffectPreset} color={color} />
              <Text size="sm">{option.label}</Text>
            </Group>
          )}
          comboboxProps={{ withinPortal: true }}
        />
        {preset === "custom" && <ColorInput label="Cor" value={color} onChange={setColor} format="hex" />}
        <TextInput
          label="Nome"
          placeholder={EFFECT_PRESETS[preset].label}
          maxLength={LIMITS.effectName}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        {casters.length === 0 && !gm ? (
          <Text size="sm" c="red.4">
            Crie seu personagem antes de conjurar um efeito.
          </Text>
        ) : (
          <Select
            label="Quem conjurou"
            description="A duração desconta no início do turno de quem conjurou."
            data={[...(gm ? [{ value: NO_CASTER, label: "Ninguém (ambiente: conta a cada round)" }] : []), ...casters.map((c) => ({ value: c.id, label: c.name }))]}
            value={casterId}
            onChange={(v) => v && setCasterId(v)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        )}
        <NumberInput
          label="Duração em rounds"
          placeholder="Sem duração (fica até alguém tirar)"
          min={LIMITS.conditionRounds.min}
          max={LIMITS.conditionRounds.max}
          allowDecimal={false}
          allowNegative={false}
          clampBehavior="strict"
          value={rounds}
          onChange={setRounds}
        />
        <Checkbox
          checked={concentration && hasCaster}
          disabled={!hasCaster}
          onChange={(e) => setConcentration(e.currentTarget.checked)}
          label="Concentração"
          description={hasCaster ? "Some quando o conjurador perder a Concentração (ele ganha a condição agora)." : "Escolha quem conjurou."}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!gm && casters.length === 0}>
            Fixar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export { Swatch as EffectSwatch };
