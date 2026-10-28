import { Button, Checkbox, Group, List, Modal, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { act } from "../actions";
import { toast } from "../notify";
import { select, setTool } from "../store";
import { useT } from "../i18n";

/** Confirmação do "Limpar campo de batalha" (SPEC F7). */
export function ClearBattleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
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
    toast({ kind: "info", text: t("clear.done") });
  }

  return (
    <Modal opened={open} onClose={onClose} title={t("clear.title")} size="md">
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="md">
          <div>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>
              {t("clear.goes")}
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>{t("clear.image")}</List.Item>
              <List.Item>{t("clear.mobs")}</List.Item>
              <List.Item>{t("clear.initiative")}</List.Item>
              <List.Item>{t("clear.positions")}</List.Item>
            </List>
          </div>
          <div>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>
              {t("clear.stays")}
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>{t("clear.players")}</List.Item>
              <List.Item>{t("clear.characters")}</List.Item>
              <List.Item>{t("clear.grid")}</List.Item>
              <List.Item>{t("clear.log")}</List.Item>
            </List>
          </div>
        </SimpleGrid>
        <Checkbox
          size="sm"
          checked={keepTemplates}
          onChange={(e) => setKeepTemplates(e.currentTarget.checked)}
          label={t("clear.keepTemplates")}
        />
        <Group justify="flex-end" gap="sm">
          <Button size="sm" variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" color="red" loading={busy} onClick={confirm}>
            {t("top.clearField")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
