import { Box, Button, Checkbox, Collapse, ColorInput, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { ABILITIES, abilityMod, LIMITS, NAME_MAX_LENGTH, SIZES, type Abilities, type Ability, type CombatantInput, type Size } from "@rpg/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { fmtMod } from "../format";
import { useT } from "../i18n";
import { Abbr } from "./Abbr";
import { AvatarPicker } from "./AvatarPicker";
import { fromPhaseInputs, PhasesField, toPhaseInputs, type PhaseInput } from "./PhasesField";

export interface FormValues extends CombatantInput {
  notes?: string;
}

interface Props {
  initial?: Partial<FormValues> & { ac?: number | null; phase?: number };
  palette: string[];
  submitLabel: string;
  withNotes?: boolean;
  /** Caixa "Já entra oculto" (criar mob ou NPC, E21). */
  withHidden?: boolean;
  /** Marca de visão no escuro (personagem de jogador). */
  withDarkvision?: boolean;
  /** Fases de chefe (mestre: mob, NPC e template). */
  withPhases?: boolean;
  /** Campos a mais antes dos botões (ex.: quantidade e concentração ao invocar). */
  extra?: ReactNode;
  onSubmit: (values: FormValues) => Promise<boolean>;
  onCancel?: () => void;
}

type ScoreInputs = Record<Ability, string | number>;

const emptyScores = (a?: Abilities): ScoreInputs =>
  Object.fromEntries(ABILITIES.map((k) => [k, a?.[k] ?? ""])) as ScoreInputs;

/**
 * Formulário de mob, NPC, template, aliado ou conjurado: nome, vida máxima, CA, bônus de iniciativa,
 * atributos (opcionais), cor, avatar e marca de animal. Com DES preenchida, o bônus de iniciativa
 * acompanha o modificador dela até a pessoa mexer nele à mão (talento, item mágico…).
 */
export function CombatantForm({ initial, palette, submitLabel, withNotes, withHidden, withDarkvision, withPhases, extra, onSubmit, onCancel }: Props) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [hpMax, setHpMax] = useState<string | number>(initial?.hpMax ?? "");
  const [ac, setAc] = useState<string | number>(initial?.ac ?? "");
  const [dexMod, setDexMod] = useState<string | number>(initial?.dexMod ?? 0);
  const [scores, setScores] = useState<ScoreInputs>(() => emptyScores(initial?.abilities));
  // Iniciativa segue a DES só enquanto ninguém a digitou (e se ela já batia com a DES ao abrir).
  const [initFollowsDex, setInitFollowsDex] = useState(
    () => initial?.abilities?.dex === undefined || abilityMod(initial.abilities.dex) === initial.dexMod,
  );
  const [showAbilities, setShowAbilities] = useState(() => !!initial?.abilities && Object.keys(initial.abilities).length > 0);
  const [size, setSize] = useState<Size>(initial?.size ?? "medium");
  const [color, setColor] = useState(initial?.color ?? palette[0]);
  // Notas do mestre: no template são `notes`; num combatente, `gmNotes` (o form manda as duas e cada ação usa a sua).
  const [notes, setNotes] = useState(initial?.notes ?? initial?.gmNotes ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [avatar, setAvatar] = useState<string | null>(initial?.avatar ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [animal, setAnimal] = useState(initial?.animal ?? false);
  const [darkvision, setDarkvision] = useState(initial?.darkvision ?? false);
  const [phases, setPhases] = useState<PhaseInput[]>(() => toPhaseInputs(initial?.phases));
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  function setScore(key: Ability, value: string | number) {
    setScores((s) => ({ ...s, [key]: value }));
    if (key === "dex" && initFollowsDex && value !== "" && Number.isFinite(Number(value))) setDexMod(abilityMod(Number(value)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const abilities: Abilities = {};
    for (const k of ABILITIES) if (scores[k] !== "") abilities[k] = Number(scores[k]);
    const ok = await onSubmit({
      name,
      hpMax: Number(hpMax),
      ac: ac === "" ? null : Number(ac),
      dexMod: Number(dexMod),
      abilities,
      size,
      color,
      notes: withNotes ? notes : undefined,
      gmNotes: withNotes ? notes : undefined,
      description,
      animal,
      darkvision: withDarkvision ? darkvision : undefined,
      phases: withPhases ? fromPhaseInputs(phases) : undefined,
      hidden: withHidden ? hidden : undefined,
      // Só envia o avatar se mudou: é o campo mais pesado do formulário.
      avatar: avatarChanged ? avatar : undefined,
    });
    setBusy(false);
    if (ok && !initial) {
      setName("");
      setHpMax("");
      setAc("");
      setDexMod(0);
      setScores(emptyScores());
      setInitFollowsDex(true);
      setSize("medium");
      setNotes("");
      setAvatar(null);
      setAvatarChanged(false);
      setAnimal(false);
      setDarkvision(false);
      setPhases([]);
    }
  }

  return (
    <Paper component="form" onSubmit={submit} p="sm" bg="dark.7">
      <Stack gap="sm">
        <TextInput
          label={t("form.name")}
          autoFocus
          required
          value={name}
          maxLength={NAME_MAX_LENGTH}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Group grow gap="sm" align="flex-start">
          <NumberInput
            label={<Abbr title={t("form.hpMaxTitle")}>{t("form.hpMax")}</Abbr>}
            required
            min={LIMITS.hpMax.min}
            max={LIMITS.hpMax.max}
            allowDecimal={false}
            value={hpMax}
            onChange={setHpMax}
          />
          <NumberInput
            label={<Abbr title={t("form.acTitle")}>{t("form.ac")}</Abbr>}
            required
            min={LIMITS.ac.min}
            max={LIMITS.ac.max}
            allowDecimal={false}
            allowNegative={false}
            value={ac}
            onChange={setAc}
          />
          <NumberInput
            label={<Abbr title={t("form.initTitle")}>{t("form.init")}</Abbr>}
            required
            min={LIMITS.dexMod.min}
            max={LIMITS.dexMod.max}
            allowDecimal={false}
            value={dexMod}
            onChange={(v) => {
              setDexMod(v);
              setInitFollowsDex(false);
            }}
          />
        </Group>

        <UnstyledButton onClick={() => setShowAbilities((s) => !s)} aria-expanded={showAbilities}>
          <Group gap={4}>
            <IconChevronDown size={14} className={`chevron ${showAbilities ? "" : "collapsed"}`} aria-hidden />
            <Text size="sm" fw={500}>
              {t("form.abilities")}
            </Text>
          </Group>
        </UnstyledButton>
        <Collapse expanded={showAbilities}>
          <SimpleGrid cols={3} spacing="xs" verticalSpacing="xs">
            {ABILITIES.map((k) => {
              const v = scores[k];
              const mod = v === "" || !Number.isFinite(Number(v)) ? null : abilityMod(Number(v));
              return (
                <NumberInput
                  key={k}
                  label={<Abbr title={t(`ability.${k}.name`)}>{t(`ability.${k}`)}</Abbr>}
                  min={LIMITS.abilityScore.min}
                  max={LIMITS.abilityScore.max}
                  allowDecimal={false}
                  allowNegative={false}
                  value={v}
                  onChange={(value) => setScore(k, value)}
                  rightSection={mod === null ? null : <Text size="xs" c="dimmed">{fmtMod(mod)}</Text>}
                  rightSectionWidth={32}
                />
              );
            })}
          </SimpleGrid>
          <Text size="xs" c="dimmed" mt={4}>
            {t("form.abilitiesHint")}
          </Text>
        </Collapse>

        <Tooltip label={t("form.sizeTip")}>
          <Select
            label={t("form.size")}
            data={(Object.keys(SIZES) as Size[]).map((s) => ({ value: s, label: t(`size.${s}`) }))}
            value={size}
            onChange={(v) => v && setSize(v as Size)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </Tooltip>
        <ColorInput
          label={t("form.color")}
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
          <Tooltip label={t("form.animalTip")}>
            <Box>
              <Checkbox label={t("form.animal")} checked={animal} onChange={(e) => setAnimal(e.currentTarget.checked)} />
            </Box>
          </Tooltip>
          {withDarkvision && (
            <Tooltip label={t("form.darkvisionTip")}>
              <Box>
                <Checkbox label={t("form.darkvision")} checked={darkvision} onChange={(e) => setDarkvision(e.currentTarget.checked)} />
              </Box>
            </Tooltip>
          )}
          {withHidden && (
            <Tooltip label={t("form.hiddenTip")}>
              <Box>
                <Checkbox label={t("form.hidden")} checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} />
              </Box>
            </Tooltip>
          )}
        </Group>
        <Textarea
          label={t("form.description")}
          description={t("form.descriptionHint")}
          maxLength={LIMITS.description}
          autosize
          minRows={2}
          maxRows={6}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        {withNotes && (
          <Textarea
            label={t("form.notes")}
            description={t("form.notesHint")}
            maxLength={LIMITS.notes}
            autosize
            minRows={2}
            maxRows={6}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
        )}
        {withPhases && <PhasesField phases={phases} onChange={setPhases} current={initial?.phase ?? 1} />}
        {extra}
        <Group justify="flex-end" gap="xs">
          {onCancel && (
            <Button variant="default" onClick={onCancel}>
              {t("common.cancel")}
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
