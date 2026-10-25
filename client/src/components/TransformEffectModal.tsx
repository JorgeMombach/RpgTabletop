import { Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { EFFECT_TRANSITIONS, type ClientState, type MapEffect } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { EffectFormFields, EffectSwatch, PRESETS, useEffectForm } from "./FixEffectModal";

/**
 * Mudança de estado de um efeito (E24): mesma área, outro tipo (Graxa → Fogo, Água → Eletrificado…).
 * As transformações comuns aparecem primeiro, mas qualquer uma vale (o app não aplica regra, ADR-06).
 */
export function TransformEffectModal({ state, effect, onClose }: { state: ClientState; effect: MapEffect; onClose: () => void }) {
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
    <Modal opened onClose={onClose} title="Transformar efeito" centered>
      <Stack component="form" gap="sm" onSubmit={submit}>
        <Group gap="xs" wrap="nowrap">
          <EffectSwatch preset={effect.preset} color={effect.color} size={24} />
          <Text size="sm">
            <strong>{effect.name}</strong> muda de estado na mesma área.
          </Text>
        </Group>
        <EffectFormFields form={form} suggested={suggested} />
        <Checkbox
          checked={revert && temporary}
          disabled={!temporary}
          onChange={(e) => setRevert(e.currentTarget.checked)}
          label={`Quando acabar, volta a ser ${backTo}`}
          description={temporary ? "Senão, a área some quando o novo estado acabar." : "Dê uma duração ou concentração para poder voltar."}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.blocked}>
            Transformar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
