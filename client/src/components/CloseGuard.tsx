import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "../notify";
import { desktop, isUnsaved, saveSessionFile } from "../sessionFile";
import { useApp } from "../store";

/**
 * App do mestre (E12): ao fechar a janela com alterações não salvas, pergunta antes —
 * Salvar e sair / Sair sem salvar / Cancelar. Sem alterações, fecha direto. No navegador não faz nada.
 */
export function CloseGuard() {
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    desktop?.guardClose(() => {
      const { state, savedSnapshot } = useApp.getState();
      if (isUnsaved(state, savedSnapshot)) setAsking(true);
      else desktop?.confirmClose();
    });
  }, []);

  async function saveAndClose() {
    setSaving(true);
    try {
      // Cancelou o "Salvar como": continua no modal.
      if (await saveSessionFile()) desktop?.confirmClose();
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (!desktop) return null;
  return (
    <Modal opened={asking} onClose={() => setAsking(false)} title="Fechar o Jamal's Tabletop?" closeOnClickOutside={!saving}>
      <Stack gap="md">
        <Text>Você tem alterações não salvas. Fechar encerra a sessão para todos os jogadores.</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" disabled={saving} onClick={() => setAsking(false)}>
            Cancelar
          </Button>
          <Button variant="subtle" color="red" disabled={saving} onClick={() => desktop?.confirmClose()}>
            Sair sem salvar
          </Button>
          <Button loading={saving} leftSection={<IconDeviceFloppy size={14} />} onClick={() => void saveAndClose()}>
            Salvar e sair
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
