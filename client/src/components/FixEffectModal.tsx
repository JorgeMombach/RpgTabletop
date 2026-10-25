import { Button, Checkbox, ColorInput, Group, Image, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { EFFECT_PRESETS, LIMITS, type Area, type ClientState, type EffectPreset } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { allCombatants } from "../format";
import { effectPreview } from "../map/effectTextures";

export const PRESETS = Object.keys(EFFECT_PRESETS) as EffectPreset[];
const NO_CASTER = "__ambiente";

function Swatch({ preset, color, size = 20 }: { preset: EffectPreset; color: string; size?: number }) {
  return <Image src={effectPreview(preset, color)} w={size} h={size} radius="sm" style={{ border: `1px solid ${color}`, flex: "none" }} alt="" />;
}

/** Campos de um efeito (tipo, nome, cor, conjurador, duração, concentração): fixar (E19) e transformar (E24). */
export function useEffectForm(state: ClientState, initialPreset: EffectPreset) {
  const gm = state.self.role === "gm";
  // Jogador conjura com o próprio personagem; o mestre, com qualquer combatente ou "ambiente".
  const casters = gm ? allCombatants(state) : state.allies.filter((a) => a.ownerId === state.self.id);
  const [preset, setPreset] = useState<EffectPreset>(initialPreset);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(EFFECT_PRESETS.custom.color);
  const [casterId, setCasterId] = useState<string>(gm ? NO_CASTER : (casters[0]?.id ?? ""));
  const [rounds, setRounds] = useState<string | number>("");
  const [concentration, setConcentration] = useState(false);
  const hasCaster = casterId !== NO_CASTER && casterId !== "";

  return {
    gm,
    casters,
    fields: { preset, setPreset, name, setName, color, setColor, casterId, setCasterId, rounds, setRounds, concentration, setConcentration, hasCaster },
    /** Valores para enviar ao servidor. */
    values: () => ({
      name: name.trim() || EFFECT_PRESETS[preset].label,
      preset,
      color: preset === "custom" ? color : undefined,
      casterId: hasCaster ? casterId : null,
      rounds: rounds === "" ? null : Number(rounds),
      concentration: hasCaster && concentration,
    }),
    /** Jogador sem personagem não conjura. */
    blocked: !gm && casters.length === 0,
  };
}

type EffectForm = ReturnType<typeof useEffectForm>;

/** Os campos na tela. `suggested` = tipos que aparecem primeiro (transformações comuns). */
export function EffectFormFields({ form, suggested = [] }: { form: EffectForm; suggested?: EffectPreset[] }) {
  const { gm, casters } = form;
  const f = form.fields;
  const item = (p: EffectPreset) => ({ value: p, label: EFFECT_PRESETS[p].label });
  const others = PRESETS.filter((p) => !suggested.includes(p));
  const data = suggested.length > 0 ? [{ group: "Sugeridos", items: suggested.map(item) }, { group: "Outros", items: others.map(item) }] : PRESETS.map(item);

  return (
    <>
      <Select
        label="Efeito"
        data={data}
        value={f.preset}
        onChange={(v) => v && f.setPreset(v as EffectPreset)}
        allowDeselect={false}
        leftSection={<Swatch preset={f.preset} color={f.color} />}
        renderOption={({ option }) => (
          <Group gap="xs" wrap="nowrap">
            <Swatch preset={option.value as EffectPreset} color={f.color} />
            <Text size="sm">{option.label}</Text>
          </Group>
        )}
        comboboxProps={{ withinPortal: true }}
      />
      {f.preset === "custom" && <ColorInput label="Cor" value={f.color} onChange={f.setColor} format="hex" />}
      <TextInput
        label="Nome"
        placeholder={EFFECT_PRESETS[f.preset].label}
        maxLength={LIMITS.effectName}
        value={f.name}
        onChange={(e) => f.setName(e.currentTarget.value)}
      />
      {form.blocked ? (
        <Text size="sm" c="red.4">
          Crie seu personagem antes de conjurar um efeito.
        </Text>
      ) : (
        <Select
          label="Quem conjurou"
          description="A duração desconta no início do turno de quem conjurou."
          data={[...(gm ? [{ value: NO_CASTER, label: "Ninguém (ambiente: conta a cada round)" }] : []), ...casters.map((c) => ({ value: c.id, label: c.name }))]}
          value={f.casterId}
          onChange={(v) => v && f.setCasterId(v)}
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
        value={f.rounds}
        onChange={f.setRounds}
      />
      <Checkbox
        checked={f.concentration && f.hasCaster}
        disabled={!f.hasCaster}
        onChange={(e) => f.setConcentration(e.currentTarget.checked)}
        label="Concentração"
        description={f.hasCaster ? "Some quando o conjurador perder a Concentração (ele ganha a condição agora)." : "Escolha quem conjurou."}
      />
    </>
  );
}

/** Fixar a área desenhada como efeito no mapa (E19). */
export function FixEffectModal({ state, area, onClose, onFixed }: { state: ClientState; area: Area; onClose: () => void; onFixed: () => void }) {
  const form = useEffectForm(state, "web");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await act("effect:add", { ...form.values(), area });
    if (res.ok) onFixed();
  }

  return (
    <Modal opened onClose={onClose} title="Fixar como efeito no mapa" centered>
      <Stack component="form" gap="sm" onSubmit={submit}>
        <EffectFormFields form={form} />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.blocked}>
            Fixar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export { Swatch as EffectSwatch };
