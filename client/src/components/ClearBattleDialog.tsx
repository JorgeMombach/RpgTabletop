import { Button, Checkbox, Group, List, Modal, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { act } from "../actions";
import { toast } from "../notify";
import { select, setTool } from "../store";

/** Confirmação do "Limpar campo de batalha" (SPEC F7). */
export function ClearBattleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [keepTemplates, setKeepTemplates] = useState(true);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const res = await act("battle:clear", { keepTemplates });
    setBusy(false);
    if (!res.ok) return;
    select(null);
    setTool("move");
    onClose();
    toast({ kind: "info", text: "Campo limpo. Pronto para a próxima batalha." });
  }

  return (
    <Modal opened={open} onClose={onClose} title="Limpar campo de batalha?" size="md">
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="md">
          <div>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>
              Sai
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>Imagem do mapa</List.Item>
              <List.Item>Todos os mobs</List.Item>
              <List.Item>Iniciativa e rounds</List.Item>
              <List.Item>Posições dos tokens</List.Item>
            </List>
          </div>
          <div>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>
              Fica
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>Jogadores conectados</List.Item>
              <List.Item>Personagens com vida, slots e magias</List.Item>
              <List.Item>Configuração do grid</List.Item>
              <List.Item>Log de dados</List.Item>
            </List>
          </div>
        </SimpleGrid>
        <Checkbox
          size="sm"
          checked={keepTemplates}
          onChange={(e) => setKeepTemplates(e.currentTarget.checked)}
          label="Manter bestiário (templates) para a próxima luta"
        />
        <Group justify="flex-end" gap="sm">
          <Button size="sm" variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" color="red" loading={busy} onClick={confirm}>
            Limpar campo
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
