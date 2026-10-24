import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import type { ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** Ação destrutiva: botão vermelho. */
  danger?: boolean;
}

/** Confirmação no padrão do app (substitui o `confirm()` nativo do navegador). */
export function confirmAction({ title, message, confirmLabel = "Confirmar", danger }: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    modals.openConfirmModal({
      title,
      children: typeof message === "string" ? <Text size="sm">{message}</Text> : message,
      labels: { confirm: confirmLabel, cancel: "Cancelar" },
      confirmProps: danger ? { color: "red" } : undefined,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      onClose: () => resolve(false),
    });
  });
}
