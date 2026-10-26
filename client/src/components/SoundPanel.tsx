import { ActionIcon, Button, Divider, FileButton, Group, Select, SimpleGrid, Slider, Stack, Text, Tooltip } from "@mantine/core";
import { IconFolderOpen, IconPlayerPlay, IconPlayerStop, IconRefresh, IconUpload } from "@tabler/icons-react";
import { GEN_SOUNDS, LIMITS, type ClientState, type SoundChannel, type SoundSource } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
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
  const groups = [{ group: "Gerados pelo app", items: Object.entries(gen).map(([id, label]) => ({ value: `gen:${id}`, label })) }];
  if (files.length > 0) groups.push({ group: "Sua pasta de sons", items: files.map((f) => ({ value: `file:${f}`, label: f })) });
  return groups;
}

/** Volume de um canal para a mesa: o servidor recebe só quando solta o controle. */
function VolumeSlider({ channel, value }: { channel: SoundChannel | "sfx"; value: number }) {
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
      aria-label="Volume para a mesa"
    />
  );
}

/** Música ou ambiente: escolher, tocar (em loop para todos), parar e volume. */
function LoopChannel({ state, channel, label }: { state: ClientState; channel: SoundChannel; label: string }) {
  const track = state.sound[channel];
  const [choice, setChoice] = useState<string | null>(track ? keyOf(track.source) : null);
  const files = state.soundLibrary ?? [];
  const now = track ? (track.source.kind === "file" ? track.source.name : GEN_SOUNDS.ambient[track.source.id as keyof typeof GEN_SOUNDS.ambient]) : null;

  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <Text size="xs" c={now ? "copper.4" : "dimmed"} truncate title={now ?? undefined} maw={170}>
          {now ? `tocando: ${now}` : "parado"}
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Select
          style={{ flex: 1, minWidth: 0 }}
          placeholder="Escolha um som"
          data={options(GEN_SOUNDS.ambient, files)}
          value={choice}
          onChange={setChoice}
          searchable
          selectFirstOptionOnChange
          comboboxProps={{ withinPortal: true }}
          aria-label={`${label}: som`}
        />
        <Tooltip label="Tocar para a mesa (em loop)">
          <ActionIcon variant="filled" size="lg" disabled={!choice} aria-label={`Tocar ${label}`} onClick={() => choice && act("sound:play", { channel, source: sourceOf(choice) })}>
            <IconPlayerPlay size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Parar">
          <ActionIcon variant="default" size="lg" disabled={!track} aria-label={`Parar ${label}`} onClick={() => act("sound:stop", { channel })}>
            <IconPlayerStop size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <VolumeSlider channel={channel} value={state.sound.volume[channel]} />
    </Stack>
  );
}

async function fireSfx(source: SoundSource) {
  const res = await socket.timeout(5000).emitWithAck("sound:sfx", source).catch(() => ({ ok: false as const, error: "Sem resposta do servidor." }));
  if (!res.ok) toast({ kind: "error", text: res.error });
}

async function upload(files: File[]) {
  for (const file of files) {
    if (file.size > LIMITS.soundBytes) {
      toast({ kind: "error", text: `${file.name}: grande demais (máximo ${Math.round(LIMITS.soundBytes / 1024 / 1024)} MB).` });
      continue;
    }
    const res = await socket
      .timeout(120_000)
      .emitWithAck("sound:upload", { name: file.name, data: await file.arrayBuffer() })
      .catch(() => ({ ok: false as const, error: "Sem resposta do servidor." }));
    toast(res.ok ? { kind: "info", text: `${file.name} adicionado à pasta de sons.` } : { kind: "error", text: `${file.name}: ${res.error}` });
  }
}

/**
 * Som da mesa (E25), só para o mestre: música e ambiente em loop, efeitos de uma vez e a pasta de sons.
 * Todos ouvem o mesmo; cada um ajusta o próprio volume geral no alto-falante do topo.
 */
export function SoundPanel({ state }: { state: ClientState }) {
  const [fileSfx, setFileSfx] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const library = state.soundLibrary;

  return (
    <Panel title="Som">
      <LoopChannel state={state} channel="music" label="Música" />
      <LoopChannel state={state} channel="ambient" label="Ambiente" />

      <Divider label="Efeitos (tocam uma vez para todos)" labelPosition="left" />
      <SimpleGrid cols={2} spacing={6} verticalSpacing={6}>
        {Object.entries(GEN_SOUNDS.sfx).map(([id, label]) => (
          <Button key={id} variant="default" size="compact-sm" onClick={() => void fireSfx({ kind: "gen", id } as SoundSource)}>
            {label}
          </Button>
        ))}
      </SimpleGrid>
      {library && library.length > 0 && (
        <Group gap="xs" wrap="nowrap">
          <Select
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Arquivo da pasta"
            data={library}
            value={fileSfx}
            onChange={setFileSfx}
            searchable
            selectFirstOptionOnChange
            comboboxProps={{ withinPortal: true }}
            aria-label="Efeito: arquivo"
          />
          <Tooltip label="Tocar uma vez para a mesa">
            <ActionIcon variant="default" size="lg" disabled={!fileSfx} aria-label="Tocar arquivo" onClick={() => fileSfx && void fireSfx({ kind: "file", name: fileSfx })}>
              <IconPlayerPlay size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
      <Text size="xs" c="dimmed">
        Volume dos efeitos
      </Text>
      <VolumeSlider channel="sfx" value={state.sound.volume.sfx} />

      <Divider label="Pasta de sons" labelPosition="left" />
      {library === null || library === undefined ? (
        <Text size="xs" c="dimmed">
          Pasta de sons não configurada: só os sons gerados pelo app. No app do mestre ela é Documentos/Jamal&apos;s Tabletop/Sons; no servidor, use a opção --sounds-dir.
        </Text>
      ) : (
        <>
          <Text size="xs" c="dimmed">
            {library.length === 0
              ? "Nenhum arquivo ainda. Adicione músicas e efeitos (MP3, OGG, WAV, M4A…)."
              : `${library.length} ${library.length === 1 ? "arquivo" : "arquivos"} na pasta.`}
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
                  Adicionar
                </Button>
              )}
            </FileButton>
            <Tooltip label="Reler a pasta (arquivos copiados direto para lá)">
              <ActionIcon variant="default" size="lg" aria-label="Atualizar lista" onClick={() => act("sound:refresh", {})}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            {desktop?.openSoundsFolder && (
              <Tooltip label="Abrir a pasta de sons">
                <ActionIcon variant="default" size="lg" aria-label="Abrir a pasta de sons" onClick={() => desktop?.openSoundsFolder()}>
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
