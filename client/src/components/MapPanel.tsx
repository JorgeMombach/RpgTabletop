import { useEffect, useRef, useState } from "react";
import { LIMITS, type GridInput, type MapConfig } from "@rpg/shared";
import { act } from "../actions";
import { mapImageFromFile } from "../images";
import { setTool, toast, useApp } from "../store";
import { Panel } from "./Panel";

/** Envia ajustes do grid no máximo a cada 100 ms enquanto o slider é arrastado. */
function useThrottledGrid() {
  const pending = useRef<GridInput>({});
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (patch: GridInput) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const p = pending.current;
      pending.current = {};
      void act("battle:grid", p);
    }, 100);
  };
}

export function MapPanel({ map }: { map: MapConfig & { hasImage: boolean } }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { tool, calibRect } = useApp();
  const sendGrid = useThrottledGrid();

  // Valores locais para os sliders responderem na hora; o servidor confirma depois.
  const [local, setLocal] = useState({ cellPx: map.cellPx, offsetX: map.offsetX, offsetY: map.offsetY });
  useEffect(() => setLocal({ cellPx: map.cellPx, offsetX: map.offsetX, offsetY: map.offsetY }), [map.cellPx, map.offsetX, map.offsetY]);

  function change(patch: Partial<typeof local>) {
    setLocal((l) => ({ ...l, ...patch }));
    sendGrid(patch);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const image = await mapImageFromFile(file);
      const res = await act("battle:setMap", { image });
      if (res.ok) toast({ kind: "info", text: "Mapa enviado. Calibre o grid se os quadrados não baterem." });
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Panel title="Mapa">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <div className="row-gap">
        <button className="btn small primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Enviando…" : map.hasImage ? "Trocar imagem" : "Enviar imagem"}
        </button>
        {map.hasImage && (
          <button
            className="btn small"
            onClick={() => confirm("Remover a imagem do mapa?") && void act("battle:setMap", { image: null })}
          >
            Remover
          </button>
        )}
      </div>

      <label className="check">
        <input type="checkbox" checked={map.showGrid} onChange={(e) => void act("battle:grid", { showGrid: e.target.checked })} />
        Mostrar grid (1 quadrado = {map.feetPerCell} ft)
      </label>

      <label className="field">
        <span>Tamanho do quadrado: {local.cellPx.toFixed(1)} px</span>
        <input
          type="range"
          min={LIMITS.cellPx.min}
          max={200}
          step={0.5}
          value={Math.min(local.cellPx, 200)}
          onChange={(e) => change({ cellPx: Number(e.target.value) })}
        />
      </label>
      <div className="cform-row">
        <label className="field">
          <span>Desloc. X</span>
          <input
            type="range"
            min={0}
            max={local.cellPx}
            step={0.5}
            value={local.offsetX}
            onChange={(e) => change({ offsetX: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Desloc. Y</span>
          <input
            type="range"
            min={0}
            max={local.cellPx}
            step={0.5}
            value={local.offsetY}
            onChange={(e) => change({ offsetY: Number(e.target.value) })}
          />
        </label>
      </div>

      {tool === "calibrate" ? (
        calibRect && calibRect.width > 4 ? (
          <CalibrateForm rect={calibRect} cellPx={map.cellPx} />
        ) : (
          <p className="muted small">Arraste um retângulo no mapa cobrindo um ou mais quadrados inteiros.</p>
        )
      ) : (
        <button className="btn small" onClick={() => setTool("calibrate")}>
          Calibrar pelo mapa
        </button>
      )}
    </Panel>
  );
}

function CalibrateForm({ rect, cellPx }: { rect: { x: number; y: number; width: number }; cellPx: number }) {
  const [cells, setCells] = useState(String(Math.max(1, Math.round(rect.width / cellPx))));
  const n = Math.max(1, Math.trunc(Number(cells)) || 1);
  const size = rect.width / n;

  async function apply() {
    // O canto do retângulo marca uma linha do grid.
    const res = await act("battle:grid", { cellPx: size, offsetX: rect.x, offsetY: rect.y });
    if (res.ok) setTool("move");
  }

  return (
    <div className="calib">
      <label className="field">
        <span>Quantos quadrados cabem na largura da seleção?</span>
        <input type="number" min={1} value={cells} onChange={(e) => setCells(e.target.value)} />
      </label>
      <p className="muted small">
        {Math.round(rect.width)} px ÷ {n} = {size.toFixed(1)} px por quadrado
      </p>
      <div className="cform-actions">
        <button className="btn small" onClick={() => setTool("move")}>
          Cancelar
        </button>
        <button className="btn small primary" disabled={size < LIMITS.cellPx.min} onClick={apply}>
          Aplicar
        </button>
      </div>
    </div>
  );
}
