import { Button, Center, Group, Text, Title } from "@mantine/core";
import { IconArrowBackUp } from "@tabler/icons-react";
import { useEffect } from "react";
import { useT } from "../i18n";
import { returnToTable } from "../logWindow";
import { useApp } from "../store";
import { D20Emblem } from "./D20Emblem";
import { RollLog } from "./RollLog";

/** Página da janela do log (`?janela=log`): só o log de rolagens, ao vivo, ocupando a janela toda. */
export function LogWindow() {
  const t = useT();
  const state = useApp((s) => s.state);
  const connected = useApp((s) => s.connected);

  useEffect(() => {
    document.title = t("logWindow.title");
  }, [t]);

  if (!state) {
    return (
      <Center h="100dvh" p="md">
        <Text c="dimmed" ta="center" size="sm">
          {connected ? t("logWindow.notJoined") : t("logWindow.connecting")}
        </Text>
      </Center>
    );
  }

  return (
    <div className="log-window">
      <Group gap="xs" wrap="nowrap" className="log-window-head">
        <D20Emblem size={20} />
        <Title order={4} style={{ flex: 1, minWidth: 0 }}>
          {t("logWindow.heading")}
        </Title>
        <Button size="compact-sm" variant="default" leftSection={<IconArrowBackUp size={14} />} onClick={returnToTable}>
          {t("logWindow.back")}
        </Button>
      </Group>
      <div className="log-window-body">
        <RollLog log={state.log} selfId={state.self.id} />
      </div>
    </div>
  );
}
