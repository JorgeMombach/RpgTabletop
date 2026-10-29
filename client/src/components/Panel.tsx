import { Collapse, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

interface PanelProps {
  title: string;
  aside?: ReactNode;
  className?: string;
  /** Destaque do painel (ex.: "Sua vez!" na iniciativa). */
  highlighted?: boolean;
  /** Nome para outras telas acharem o painel (ex.: o cartão Preparar a mesa leva até ele). */
  anchor?: string;
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

export function Panel({ title, aside, className, highlighted, anchor, children }: PanelProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed().includes(title));

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const others = readCollapsed().filter((t) => t !== title);
    writeCollapsed(next ? [...others, title] : others);
  }

  return (
    // Placa do guia visual (E20): cantoneiras de bronze e título em Cinzel; estilos em styles.css (.plaque).
    <Paper component="section" className={`plaque ${highlighted ? "highlighted" : ""} ${className ?? ""}`} p="md" data-panel={anchor}>
      <span className="plaque-rivets" aria-hidden />
      <Group justify="space-between" wrap="wrap" gap="xs" mb={collapsed ? 0 : "sm"}>
        <UnstyledButton onClick={toggle} aria-expanded={!collapsed} className="panel-toggle" style={{ flex: "1 1 120px", minWidth: 0 }}>
          <Group gap={8} wrap="nowrap">
            <span className="plaque-diamond" aria-hidden />
            <Text component="h2" ff="heading" fz={13} fw={700} tt="uppercase" c="bronze.4" truncate title={title} style={{ letterSpacing: "0.1em", minWidth: 0 }}>
              {title}
            </Text>
            <span className="plaque-rule" aria-hidden />
            <IconChevronDown size={14} stroke={2} className={`chevron ${collapsed ? "collapsed" : ""}`} color="var(--mantine-color-dark-3)" aria-hidden />
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
