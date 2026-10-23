import { useState, type ReactNode } from "react";

interface PanelProps {
  title: string;
  /** Entregável em que o painel será implementado. */
  soon?: string;
  aside?: ReactNode;
  className?: string;
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

export function Panel({ title, soon, aside, className, children }: PanelProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed().includes(title));

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const others = readCollapsed().filter((t) => t !== title);
    writeCollapsed(next ? [...others, title] : others);
  }

  return (
    <section className={`panel ${collapsed ? "collapsed" : ""} ${className ?? ""}`}>
      <header className="panel-head">
        <button className="panel-toggle" onClick={toggle} aria-expanded={!collapsed}>
          <span className="chevron" aria-hidden>
            ▾
          </span>
          <h2>{title}</h2>
        </button>
        {!collapsed && aside}
      </header>
      {!collapsed && (soon ? <p className="muted small">Em breve ({soon}).</p> : children)}
    </section>
  );
}
