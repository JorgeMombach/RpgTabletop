import { ActionIcon, Group, Paper, Text, Tooltip } from "@mantine/core";
import { IconWindowMinimize } from "@tabler/icons-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { setDicePrefs, useApp } from "../store";
import { RollLog } from "./RollLog";

const RECT_KEY = "rpg.logWindow";
const MIN = { w: 260, h: 160 };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function readRect(): Rect {
  const fallback = { x: window.innerWidth - 380, y: 80, w: 340, h: 420 };
  try {
    const r = JSON.parse(localStorage.getItem(RECT_KEY) ?? "null") as Rect | null;
    return r && [r.x, r.y, r.w, r.h].every(Number.isFinite) ? r : fallback;
  } catch {
    return fallback;
  }
}

/** Mantém a janela inteira dentro da tela (a tela pode ter mudado de tamanho desde a última vez). */
function clamp(r: Rect): Rect {
  const w = Math.min(Math.max(r.w, MIN.w), window.innerWidth);
  const h = Math.min(Math.max(r.h, MIN.h), window.innerHeight);
  return { w, h, x: Math.min(Math.max(0, r.x), window.innerWidth - w), y: Math.min(Math.max(0, r.y), window.innerHeight - h) };
}

/**
 * Log de rolagens destacado (E22): janela flutuante que dá para arrastar (pelo título) e redimensionar
 * (canto inferior direito). Minimizar devolve o log ao painel Dados. Posição e tamanho ficam neste navegador.
 */
export function FloatingLog() {
  const state = useApp((s) => s.state);
  const [rect, setRect] = useState<Rect>(() => clamp(readRect()));
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(RECT_KEY, JSON.stringify(rect));
    } catch {
      // sem armazenamento: vale só nesta aba
    }
  }, [rect]);

  // Redimensionar é do CSS (resize: both): o tamanho novo volta para o estado.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setRect((r) => (r.w === w && r.h === h ? r : { ...r, w, h }));
    });
    ro.observe(el);
    const onWindow = () => setRect((r) => clamp(r));
    window.addEventListener("resize", onWindow);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWindow);
    };
  }, []);

  function startDrag(e: ReactPointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - rect.x, dy: e.clientY - rect.y };
  }

  function moveDrag(e: ReactPointerEvent) {
    const d = drag.current;
    if (d) setRect((r) => clamp({ ...r, x: e.clientX - d.dx, y: e.clientY - d.dy }));
  }

  if (!state) return null;
  return (
    <Paper
      ref={boxRef}
      className="floating-log plaque"
      withBorder
      shadow="xl"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      role="dialog"
      aria-label="Rolagens"
    >
      <Group
        className="floating-log-title"
        justify="space-between"
        wrap="nowrap"
        px="sm"
        py={6}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => (drag.current = null)}
      >
        <Text ff="heading" fw={700} size="sm" c="bronze.4">
          Rolagens
        </Text>
        <Tooltip label="Minimizar (volta para o painel Dados)">
          <ActionIcon size="sm" aria-label="Minimizar o log" onClick={() => setDicePrefs({ logDetached: false })}>
            <IconWindowMinimize size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <div className="floating-log-body">
        <RollLog log={state.log} selfId={state.self.id} />
      </div>
    </Paper>
  );
}
