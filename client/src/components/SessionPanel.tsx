import { Badge, Button, FileButton, Group, Text } from "@mantine/core";
import type { ActionResult, ClientState, SessionExportResult, SessionFile } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { confirmAction } from "../confirm";
import { toast } from "../notify";
import { socket } from "../socket";
import { useApp } from "../store";
import { Panel } from "./Panel";

/** "jamals-tabletop-2026-10-24-2130.json" */
function fileName(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `jamals-tabletop-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Resumo do arquivo para a confirmação (o servidor valida tudo de novo ao carregar). */
function summary(f: Partial<SessionFile>): string {
  const g = f.game;
  const n = (list: unknown) => (Array.isArray(list) ? list.length : 0);
  const saved = f.savedAt ? new Date(f.savedAt).toLocaleString("pt-BR") : "data desconhecida";
  const parts = [
    `${n(g?.allies)} personagem(ns)`,
    `${n(g?.battle?.mobs)} mob(s)`,
    `${n(g?.battle?.npcs)} NPC(s)`,
    `${n(g?.templates)} template(s)`,
    `${n(g?.battle?.effects)} efeito(s)`,
    g?.battle?.map?.image ? "mapa com imagem" : "mapa sem imagem",
  ];
  return `Salvo em ${saved}: ${parts.join(", ")}.`;
}

/** O que vai para o arquivo; jogadores entrando e saindo não contam como alteração. */
function snapshot(s: ClientState | null): string {
  if (!s) return "";
  return JSON.stringify([s.templates, s.allies, s.battle, s.log]);
}

/** Nada que valha salvar ainda (mesa vazia). */
function empty(s: ClientState | null): boolean {
  return !s || (s.allies.length + s.templates.length + s.battle.mobs.length + s.battle.npcs.length === 0 && !s.battle.map.hasImage);
}

/** Mestre: salvar a sessão num arquivo e carregar depois (ADR-17, E18). */
export function SessionPanel() {
  const [busy, setBusy] = useState(false);
  const state = useApp((s) => s.state);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const savedSnapshot = useRef<string | null>(null);
  // Depois de carregar um arquivo, o primeiro estado que chega já está "salvo".
  const markNext = useRef(false);
  if (markNext.current && state) {
    markNext.current = false;
    savedSnapshot.current = snapshot(state);
  }
  const unsaved = !empty(state) && snapshot(state) !== savedSnapshot.current;

  // Fechar a aba com alterações não salvas: o navegador mostra o aviso padrão dele (o texto não é personalizável).
  const unsavedRef = useRef(unsaved);
  unsavedRef.current = unsaved;
  useEffect(() => {
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
      const res: SessionExportResult = await socket.timeout(30_000).emitWithAck("session:export");
      if (!res.ok) return toast({ kind: "error", text: res.error });
      download(fileName(), JSON.stringify(res.file));
      savedSnapshot.current = snapshot(useApp.getState().state);
      setSavedAt(new Date());
      toast({ kind: "info", text: "Sessão salva. Guarde o arquivo para continuar na próxima vez." });
    } catch {
      toast({ kind: "error", text: "Sem resposta do servidor." });
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
      return toast({ kind: "error", text: "Esse arquivo não é um JSON válido." });
    }
    const ok = await confirmAction({
      title: "Carregar esta sessão?",
      message: `${summary(parsed)} Tudo o que está na mesa agora é substituído. Jogadores reencontram os personagens entrando com o mesmo nome.`,
      confirmLabel: "Carregar",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      markNext.current = true;
      const res: ActionResult = await socket.timeout(60_000).emitWithAck("session:import", parsed);
      if (!res.ok) markNext.current = false;
      else setSavedAt(parsed.savedAt ? new Date(parsed.savedAt) : null);
      toast(res.ok ? { kind: "info", text: "Sessão carregada." } : { kind: "error", text: res.error });
    } catch {
      toast({ kind: "error", text: "Sem resposta do servidor." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Sessão"
      aside={
        unsaved ? (
          <Badge color="yellow" variant="light" size="sm">
            Não salvo
          </Badge>
        ) : savedAt ? (
          <Badge color="green" variant="light" size="sm">
            Salvo {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Badge>
        ) : undefined
      }
    >
      <Text size="xs" c="dimmed">
        Nada fica salvo sozinho. Salve num arquivo para continuar na próxima vez (mapa, personagens, bestiário, combate e efeitos). Fechar a aba com alterações não salvas pede confirmação.
      </Text>
      <Group gap="xs" grow>
        <Button variant="default" loading={busy} onClick={() => void save()}>
          💾 Salvar
        </Button>
        <FileButton onChange={(f) => void load(f)} accept="application/json,.json">
          {(props) => (
            <Button {...props} variant="default" loading={busy}>
              📂 Carregar
            </Button>
          )}
        </FileButton>
      </Group>
    </Panel>
  );
}
