import { Alert, Button, Checkbox, FileButton, Group, Modal, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconFileImport } from "@tabler/icons-react";
import { LIMITS, parseUvtt, UvttError, type UvttScene } from "@rpg/shared";
import { useState } from "react";
import { create } from "zustand";
import { act } from "../actions";
import { t, useT, type MessageKey } from "../i18n";
import { mapImageFromDataUrl } from "../images";
import { toast } from "../notify";
import { useApp } from "../store";

/** Arquivo lido, esperando a confirmação na janela. */
const usePending = create<{ scene: UvttScene | null; name: string; torches: number }>(() => ({ scene: null, name: "", torches: 0 }));

async function open(file: File | null) {
  if (!file) return;
  try {
    const scene = parseUvtt(JSON.parse(await file.text()));
    // Tochas que já estão na cena: as luzes do arquivo só cabem se não passar do limite.
    usePending.setState({ scene, name: file.name, torches: useApp.getState().state?.battle.torches.length ?? 0 });
  } catch (err) {
    toast({ kind: "error", text: err instanceof UvttError ? t(err.message as MessageKey, { n: LIMITS.walls }) : t("uvtt.notMap") });
  }
}

/** Botão "Importar do Dungeondraft" (painel Mapa) e a janela de confirmação (Passo 9). */
export function UvttImportButton() {
  const t = useT();
  return (
    <>
      <FileButton onChange={(f) => void open(f)} accept=".dd2vtt,.uvtt,.df2vtt,application/json">
        {(props) => (
          <Button {...props} variant="default" leftSection={<IconFileImport size={14} />}>
            {t("uvtt.import")}
          </Button>
        )}
      </FileButton>
      <UvttImportModal />
    </>
  );
}

function UvttImportModal() {
  const t = useT();
  const { scene, name, torches } = usePending();
  const [walls, setWalls] = useState(true);
  const [lights, setLights] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!scene) return null;
  const close = () => {
    usePending.setState({ scene: null });
    setLights(false);
    setWalls(true);
  };
  const doors = scene.walls.filter((w) => w.door).length;
  // Luzes demais para o limite de tochas: a opção fica desligada e a dica explica.
  const lightsFit = scene.lights.length > 0 && torches + scene.lights.length <= LIMITS.mapTorches;

  async function confirm() {
    if (!scene) return;
    setBusy(true);
    try {
      const { image, width } = await mapImageFromDataUrl(`data:${scene.mime};base64,${scene.image}`);
      const res = await act("map:importUvtt", {
        image,
        cellPx: width / scene.cols,
        ...(walls && { walls: scene.walls }),
        ...(lights && lightsFit && { torches: scene.lights }),
      });
      if (res.ok) {
        toast({ kind: "success", text: t("uvtt.done") });
        close();
      }
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened onClose={close} title={t("uvtt.title")} size="md">
      <Stack gap="sm">
        <Text size="sm">
          <b>{name}</b> · {t("uvtt.size", { cols: Math.round(scene.cols), rows: Math.round(scene.rows) })}
        </Text>
        <Checkbox
          checked={walls}
          onChange={(e) => setWalls(e.currentTarget.checked)}
          label={t("uvtt.walls", { walls: scene.walls.length - doors, doors })}
          description={t("uvtt.wallsHint")}
          disabled={scene.walls.length === 0}
        />
        <Checkbox
          checked={lights && lightsFit}
          onChange={(e) => setLights(e.currentTarget.checked)}
          label={t("uvtt.lights", { n: scene.lights.length })}
          description={scene.lights.length > 0 && !lightsFit ? t("uvtt.lightsTooMany", { n: LIMITS.mapTorches }) : t("uvtt.lightsHint")}
          disabled={!lightsFit}
        />
        <Alert color="bronze" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
          <Text size="xs">{t(walls ? "uvtt.replaceWarning" : "uvtt.replaceWarningNoWalls")}</Text>
        </Alert>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button leftSection={<IconFileImport size={14} />} loading={busy} onClick={() => void confirm()}>
            {t("uvtt.confirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
