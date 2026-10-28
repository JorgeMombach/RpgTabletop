import { ActionIcon, Tooltip } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useT } from "../i18n";

/** Abaixo de 260 px as linhas da iniciativa não mostram o nome. 480 + 2 × 260 + 12 cabe em 1024. */
export const COLUMN_LIMITS = { min: 260, max: 520 } as const;

/**
 * Tamanho mínimo da tela do app. O navegador não deixa travar o tamanho da janela, então abaixo
 * disto a tela para de encolher e aparece rolagem, em vez de o layout quebrar.
 */
export const LAYOUT = {
  appMinWidth: 1024,
  appMinHeight: 640,
  /** O mapa nunca fica mais estreito que isto: as colunas é que cedem. */
  mapMinWidth: 480,
  /** Duas alças de 6 px. */
  resizers: 12,
} as const;
const DEFAULTS = { left: 280, right: 300 } as const;
const STORAGE_KEY = "rpg.columnWidths";
const COLLAPSED_KEY = "rpg.columnCollapsed";
/** Arrastar a borda até esta distância abaixo do mínimo recolhe a coluna; de recolhida, puxar isto abre. */
const COLLAPSE_PULL = 60;
const OPEN_PULL = 40;

type Side = keyof typeof DEFAULTS;

function clamp(n: number) {
  return Math.round(Math.max(COLUMN_LIMITS.min, Math.min(COLUMN_LIMITS.max, n)));
}

function read(): Record<Side, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { left: clamp(saved.left ?? DEFAULTS.left), right: clamp(saved.right ?? DEFAULTS.right) };
  } catch {
    return { ...DEFAULTS };
  }
}

function readCollapsed(): Record<Side, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "{}");
    return { left: saved.left === true, right: saved.right === true };
  } catch {
    return { left: false, right: false };
  }
}

/**
 * Espaço que sobra para as duas colunas sem apertar o mapa abaixo do mínimo.
 * Se as larguras salvas não cabem (janela menor que da última vez), encolhe as duas na proporção.
 * Coluna recolhida ocupa 0: a outra pode crescer até o máximo.
 */
function fit(saved: Record<Side, number>, viewportWidth: number, collapsed: Record<Side, boolean> = { left: false, right: false }) {
  const appWidth = Math.max(viewportWidth, LAYOUT.appMinWidth);
  const room = appWidth - LAYOUT.mapMinWidth - LAYOUT.resizers;
  const visible = { left: collapsed.left ? 0 : saved.left, right: collapsed.right ? 0 : saved.right };
  const total = visible.left + visible.right;
  let { left, right } = visible;
  if (total > room) {
    const excess = total - room;
    left = Math.max(COLUMN_LIMITS.min, Math.round(left - (excess * left) / total));
    right = Math.max(COLUMN_LIMITS.min, Math.round(right - (excess * right) / total));
  }
  const max = {
    left: Math.max(COLUMN_LIMITS.min, Math.min(COLUMN_LIMITS.max, room - right)),
    right: Math.max(COLUMN_LIMITS.min, Math.min(COLUMN_LIMITS.max, room - left)),
  };
  if (collapsed.left) left = 0;
  if (collapsed.right) right = 0;
  return { widths: { left, right }, max };
}

/** Larguras das colunas laterais (e se estão recolhidas), lembradas por navegador e ajustadas ao tamanho da janela. */
export function useColumnWidths() {
  const { width: viewport } = useViewportSize();
  const [saved, setSaved] = useState(read);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  // O máximo de uma coluna depende de a outra estar recolhida; o set lê daqui (sem esperar o próximo render).
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  // No primeiro render o hook ainda não mediu a janela.
  const { widths, max } = fit(saved, viewport || window.innerWidth, collapsed);

  const setCollapsed = useCallback((side: Side, value: boolean) => {
    setCollapsedState((c) => {
      const next = { ...c, [side]: value };
      collapsedRef.current = next;
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // ignora
      }
      return next;
    });
  }, []);

  const set = useCallback((side: Side, value: number) => {
    setSaved((w) => {
      // Parte das larguras que estão na tela (não das salvas, que podem não caber nesta janela).
      const current = fit(w, window.innerWidth).widths;
      // O máximo desta coluna conta a outra só se ela estiver aberta.
      const other: Side = side === "left" ? "right" : "left";
      const { max } = fit(w, window.innerWidth, { [side]: false, [other]: collapsedRef.current[other] } as Record<Side, boolean>);
      const next = { ...current, [side]: clamp(Math.min(value, max[side])) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignora
      }
      return next;
    });
  }, []);
  const reset = useCallback((side: Side) => set(side, DEFAULTS[side]), [set]);

  /** Arrasto da borda: abre a coluna (se estava recolhida) e ajusta a largura. Recolher é decidido ao soltar. */
  const resize = useCallback(
    (side: Side, value: number) => {
      if (collapsedRef.current[side]) setCollapsed(side, false);
      set(side, value);
    },
    [set, setCollapsed],
  );
  const collapse = useCallback((side: Side) => setCollapsed(side, true), [setCollapsed]);
  const toggle = useCallback((side: Side) => setCollapsed(side, !collapsed[side]), [collapsed, setCollapsed]);
  return { widths, max, collapsed, resize, collapse, toggle, reset };
}

interface Props {
  side: Side;
  width: number;
  /** Máximo agora (depende da janela e da outra coluna). */
  max: number;
  collapsed: boolean;
  onResize: (width: number) => void;
  onCollapse: () => void;
  onReset: () => void;
  onToggle: () => void;
}

/**
 * Alça vertical entre uma coluna lateral e o mapa: arrastar, setas do teclado ou duplo clique (padrão).
 * O botão no meio recolhe a coluna por completo (mais espaço para o mapa, bom no iPad) e abre de volta;
 * arrastar a borda até o fim também recolhe.
 */
export function ColumnResizer({ side, width, max, collapsed, onResize, onCollapse, onReset, onToggle }: Props) {
  const t = useT();
  // O arrasto todo se mede a partir do começo dele (largura e se estava recolhida): recolher no meio
  // não muda a conta, e a coluna não fica abrindo e fechando enquanto o mouse anda.
  const start = useRef<{ x: number; width: number; collapsed: boolean; opened?: boolean } | null>(null);
  // Passou do limite: soltar agora recolhe (a coluna fica na largura mínima, apagada, até soltar).
  const [willCollapse, setWillCollapse] = useState(false);
  // A seta aponta para onde a coluna vai: recolher = em direção à borda da tela.
  const towardEdge = side === "left" ? IconChevronLeft : IconChevronRight;
  const towardMap = side === "left" ? IconChevronRight : IconChevronLeft;
  const Arrow = collapsed ? towardMap : towardEdge;
  const label = t(collapsed ? (side === "left" ? "columns.openLeft" : "columns.openRight") : side === "left" ? "columns.closeLeft" : "columns.closeRight");

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width, collapsed };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    // Coluna da esquerda cresce arrastando para a direita; a da direita, para a esquerda.
    const raw = s.width + (side === "left" ? dx : -dx);
    // Recolhida: abre quando puxar um pouco. Aberta: recolhe se soltar bem abaixo do mínimo.
    const below = raw < (s.collapsed ? OPEN_PULL : COLUMN_LIMITS.min - COLLAPSE_PULL);
    // Abriu neste mesmo arrasto e voltou até a borda: soltar recolhe de novo.
    const open = !s.collapsed || s.opened === true;
    setWillCollapse(below && open);
    if (below) {
      // Abaixo do limite a coluna não muda (recolhida continua recolhida; aberta fica no mínimo).
      if (open) onResize(COLUMN_LIMITS.min);
      return;
    }
    s.opened = true;
    onResize(Math.max(raw, COLUMN_LIMITS.min));
  }

  function onPointerUp() {
    const s = start.current;
    start.current = null;
    if (s && willCollapse) onCollapse();
    setWillCollapse(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 48 : 16;
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";
    if (e.key === grow) onResize(width + step);
    else if (e.key === shrink) onResize(width - step);
    else return;
    e.preventDefault();
  }

  return (
    <div
      className={`col-resizer ${side} ${collapsed ? "collapsed" : ""} ${willCollapse ? "will-collapse" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={t(side === "left" ? "columns.widthLeft" : "columns.widthRight")}
      aria-valuemin={COLUMN_LIMITS.min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      title={t("columns.dragTip")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setWillCollapse(false);
      }}
      onDoubleClick={collapsed ? onToggle : onReset}
      onKeyDown={onKeyDown}
    >
      <Tooltip label={label} position={side === "left" ? "right" : "left"}>
        <ActionIcon
          className="col-toggle"
          size={22}
          variant="default"
          aria-label={label}
          aria-expanded={!collapsed}
          // O botão não começa um arrasto da alça.
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={onToggle}
        >
          <Arrow size={14} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
