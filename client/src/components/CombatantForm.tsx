import { Box, Button, Checkbox, ColorInput, Group, NumberInput, Paper, Stack, Textarea, TextInput, Tooltip } from "@mantine/core";
import { LIMITS, NAME_MAX_LENGTH, type CombatantInput } from "@rpg/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { Abbr } from "./Abbr";
import { AvatarPicker } from "./AvatarPicker";

export interface FormValues extends CombatantInput {
  notes?: string;
}

interface Props {
  initial?: Partial<FormValues>;
  palette: string[];
  submitLabel: string;
  withNotes?: boolean;
  /** Caixa "Já entra oculto" (criar mob ou NPC, E21). */
  withHidden?: boolean;
  /** Campos a mais antes dos botões (ex.: quantidade e concentração ao conjurar). */
  extra?: ReactNode;
  onSubmit: (values: FormValues) => Promise<boolean>;
  onCancel?: () => void;
}

/** Formulário de nome, vida máxima, mod. de Destreza, cor, avatar e marca de animal (mob, NPC, template ou aliado). */
export function CombatantForm({ initial, palette, submitLabel, withNotes, withHidden, extra, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [hpMax, setHpMax] = useState<string | number>(initial?.hpMax ?? "");
  const [dexMod, setDexMod] = useState<string | number>(initial?.dexMod ?? 0);
  const [color, setColor] = useState(initial?.color ?? palette[0]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [avatar, setAvatar] = useState<string | null>(initial?.avatar ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [animal, setAnimal] = useState(initial?.animal ?? false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit({
      name,
      hpMax: Number(hpMax),
      dexMod: Number(dexMod),
      color,
      notes: withNotes ? notes : undefined,
      animal,
      hidden: withHidden ? hidden : undefined,
      // Só envia o avatar se mudou: é o campo mais pesado do formulário.
      avatar: avatarChanged ? avatar : undefined,
    });
    setBusy(false);
    if (ok && !initial) {
      setName("");
      setHpMax("");
      setDexMod(0);
      setNotes("");
      setAvatar(null);
      setAvatarChanged(false);
      setAnimal(false);
    }
  }

  return (
    <Paper component="form" onSubmit={submit} p="sm" bg="dark.7">
      <Stack gap="sm">
        <TextInput
          label="Nome"
          autoFocus
          required
          value={name}
          maxLength={NAME_MAX_LENGTH}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Group grow gap="sm" align="flex-start">
          <NumberInput
            label={<Abbr title="Vida máxima (pontos de vida)">Vida máx.</Abbr>}
            required
            min={LIMITS.hpMax.min}
            max={LIMITS.hpMax.max}
            allowDecimal={false}
            value={hpMax}
            onChange={setHpMax}
          />
          <NumberInput
            label={<Abbr title="Modificador de Destreza (usado na iniciativa: d20 + mod. DES)">Mod. DES</Abbr>}
            required
            min={LIMITS.dexMod.min}
            max={LIMITS.dexMod.max}
            allowDecimal={false}
            value={dexMod}
            onChange={setDexMod}
          />
        </Group>
        <ColorInput
          label="Cor"
          format="hex"
          value={color}
          onChange={setColor}
          swatches={palette}
          swatchesPerRow={palette.length}
          withEyeDropper={false}
        />
        <AvatarPicker
          value={avatar}
          color={color}
          onChange={(a) => {
            setAvatar(a);
            setAvatarChanged(true);
          }}
        />
        <Group gap="md">
          <Tooltip label="Mostra uma pata no token e na lista. O formato continua dizendo o lado (aliado, inimigo ou neutro).">
            <Box>
              <Checkbox label="Animal" checked={animal} onChange={(e) => setAnimal(e.currentTarget.checked)} />
            </Box>
          </Tooltip>
          {withHidden && (
            <Tooltip label="Só você vê (furtividade, sala escura); fica fora da iniciativa até você revelar">
              <Box>
                <Checkbox label="Já entra oculto" checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} />
              </Box>
            </Tooltip>
          )}
        </Group>
        {withNotes && (
          <Textarea
            label="Notas (opcional)"
            maxLength={LIMITS.notes}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
        )}
        {extra}
        <Group justify="flex-end" gap="xs">
          {onCancel && (
            <Button variant="default" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
