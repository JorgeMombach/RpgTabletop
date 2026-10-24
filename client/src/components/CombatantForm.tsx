import { useState, type FormEvent } from "react";
import { LIMITS, NAME_MAX_LENGTH, type CombatantInput } from "@rpg/shared";
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
  onSubmit: (values: FormValues) => Promise<boolean>;
  onCancel?: () => void;
}

/** Formulário de nome, vida máxima, mod. de Destreza e cor (mob, template ou aliado). */
export function CombatantForm({ initial, palette, submitLabel, withNotes, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [hpMax, setHpMax] = useState(String(initial?.hpMax ?? ""));
  const [dexMod, setDexMod] = useState(String(initial?.dexMod ?? 0));
  const [color, setColor] = useState(initial?.color ?? palette[0]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [avatar, setAvatar] = useState<string | null>(initial?.avatar ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
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
      // Só envia o avatar se mudou: é o campo mais pesado do formulário.
      avatar: avatarChanged ? avatar : undefined,
    });
    setBusy(false);
    if (ok && !initial) {
      setName("");
      setHpMax("");
      setDexMod("0");
      setNotes("");
      setAvatar(null);
      setAvatarChanged(false);
    }
  }

  return (
    <form className="cform" onSubmit={submit}>
      <label className="field">
        <span>Nome</span>
        <input autoFocus value={name} maxLength={NAME_MAX_LENGTH} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div className="cform-row">
        <label className="field">
          <span>
            <Abbr title="Vida máxima (pontos de vida)">Vida máx.</Abbr>
          </span>
          <input
            type="number"
            min={LIMITS.hpMax.min}
            max={LIMITS.hpMax.max}
            value={hpMax}
            onChange={(e) => setHpMax(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>
            <Abbr title="Modificador de Destreza (usado na iniciativa: d20 + mod. DES)">Mod. DES</Abbr>
          </span>
          <input
            type="number"
            min={LIMITS.dexMod.min}
            max={LIMITS.dexMod.max}
            value={dexMod}
            onChange={(e) => setDexMod(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="field">
        <span>Cor</span>
        <div className="swatches">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${c === color ? "on" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Outra cor" />
        </div>
      </div>
      <div className="field">
        <span>Avatar no mapa (opcional)</span>
        <AvatarPicker
          value={avatar}
          color={color}
          onChange={(a) => {
            setAvatar(a);
            setAvatarChanged(true);
          }}
        />
      </div>
      {withNotes && (
        <label className="field">
          <span>Notas (opcional)</span>
          <textarea rows={2} maxLength={LIMITS.notes} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      )}
      <div className="cform-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="btn primary" disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
