import { ActionIcon, Group, Select, TextInput, Tooltip } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { LIMITS } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { useApp } from "../store";

const ALL = "all";

/**
 * Mensagem no log (Passo 6): para todos ou um sussurro. O jogador sussurra só para o mestre; o mestre, para
 * cada jogador (o servidor confere). Fica em cima do log, no painel Dados, no log flutuante e na janela do log.
 */
export function ChatBar() {
  const t = useT();
  const self = useApp((s) => s.state?.self);
  const players = useApp((s) => s.state?.players);
  const allies = useApp((s) => s.state?.allies);
  const [to, setTo] = useState(ALL);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  if (!self || !players) return null;
  const gm = self.role === "gm";

  const data = [
    { value: ALL, label: t("chat.all") },
    ...(gm
      ? players
          .filter((p) => p.role === "player")
          .map((p) => {
            const char = allies?.find((a) => a.ownerId === p.id && !a.summonerId);
            return { value: p.id, label: char && char.name !== p.name ? `${p.name} (${char.name})` : p.name };
          })
      : [{ value: "gm", label: t("chat.toGm") }]),
  ];
  // O jogador escolhido saiu da sessão: volta para todos.
  const target = data.some((d) => d.value === to) ? to : ALL;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await act("chat:send", { text, ...(target !== ALL && { to: target }) });
    setSending(false);
    if (res.ok) setText("");
  }

  return (
    <Group component="form" gap={4} wrap="nowrap" onSubmit={send}>
      <Select
        size="xs"
        w={118}
        data={data}
        value={target}
        onChange={(v) => v && setTo(v)}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true, width: 200, position: "bottom-start" }}
        aria-label={t("chat.to")}
      />
      <TextInput
        size="xs"
        style={{ flex: 1, minWidth: 0 }}
        value={text}
        maxLength={LIMITS.chatLength}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder={t(target === ALL ? "chat.placeholder" : "chat.whisperPlaceholder")}
        aria-label={t("chat.message")}
        rightSection={
          <Tooltip label={t("chat.send")}>
            <ActionIcon type="submit" size="sm" variant="subtle" loading={sending} disabled={!text.trim()} aria-label={t("chat.send")}>
              <IconSend size={14} />
            </ActionIcon>
          </Tooltip>
        }
      />
    </Group>
  );
}
