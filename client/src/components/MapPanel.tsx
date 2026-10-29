import { ActionIcon, Button, Checkbox, FileButton, Group, Input, NumberInput, Paper, SegmentedControl, Slider, Stack, Text, Tooltip } from "@mantine/core";
import { LIMITS, TABLE_STYLES, type GridInput, type MapConfig, type TableStyle } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { mapImageFromFile } from "../images";
import { toast } from "../notify";
import { setTool, useApp } from "../store";
import { Abbr } from "./Abbr";
import { Panel } from "./Panel";
import { useT, type MessageKey } from "../i18n";

/** Mesa em volta do mapa (L5), por cena. */
const TABLE_LABEL: Record<TableStyle, MessageKey> = { wood: "mapPanel.tableWood", leather: "mapPanel.tableLeather", slate: "mapPanel.tableSlate" };

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
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const { tool, calibRect } = useApp();
  const sendGrid = useThrottledGrid();

  // Valores locais para os sliders responderem na hora; o servidor confirma depois.
  const [local, setLocal] = useState({ cellPx: map.cellPx, offsetX: map.offsetX, offsetY: map.offsetY, imageScale: map.imageScale });
  useEffect(
    () => setLocal({ cellPx: map.cellPx, offsetX: map.offsetX, offsetY: map.offsetY, imageScale: map.imageScale }),
    [map.cellPx, map.offsetX, map.offsetY, map.imageScale],
  );

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
      if (res.ok) toast({ kind: "success", text: t("mapPanel.sent") });
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    const ok = await confirmAction({ title: t("mapPanel.removeTitle"), message: t("mapPanel.removeMessage"), confirmLabel: t("common.remove"), danger: true });
    if (ok) void act("battle:setMap", { image: null });
  }

  return (
    <Panel title={t("mapPanel.title")} anchor="map">
      <Group gap="xs">
        <FileButton onChange={upload} accept="image/png,image/jpeg,image/webp">
          {(props) => (
            <Button {...props} loading={uploading}>
              {map.hasImage ? t("mapPanel.change") : t("mapPanel.upload")}
            </Button>
          )}
        </FileButton>
        {map.hasImage && (
          <Button variant="default" onClick={() => void removeImage()}>
            {t("common.remove")}
          </Button>
        )}
      </Group>

      {map.hasImage && (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" style={{ flex: 1 }}>
            {t("mapPanel.rotate", { deg: map.rotation })}
          </Text>
          <Tooltip label={t("mapPanel.left")}>
            <ActionIcon variant="default" aria-label={t("mapPanel.left")} onClick={() => act("battle:grid", { rotation: map.rotation - 90 })}>
              ⟲
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("mapPanel.right")}>
            <ActionIcon variant="default" aria-label={t("mapPanel.right")} onClick={() => act("battle:grid", { rotation: map.rotation + 90 })}>
              ⟳
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
      {map.hasImage && (
        <Input.Wrapper
          label={
            <Tooltip label={t("mapPanel.scaleTip")}>
              <span>{t("mapPanel.scale", { n: Math.round(local.imageScale * 100) })}</span>
            </Tooltip>
          }
        >
          <Group gap="xs" wrap="nowrap" mt={6}>
            <Slider
              style={{ flex: 1 }}
              min={10}
              max={400}
              step={1}
              value={Math.round(local.imageScale * 100)}
              onChange={(v) => change({ imageScale: v / 100 })}
              label={(v) => `${v}%`}
              aria-label={t("mapPanel.scaleLabel")}
            />
            <Tooltip label={t("mapPanel.original")}>
              <Button variant="default" size="compact-xs" disabled={map.imageScale === 1} onClick={() => change({ imageScale: 1 })}>
                100%
              </Button>
            </Tooltip>
          </Group>
        </Input.Wrapper>
      )}

      <Input.Wrapper label={t("mapPanel.table")}>
        <SegmentedControl
          mt={4}
          fullWidth
          data={TABLE_STYLES.map((v) => ({ value: v, label: t(TABLE_LABEL[v]) }))}
          value={map.tableStyle ?? "wood"}
          onChange={(v) => void act("battle:grid", { tableStyle: v as TableStyle })}
        />
      </Input.Wrapper>

      <Checkbox
        checked={map.showGrid}
        onChange={(e) => void act("battle:grid", { showGrid: e.currentTarget.checked })}
        label={
          <>
            {t("mapPanel.showGrid", { n: map.feetPerCell })} <Abbr title={t("mapPanel.ftTitle")}>ft</Abbr>)
          </>
        }
      />

      <Input.Wrapper label={t("mapPanel.cell", { px: local.cellPx.toFixed(1) })}>
        <Slider mt={6} min={LIMITS.cellPx.min} max={200} step={0.5} value={Math.min(local.cellPx, 200)} onChange={(v) => change({ cellPx: v })} />
      </Input.Wrapper>
      <Group grow gap="md">
        <Input.Wrapper label={<Abbr title={t("mapPanel.offsetXTitle")}>{t("mapPanel.offsetX")}</Abbr>}>
          <Slider mt={6} min={0} max={offsetMax} step={0.5} value={Math.min(local.offsetX, offsetMax)} onChange={(v) => change({ offsetX: v })} />
        </Input.Wrapper>
        <Input.Wrapper label={<Abbr title={t("mapPanel.offsetYTitle")}>{t("mapPanel.offsetY")}</Abbr>}>
          <Slider mt={6} min={0} max={offsetMax} step={0.5} value={Math.min(local.offsetY, offsetMax)} onChange={(v) => change({ offsetY: v })} />
        </Input.Wrapper>
      </Group>

      {tool === "calibrate" ? (
        calibRect && calibRect.width > 4 ? (
          <CalibrateForm rect={calibRect} cellPx={map.cellPx} />
        ) : (
          <Text size="xs" c="bronze.4">
            {t("mapPanel.calibrateHint")}
          </Text>
        )
      ) : (
        <Button variant="default" onClick={() => setTool("calibrate")}>
          {t("mapPanel.calibrate")}
        </Button>
      )}
    </Panel>
  );
}

function CalibrateForm({ rect, cellPx }: { rect: { x: number; y: number; width: number }; cellPx: number }) {
  const t = useT();
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
          label={t("mapPanel.howMany")}
          min={1}
          allowDecimal={false}
          allowNegative={false}
          value={cells}
          onChange={setCells}
        />
        <Text size="xs" c="dimmed">
          {t("mapPanel.perCell", { w: Math.round(rect.width), n, px: size.toFixed(1) })}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => setTool("move")}>
            {t("common.cancel")}
          </Button>
          <Button disabled={size < LIMITS.cellPx.min} onClick={apply}>
            {t("common.apply")}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
