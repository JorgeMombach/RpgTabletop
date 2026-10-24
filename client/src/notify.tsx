import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";

export interface ToastInput {
  kind: "info" | "error";
  text: string;
  /** Botão na própria notificação (ex.: "Desfazer"). */
  action?: { label: string; run: () => void };
}

let seq = 0;

/** Aviso rápido no rodapé (notificações do Mantine). */
export function toast({ kind, text, action }: ToastInput, ttlMs = 6000) {
  const id = `toast-${++seq}`;
  notifications.show({
    id,
    color: kind === "error" ? "red" : "bronze",
    autoClose: ttlMs,
    withBorder: true,
    message: action ? (
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm">{text}</Text>
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => {
            action.run();
            notifications.hide(id);
          }}
        >
          {action.label}
        </Button>
      </Group>
    ) : (
      text
    ),
  });
}
