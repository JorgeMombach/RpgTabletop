import { Stack, Text } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * Painel ou lista sem conteúdo (L7): medalhão em relevo com o ícone do assunto, título curto em Cinzel e o texto
 * de orientação, numa área afundada com borda tracejada. `compact` = uma linha só, para listas pequenas.
 */
export function EmptyState({ icon: Icon, title, text, compact = false, action }: { icon: Icon; title?: string; text: string; compact?: boolean; action?: ReactNode }) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <span className="empty-medal" aria-hidden>
        <Icon size={compact ? 15 : 20} />
      </span>
      <Stack gap={4} align={compact ? "flex-start" : "center"} style={{ minWidth: 0 }}>
        {title && !compact && (
          <Text ff="heading" fz={12} fw={700} tt="uppercase" c="dark.1" style={{ letterSpacing: "0.06em" }}>
            {title}
          </Text>
        )}
        <Text size={compact ? "xs" : "sm"} c="dimmed" maw={280}>
          {text}
        </Text>
        {action}
      </Stack>
    </div>
  );
}
