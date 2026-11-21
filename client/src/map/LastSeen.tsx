import { geometryOf, sizeOfSpan, type LastSeen, type MapConfig } from "@rpg/shared";
import { useT } from "../i18n";
import { shapeCenterAt } from "./geometry";

interface View {
  x: number;
  y: number;
  scale: number;
}

/**
 * "Visto por último aqui" (névoa com visão dos personagens): onde o grupo perdeu um inimigo de vista.
 * Fica por cima da luz do clima (à noite o "?" vermelho continua legível) e não recebe cliques.
 * Contorno tracejado do tamanho do inimigo, "?" no meio, pulsando devagar, e o nome embaixo.
 * O mestre vê mais apagado (ele sabe onde o inimigo está de verdade).
 */
export function LastSeenOverlay({ marks, grid, view, gm }: { marks: LastSeen[]; grid: MapConfig; view: View; gm: boolean }) {
  const t = useT();
  if (marks.length === 0) return null;
  const cell = grid.cellPx * view.scale;
  return (
    <div className={`last-seen-layer${gm ? " gm" : ""}`}>
      {marks.map((m) => {
        const size = geometryOf(grid.grid).drawSpan(sizeOfSpan(m.span)) * cell;
        const middle = shapeCenterAt(m.pos, sizeOfSpan(m.span), grid);
        return (
          <div
            key={m.id}
            className="last-seen"
            aria-label={t("lastSeen.label", { name: m.name })}
            style={{
              left: view.x + middle.x * view.scale - size / 2,
              top: view.y + middle.y * view.scale - size / 2,
              width: size,
              height: size,
              fontSize: Math.max(14, Math.min(size * 0.78, cell * 1.4)),
            }}
          >
            <span className="last-seen-mark">?</span>
            {cell >= 22 && <span className="last-seen-name">{m.name}</span>}
          </div>
        );
      })}
    </div>
  );
}
