import { Collapse, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { useState, type ReactNode } from "react";

interface PanelProps {
  title: string;
  aside?: ReactNode;
  className?: string;
  /** Destaque do painel (ex.: "Sua vez!" na iniciativa). */
  highlighted?: boolean;
  children?: ReactNode;
}

const STORAGE_KEY = "rpg.collapsedPanels";

// Preferência só deste navegador; sem storage, todos os painéis começam abertos.
function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeCollapsed(titles: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
  } catch {
    // ignora
  }
}

export function Panel({ title, aside, className, highlighted, children }: PanelProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed().includes(title));

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const others = readCollapsed().filter((t) => t !== title);
    writeCollapsed(next ? [...others, title] : others);
  }

  return (
    <Paper
      component="section"
      className={className}
      p="md"
      style={highlighted ? { borderColor: "var(--mantine-primary-color-filled)", boxShadow: "0 0 0 1px var(--mantine-primary-color-filled)" } : undefined}
    >
      <Group justify="space-between" wrap="wrap" gap="xs" mb={collapsed ? 0 : "sm"}>
        <UnstyledButton onClick={toggle} aria-expanded={!collapsed} className="panel-toggle">
          <Group gap={6} wrap="nowrap">
            <Text component="span" size="xs" c="dimmed" className={`chevron ${collapsed ? "collapsed" : ""}`} aria-hidden>
              ▾
            </Text>
            <Text component="h2" size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.06em" }}>
              {title}
            </Text>
          </Group>
        </UnstyledButton>
        {!collapsed && aside}
      </Group>
      <Collapse expanded={!collapsed}>
        <Stack gap="sm">{children}</Stack>
      </Collapse>
    </Paper>
  );
}
