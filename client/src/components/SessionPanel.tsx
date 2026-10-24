import { Badge, Button, FileButton, Group, Text } from "@mantine/core";
import { IconDeviceFloppy, IconFolderOpen } from "@tabler/icons-react";
import type { ActionResult, SessionFile } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { confirmAction } from "../confirm";
import { toast } from "../notify";
import { desktop, isUnsaved, markSaved, saveSessionFile } from "../sessionFile";
import { socket } from "../socket";
import { useApp } from "../store";
import { Panel } from "./Panel";

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

/** Mestre: salvar a sessão num arquivo e carregar depois (ADR-17, E18). */
export function SessionPanel() {
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
      if (await saveSessionFile()) toast({ kind: "info", text: "Sessão salva. Guarde o arquivo para continuar na próxima vez." });
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
      const res: ActionResult = await socket.timeout(60_000).emitWithAck("session:import", parsed);
      // O estado novo chega antes da resposta: o que está na mesa agora é o do arquivo.
      if (res.ok) markSaved(parsed.savedAt ? new Date(parsed.savedAt) : new Date());
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
          <Badge color="copper" variant="light" size="sm">
            Salvo {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Badge>
        ) : undefined
      }
    >
      <Text size="xs" c="dimmed">
        Nada fica salvo sozinho. Salve num arquivo para continuar na próxima vez (mapa, personagens, bestiário, combate e efeitos). Fechar
        {desktop ? " o app" : " a aba"} com alterações não salvas pede confirmação.
      </Text>
      <Group gap="xs" grow>
        <Button variant="default" loading={busy} leftSection={<IconDeviceFloppy size={14} />} onClick={() => void save()}>
          Salvar
        </Button>
        <FileButton onChange={(f) => void load(f)} accept="application/json,.json">
          {(props) => (
            <Button {...props} variant="default" loading={busy} leftSection={<IconFolderOpen size={14} />}>
              Carregar
            </Button>
          )}
        </FileButton>
      </Group>
    </Panel>
  );
}
