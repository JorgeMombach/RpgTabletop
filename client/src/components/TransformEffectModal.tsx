import { Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { EFFECT_TRANSITIONS, type ClientState, type MapEffect } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { EffectFormFields, EffectSwatch, PRESETS, useEffectForm } from "./FixEffectModal";
import { useT } from "../i18n";

/**
 * Mudança de estado de um efeito (E24): mesma área, outro tipo (Graxa → Fogo, Água → Eletrificado…).
 * As transformações comuns aparecem primeiro, mas qualquer uma vale (o app não aplica regra, ADR-06).
 */
export function TransformEffectModal({ state, effect, onClose }: { state: ClientState; effect: MapEffect; onClose: () => void }) {
  const t = useT();
  const suggested = EFFECT_TRANSITIONS[effect.preset] ?? [];
  const form = useEffectForm(state, suggested[0] ?? PRESETS.find((p) => p !== effect.preset) ?? "fire");
  // Quando o estado novo acabar, volta ao de antes (ex.: água eletrificada por 1 round volta a ser água).
  const [revert, setRevert] = useState(false);
  const { rounds, concentration, hasCaster } = form.fields;
  const temporary = rounds !== "" || (concentration && hasCaster);
  // Já é um estado temporário: "voltar" leva ao original, não a este.
  const backTo = effect.revertTo?.name ?? effect.name;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await act("effect:transform", { ...form.values(), id: effect.id, revert: revert && temporary });
    if (res.ok) onClose();
  }

  return (
    <Modal opened onClose={onClose} title={t("effects.transformTitle")} centered>
      <Stack component="form" gap="sm" onSubmit={submit}>
        <Group gap="xs" wrap="nowrap">
          <EffectSwatch preset={effect.preset} color={effect.color} size={24} />
          <Text size="sm">
            <strong>{effect.name}</strong> {t("effects.transformText")}
          </Text>
        </Group>
        <EffectFormFields form={form} suggested={suggested} />
        <Checkbox
          checked={revert && temporary}
          disabled={!temporary}
          onChange={(e) => setRevert(e.currentTarget.checked)}
          label={t("effects.revert", { name: backTo })}
          description={temporary ? t("effects.revertHint") : t("effects.revertNeeds")}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={form.blocked}>
            {t("effects.transform")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
