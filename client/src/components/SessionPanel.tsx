import { Badge, Button, FileButton, Group, Text } from "@mantine/core";
import { IconDeviceFloppy, IconFolderOpen } from "@tabler/icons-react";
import type { ActionResult, SessionFile } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { confirmAction } from "../confirm";
import { localizeError, t as tr, useLang, useT } from "../i18n";
import { toast } from "../notify";
import { desktop, isUnsaved, markSaved, saveSessionFile } from "../sessionFile";
import { socket } from "../socket";
import { useApp } from "../store";
import { Panel } from "./Panel";

/** Resumo do arquivo para a confirmação (o servidor valida tudo de novo ao carregar). */
function summary(f: Partial<SessionFile>): string {
  const g = f.game;
  const n = (list: unknown) => (Array.isArray(list) ? list.length : 0);
  const saved = f.savedAt ? new Date(f.savedAt).toLocaleString(useLang.getState().lang) : tr("session.unknownDate");
  const parts = [
    tr("session.characters", { n: n(g?.allies) }),
    tr("session.mobs", { n: n(g?.battle?.mobs) }),
    tr("session.npcs", { n: n(g?.battle?.npcs) }),
    tr("session.templates", { n: n(g?.templates) }),
    tr("session.effects", { n: n(g?.battle?.effects) }),
    g?.battle?.map?.image ? tr("session.withImage") : tr("session.noImage"),
  ];
  return tr("session.savedAt", { when: saved, parts: parts.join(", ") });
}

/** Mestre: salvar a sessão num arquivo e carregar depois (ADR-17, E18). */
export function SessionPanel() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const { state, savedSnapshot, savedAt } = useApp();
  const unsaved = isUnsaved(state, savedSnapshot);

  // Navegador: fechar a aba com alterações não salvas mostra o aviso padrão dele (o texto não é personalizável).
  // No app do mestre quem cuida disso é o CloseGuard, com o modal "Salvar e sair".
  const unsavedRef = useRef(unsaved);
  unsavedRef.current = unsaved;
  useEffect(() => {
    if (desktop) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function save() {
    setBusy(true);
    try {
      if (await saveSessionFile()) toast({ kind: "success", text: t("session.saved") });
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function load(file: File | null) {
    if (!file) return;
    let parsed: Partial<SessionFile>;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return toast({ kind: "error", text: t("session.badJson") });
    }
    const ok = await confirmAction({
      title: t("session.loadTitle"),
      message: `${summary(parsed)} ${t("session.loadMessage")}`,
      confirmLabel: t("session.load"),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res: ActionResult = await socket.timeout(60_000).emitWithAck("session:import", parsed);
      // O estado novo chega antes da resposta: o que está na mesa agora é o do arquivo.
      if (res.ok) markSaved(parsed.savedAt ? new Date(parsed.savedAt) : new Date());
      toast(res.ok ? { kind: "success", text: t("session.loaded") } : { kind: "error", text: localizeError(res) });
    } catch {
      toast({ kind: "error", text: t("common.noServer") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={t("session.title")}
      aside={
        unsaved ? (
          <Badge color="yellow" variant="light" size="sm">
            {t("session.unsaved")}
          </Badge>
        ) : savedAt ? (
          <Badge color="copper" variant="light" size="sm">
            {t("session.savedTime", { time: savedAt.toLocaleTimeString(useLang.getState().lang, { hour: "2-digit", minute: "2-digit" }) })}
          </Badge>
        ) : undefined
      }
    >
      <Text size="xs" c="dimmed">
        {t(desktop ? "session.hintApp" : "session.hintTab")}
      </Text>
      <Group gap="xs" grow>
        <Button variant="default" loading={busy} leftSection={<IconDeviceFloppy size={14} />} onClick={() => void save()}>
          {t("common.save")}
        </Button>
        <FileButton onChange={(f) => void load(f)} accept="application/json,.json">
          {(props) => (
            <Button {...props} variant="default" loading={busy} leftSection={<IconFolderOpen size={14} />}>
              {t("session.load")}
            </Button>
          )}
        </FileButton>
      </Group>
    </Panel>
  );
}
