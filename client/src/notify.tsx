import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconArrowBackUp, IconCheck, IconFeather } from "@tabler/icons-react";
import type { CSSProperties } from "react";

export interface ToastInput {
  /** Aviso (bronze), confirmação de algo que deu certo (verde-cobre) ou erro/recusa (sangue). */
  kind: "info" | "success" | "error";
  text: string;
  /** Botão na própria notificação (ex.: "Desfazer"). */
  action?: { label: string; run: () => void };
}

const ICON = { info: IconFeather, success: IconCheck, error: IconAlertTriangle };

let seq = 0;

/**
 * Aviso rápido no rodapé (notificações do Mantine), em placa de couro com medalhão (L7): entra subindo, o erro
 * treme uma vez, e um fio embaixo mostra o tempo que falta (o Mantine pausa com o mouse em cima; o fio também).
 */
export function toast({ kind, text, action }: ToastInput, ttlMs = 6000) {
  const id = `toast-${++seq}`;
  const Icon = ICON[kind];
  notifications.show({
    id,
    color: kind === "error" ? "red" : kind === "success" ? "copper" : "bronze",
    className: `game-toast ${kind}`,
    style: { "--toast-ttl": `${ttlMs}ms` } as CSSProperties,
    icon: <Icon size={16} />,
    autoClose: ttlMs,
    withBorder: true,
    message: (
      <>
        {action ? (
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="sm">{text}</Text>
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<IconArrowBackUp size={12} />}
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
        )}
        <span className="toast-timer" aria-hidden />
      </>
    ),
  });
}
