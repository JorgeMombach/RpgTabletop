import { ActionIcon, Button, FileButton, Group, Image, Modal, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { IconPhoto, IconPresentation, IconX } from "@tabler/icons-react";
import { LIMITS } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { mapImageFromFile } from "../images";
import { toast } from "../notify";
import { useApp } from "../store";
import { Panel } from "./Panel";

/**
 * O que o mestre está mostrando para a mesa, aberto por cima da tela de cada um (inclusive do mestre).
 * Cada um fecha o seu; enquanto o mestre continuar mostrando, o botão do topo (HandoutButton) reabre.
 */
export function HandoutModal() {
  const handout = useApp((s) => s.handout);
  const dismissed = useApp((s) => s.handoutDismissed);
  const open = !!handout && dismissed !== handout.id;
  return (
    <Modal
      opened={open}
      onClose={() => handout && useApp.setState({ handoutDismissed: handout.id })}
      title={handout?.title}
      size="lg"
      centered
      styles={{ title: { fontFamily: "var(--mantine-font-family-headings)", fontWeight: 700 } }}
    >
      {handout && (
        <Stack gap="sm">
          {handout.image && <Image src={handout.image} alt={handout.title ?? ""} radius="sm" fit="contain" mah="70vh" />}
          {handout.text && <Text style={{ whiteSpace: "pre-wrap" }}>{handout.text}</Text>}
        </Stack>
      )}
    </Modal>
  );
}

/** Botão do topo: reabre o que o mestre está mostrando, depois de fechado. Some quando ele para de mostrar. */
export function HandoutButton({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const handout = useApp((s) => s.handout);
  const dismissed = useApp((s) => s.handoutDismissed);
  if (!handout || dismissed !== handout.id) return null;
  const reopen = () => useApp.setState({ handoutDismissed: null });
  return (
    <Tooltip label={t("handout.reopenTip")}>
      {compact ? (
        <ActionIcon variant="default" size="lg" onClick={reopen} aria-label={t("handout.reopen")}>
          <IconPresentation size={18} />
        </ActionIcon>
      ) : (
        <Button variant="light" color="bronze" leftSection={<IconPresentation size={14} />} onClick={reopen}>
          {t("handout.reopen")}
        </Button>
      )}
    </Tooltip>
  );
}

/** Painel do mestre (aba Mesa): título, texto e/ou imagem e "Mostrar para todos"; "Parar de mostrar" fecha para todos. */
export function HandoutPanel() {
  const t = useT();
  const showing = useApp((s) => s.handout);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | null) {
    if (!file) return;
    try {
      setImage(await mapImageFromFile(file));
    } catch (err) {
      toast({ kind: "error", text: (err as Error).message });
    }
  }

  async function show() {
    setBusy(true);
    const res = await act("handout:show", { title, text, ...(image && { image }) });
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setText("");
      setImage(null);
    }
  }

  return (
    <Panel title={t("handout.title")}>
      {showing && (
        <Group gap="xs" wrap="nowrap" justify="space-between">
          <Text size="xs" c="bronze.4" truncate title={showing.title}>
            {t("handout.showing", { title: showing.title ?? t("handout.untitled") })}
          </Text>
          <Button size="compact-sm" variant="default" color="red" onClick={() => act("handout:close", {})} style={{ flex: "none" }}>
            {t("handout.stop")}
          </Button>
        </Group>
      )}
      <TextInput label={t("handout.titleLabel")} placeholder={t("handout.titlePlaceholder")} maxLength={LIMITS.handoutTitle} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
      <Textarea
        label={t("handout.text")}
        placeholder={t("handout.textPlaceholder")}
        maxLength={LIMITS.handoutText}
        autosize
        minRows={2}
        maxRows={8}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      {image ? (
        <Group gap="xs" wrap="nowrap">
          <Image src={image} alt="" h={56} w={56} radius="sm" fit="cover" />
          <Text size="xs" c="dimmed" style={{ flex: 1 }}>
            {t("handout.imageReady")}
          </Text>
          <Tooltip label={t("handout.removeImage")}>
            <ActionIcon size="sm" color="red" aria-label={t("handout.removeImage")} onClick={() => setImage(null)}>
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : (
        <FileButton onChange={(f) => void pick(f)} accept="image/png,image/jpeg,image/webp">
          {(props) => (
            <Button {...props} variant="default" leftSection={<IconPhoto size={14} />}>
              {t("handout.image")}
            </Button>
          )}
        </FileButton>
      )}
      <Button leftSection={<IconPresentation size={14} />} loading={busy} disabled={!title.trim() && !text.trim() && !image} onClick={() => void show()}>
        {t("handout.show")}
      </Button>
    </Panel>
  );
}
