import { Button, Checkbox, FileButton, Group, Input, NumberInput, Paper, Slider, Stack, Text } from "@mantine/core";
import { LIMITS, type GridInput, type MapConfig } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { mapImageFromFile } from "../images";
import { toast } from "../notify";
import { setTool, useApp } from "../store";
import { Abbr } from "./Abbr";
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
  const [uploading, setUploading] = useState(false);
  const { tool, calibRect } = useApp();
  const sendGrid = useThrottledGrid();

  // Valores locais para os sliders responderem na hora; o servidor confirma depois.
  const [local, setLocal] = useState({ cellPx: map.cellPx, offsetX: map.offsetX, offsetY: map.offsetY });
  useEffect(() => setLocal({ cellPx: map.cellPx, offsetX: map.offsetX, offsetY: map.offsetY }), [map.cellPx, map.offsetX, map.offsetY]);

  // Deslocamento = tamanho do quadrado é o mesmo grid que deslocamento 0 (o servidor normaliza),
  // então o slider para um passo antes para o grid não "pular" de volta ao início.
  const offsetMax = Math.max(0, local.cellPx - 0.5);

  function change(patch: Partial<typeof local>) {
    setLocal((l) => ({ ...l, ...patch }));
    sendGrid(patch);
  }

  async function upload(file: File | null) {
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
    }
  }

  async function removeImage() {
    const ok = await confirmAction({ title: "Remover a imagem do mapa?", message: "Os tokens e o grid continuam.", confirmLabel: "Remover", danger: true });
    if (ok) void act("battle:setMap", { image: null });
  }

  return (
    <Panel title="Mapa">
      <Group gap="xs">
        <FileButton onChange={upload} accept="image/png,image/jpeg,image/webp">
          {(props) => (
            <Button {...props} loading={uploading}>
              {map.hasImage ? "Trocar imagem" : "Enviar imagem"}
            </Button>
          )}
        </FileButton>
        {map.hasImage && (
          <Button variant="default" onClick={() => void removeImage()}>
            Remover
          </Button>
        )}
      </Group>

      <Checkbox
        checked={map.showGrid}
        onChange={(e) => void act("battle:grid", { showGrid: e.currentTarget.checked })}
        label={
          <>
            Mostrar grid (1 quadrado = {map.feetPerCell} <Abbr title="pés (1 ft ≈ 30 cm; 5 ft = 1,5 m)">ft</Abbr>)
          </>
        }
      />

      <Input.Wrapper label={`Tamanho do quadrado: ${local.cellPx.toFixed(1)} px`}>
        <Slider mt={6} min={LIMITS.cellPx.min} max={200} step={0.5} value={Math.min(local.cellPx, 200)} onChange={(v) => change({ cellPx: v })} />
      </Input.Wrapper>
      <Group grow gap="md">
        <Input.Wrapper label={<Abbr title="Deslocamento horizontal do grid sobre a imagem">Desloc. X</Abbr>}>
          <Slider mt={6} min={0} max={offsetMax} step={0.5} value={Math.min(local.offsetX, offsetMax)} onChange={(v) => change({ offsetX: v })} />
        </Input.Wrapper>
        <Input.Wrapper label={<Abbr title="Deslocamento vertical do grid sobre a imagem">Desloc. Y</Abbr>}>
          <Slider mt={6} min={0} max={offsetMax} step={0.5} value={Math.min(local.offsetY, offsetMax)} onChange={(v) => change({ offsetY: v })} />
        </Input.Wrapper>
      </Group>

      {tool === "calibrate" ? (
        calibRect && calibRect.width > 4 ? (
          <CalibrateForm rect={calibRect} cellPx={map.cellPx} />
        ) : (
          <Text size="xs" c="gold.4">
            Arraste um retângulo no mapa cobrindo um ou mais quadrados inteiros.
          </Text>
        )
      ) : (
        <Button variant="default" onClick={() => setTool("calibrate")}>
          Calibrar pelo mapa
        </Button>
      )}
    </Panel>
  );
}

function CalibrateForm({ rect, cellPx }: { rect: { x: number; y: number; width: number }; cellPx: number }) {
  const [cells, setCells] = useState<string | number>(Math.max(1, Math.round(rect.width / cellPx)));
  const n = Math.max(1, Math.trunc(Number(cells)) || 1);
  const size = rect.width / n;

  async function apply() {
    // O canto do retângulo marca uma linha do grid.
    const res = await act("battle:grid", { cellPx: size, offsetX: rect.x, offsetY: rect.y });
    if (res.ok) setTool("move");
  }

  return (
    <Paper p="sm" bg="dark.7" style={{ borderColor: "var(--mantine-primary-color-filled)" }}>
      <Stack gap="xs">
        <NumberInput
          label="Quantos quadrados cabem na largura da seleção?"
          min={1}
          allowDecimal={false}
          allowNegative={false}
          value={cells}
          onChange={setCells}
        />
        <Text size="xs" c="dimmed">
          {Math.round(rect.width)} px ÷ {n} = {size.toFixed(1)} px por quadrado
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => setTool("move")}>
            Cancelar
          </Button>
          <Button disabled={size < LIMITS.cellPx.min} onClick={apply}>
            Aplicar
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
