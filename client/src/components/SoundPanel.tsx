import { ActionIcon, Button, Divider, FileButton, Group, Select, SimpleGrid, Slider, Stack, Text, Tooltip } from "@mantine/core";
import { IconFolderOpen, IconPlayerPlay, IconPlayerStop, IconRefresh, IconUpload } from "@tabler/icons-react";
import { GEN_SOUNDS, LIMITS, type ClientState, type GenAmbientId, type GenSfxId, type SoundChannel, type SoundSource } from "@rpg/shared";
import { useEffect, useState } from "react";
import { act } from "../actions";
import { localizeError, t as tr, useT } from "../i18n";
import { soundLabel } from "../labels";
import { toast } from "../notify";
import { desktop } from "../sessionFile";
import { socket } from "../socket";
import { Panel } from "./Panel";

/** "gen:rain" / "file:Taverna.mp3" ↔ origem do som (valor dos seletores). */
const keyOf = (s: SoundSource) => (s.kind === "file" ? `file:${s.name}` : `gen:${s.id}`);
function sourceOf(key: string): SoundSource {
  return key.startsWith("file:") ? { kind: "file", name: key.slice(5) } : ({ kind: "gen", id: key.slice(4) } as SoundSource);
}

function options(gen: Record<string, string>, files: string[]) {
  const groups = [{ group: tr("sound.generated"), items: Object.keys(gen).map((id) => ({ value: `gen:${id}`, label: soundLabel(id as GenAmbientId) })) }];
  if (files.length > 0) groups.push({ group: tr("sound.yourFolder"), items: files.map((f) => ({ value: `file:${f}`, label: f })) });
  return groups;
}

/** Volume de um canal para a mesa: o servidor recebe só quando solta o controle. */
function VolumeSlider({ channel, value }: { channel: SoundChannel | "sfx"; value: number }) {
  const t = useT();
  const [local, setLocal] = useState<number | null>(null);
  return (
    <Slider
      min={0}
      max={100}
      value={local ?? Math.round(value * 100)}
      onChange={setLocal}
      onChangeEnd={(v) => {
        setLocal(null);
        void act("sound:volume", { channel, value: v / 100 });
      }}
      label={(v) => `${v}%`}
      aria-label={t("sound.tableVolume")}
    />
  );
}

/** Música ou ambiente: escolher, tocar (em loop para todos), parar e volume. */
function LoopChannel({ state, channel, label }: { state: ClientState; channel: SoundChannel; label: string }) {
  const t = useT();
  const track = state.sound[channel];
  const [choice, setChoice] = useState<string | null>(track ? keyOf(track.source) : null);
  // Começou a tocar outra coisa (pelo painel Clima, por exemplo): o seletor mostra o que está tocando.
  const playingKey = track ? keyOf(track.source) : null;
  useEffect(() => {
    if (playingKey) setChoice(playingKey);
  }, [playingKey, track?.startedAt]);
  const files = state.soundLibrary ?? [];
  const now = track ? (track.source.kind === "file" ? track.source.name : soundLabel(track.source.id)) : null;

  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <Text size="xs" c={now ? "copper.4" : "dimmed"} truncate title={now ?? undefined} maw={170}>
          {now ? t("sound.playing", { name: now }) : t("sound.stopped")}
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Select
          style={{ flex: 1, minWidth: 0 }}
          placeholder={t("sound.pick")}
          data={options(GEN_SOUNDS.ambient, files)}
          value={choice}
          onChange={setChoice}
          searchable
          selectFirstOptionOnChange
          comboboxProps={{ withinPortal: true }}
          aria-label={t("sound.of", { channel: label })}
        />
        <Tooltip label={t("sound.playLoop")}>
          <ActionIcon variant="filled" size="lg" disabled={!choice} aria-label={t("sound.playOf", { channel: label })} onClick={() => choice && act("sound:play", { channel, source: sourceOf(choice) })}>
            <IconPlayerPlay size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("sound.stop")}>
          <ActionIcon variant="default" size="lg" disabled={!track} aria-label={t("sound.stopOf", { channel: label })} onClick={() => act("sound:stop", { channel })}>
            <IconPlayerStop size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <VolumeSlider channel={channel} value={state.sound.volume[channel]} />
    </Stack>
  );
}

async function fireSfx(source: SoundSource) {
  const res = await socket.timeout(5000).emitWithAck("sound:sfx", source).catch(() => ({ ok: false as const, error: tr("common.noServer") }));
  if (!res.ok) toast({ kind: "error", text: localizeError(res) });
}

async function upload(files: File[]) {
  for (const file of files) {
    if (file.size > LIMITS.soundBytes) {
      toast({ kind: "error", text: tr("sound.tooBig", { name: file.name, mb: Math.round(LIMITS.soundBytes / 1024 / 1024) }) });
      continue;
    }
    const res = await socket
      .timeout(120_000)
      .emitWithAck("sound:upload", { name: file.name, data: await file.arrayBuffer() })
      .catch(() => ({ ok: false as const, error: tr("common.noServer") }));
    toast(res.ok ? { kind: "info", text: tr("sound.added", { name: file.name }) } : { kind: "error", text: `${file.name}: ${localizeError(res)}` });
  }
}

/**
 * Som da mesa (E25), só para o mestre: música e ambiente em loop, efeitos de uma vez e a pasta de sons.
 * Todos ouvem o mesmo; cada um ajusta o próprio volume geral no alto-falante do topo.
 */
export function SoundPanel({ state }: { state: ClientState }) {
  const t = useT();
  const [fileSfx, setFileSfx] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const library = state.soundLibrary;

  return (
    <Panel title={t("sound.title")}>
      <LoopChannel state={state} channel="music" label={t("sound.music")} />
      <LoopChannel state={state} channel="ambient" label={t("sound.ambient")} />

      <Divider label={t("sound.sfx")} labelPosition="left" />
      <SimpleGrid cols={2} spacing={6} verticalSpacing={6}>
        {Object.keys(GEN_SOUNDS.sfx).map((id) => (
          <Button key={id} variant="default" size="compact-sm" onClick={() => void fireSfx({ kind: "gen", id } as SoundSource)}>
            {soundLabel(id as GenSfxId)}
          </Button>
        ))}
      </SimpleGrid>
      {library && library.length > 0 && (
        <Group gap="xs" wrap="nowrap">
          <Select
            style={{ flex: 1, minWidth: 0 }}
            placeholder={t("sound.fileFromFolder")}
            data={library}
            value={fileSfx}
            onChange={setFileSfx}
            searchable
            selectFirstOptionOnChange
            comboboxProps={{ withinPortal: true }}
            aria-label={t("sound.sfxFile")}
          />
          <Tooltip label={t("sound.playOnce")}>
            <ActionIcon variant="default" size="lg" disabled={!fileSfx} aria-label={t("sound.playFile")} onClick={() => fileSfx && void fireSfx({ kind: "file", name: fileSfx })}>
              <IconPlayerPlay size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
      <Text size="xs" c="dimmed">
        {t("sound.sfxVolume")}
      </Text>
      <VolumeSlider channel="sfx" value={state.sound.volume.sfx} />

      <Divider label={t("sound.folder")} labelPosition="left" />
      {library === null || library === undefined ? (
        <Text size="xs" c="dimmed">
          {t("sound.noFolder")}
        </Text>
      ) : (
        <>
          <Text size="xs" c="dimmed">
            {library.length === 0
              ? t("sound.empty")
              : t("sound.count", { n: library.length })}
          </Text>
          <Group gap="xs">
            <FileButton
              multiple
              accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac,.opus,.webm"
              onChange={(files) => {
                setSending(true);
                void upload(files).finally(() => setSending(false));
              }}
            >
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={14} />} loading={sending}>
                  {t("common.add")}
                </Button>
              )}
            </FileButton>
            <Tooltip label={t("sound.refreshTip")}>
              <ActionIcon variant="default" size="lg" aria-label={t("sound.refresh")} onClick={() => act("sound:refresh", {})}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            {desktop?.openSoundsFolder && (
              <Tooltip label={t("sound.openFolder")}>
                <ActionIcon variant="default" size="lg" aria-label={t("sound.openFolder")} onClick={() => desktop?.openSoundsFolder()}>
                  <IconFolderOpen size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </>
      )}
    </Panel>
  );
}
