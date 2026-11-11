// Diário da campanha (Passo 14, docs/design/diario.md): janela única — o mestre edita, o jogador lê o que foi liberado.
import { ActionIcon, Badge, Box, Button, Checkbox, Group, Indicator, Modal, NumberInput, Paper, SegmentedControl, Select, Stack, Text, Textarea, TextInput, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { IconBook, IconChevronLeft, IconCircleCheck, IconEye, IconEyeOff, IconFlag, IconLock, IconMapPin, IconNotes, IconPlus, IconCalendar, IconSearch, IconTrash, IconUser, type Icon } from "@tabler/icons-react";
import { JOURNAL_TAGS, LIMITS, type JournalEntry, type JournalTag } from "@rpg/shared";
import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT, type MessageKey } from "../i18n";
import { hasNews, markJournalRead, useJournalSeen } from "../journal";
import { useApp } from "../store";

export const TAG_ICON: Record<JournalTag, Icon> = { session: IconCalendar, quest: IconFlag, npc: IconUser, place: IconMapPin, other: IconNotes };
const TAG_LABEL: Record<JournalTag, MessageKey> = {
  session: "journal.tag.session",
  quest: "journal.tag.quest",
  npc: "journal.tag.npc",
  place: "journal.tag.place",
  other: "journal.tag.other",
};
const GROUP_LABEL: Record<JournalTag, MessageKey> = {
  session: "journal.group.session",
  quest: "journal.group.quest",
  npc: "journal.group.npc",
  place: "journal.group.place",
  other: "journal.group.other",
};

/**
 * Janela aberta e qual entrada está escolhida (`"new"` = entrada nova do mestre). `seq` sobe a cada escolha:
 * o editor é refeito só aí (salvar uma entrada nova troca o id sem refazer o rascunho).
 */
const useJournalWindow = create<{ open: boolean; entryId: string | null; seq: number }>(() => ({ open: false, entryId: null, seq: 0 }));
const choose = (entryId: string | null) => useJournalWindow.setState((s) => ({ entryId, seq: s.seq + 1 }));

/** Abre o diário; com `entryId`, já nessa entrada (ou numa nova, com `"new"`). */
export function openJournal(entryId: string | null = null) {
  useJournalWindow.setState((s) => ({ open: true, entryId, seq: s.seq + 1 }));
}

/** Mesma busca para título e texto, sem diferenciar maiúsculas nem acentos. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Entradas filtradas e agrupadas por etiqueta, na ordem das etiquetas; dentro do grupo, a mais recente primeiro. */
export function groupEntries(entries: JournalEntry[], query: string, tag: JournalTag | "all"): { tag: JournalTag; entries: JournalEntry[] }[] {
  const q = fold(query.trim());
  const shown = entries.filter((e) => (tag === "all" || e.tag === tag) && (!q || fold(`${e.title} ${e.text}`).includes(q)));
  return JOURNAL_TAGS.map((tg) => ({ tag: tg, entries: shown.filter((e) => e.tag === tg).sort((a, b) => b.updatedAt - a.updatedAt) })).filter((g) => g.entries.length > 0);
}

/** Botão do livro (topo): o mestre sempre; o jogador só com alguma entrada liberada, com bolinha se há novidade. */
export function JournalButton({ size = "lg" }: { size?: "md" | "lg" }) {
  const t = useT();
  const gm = useApp((s) => s.state?.self.role === "gm");
  const journal = useApp((s) => s.journal);
  const seenAt = useJournalSeen((s) => s.seenAt);
  if (!gm && journal.length === 0) return null;
  const news = !gm && hasNews(journal, seenAt);
  return (
    <Tooltip label={t("journal.title")}>
      <Indicator disabled={!news} color="bronze" size={8} offset={3} processing>
        <ActionIcon variant="default" size={size} aria-label={news ? t("journal.openNews") : t("journal.title")} onClick={() => openJournal()}>
          <IconBook size={18} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  );
}

/** A janela do diário, montada uma vez no Shell (e no MobileShell). */
export function JournalWindow({ fullScreen = false }: { fullScreen?: boolean }) {
  const t = useT();
  const { open, entryId, seq } = useJournalWindow();
  const gm = useApp((s) => s.state?.self.role === "gm");
  const journal = useApp((s) => s.journal);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<JournalTag | "all">("all");
  const [dirty, setDirty] = useState(false);
  // Até onde o jogador tinha lido quando abriu: as bolinhas da lista continuam até ele fechar.
  const [seenAtOpen, setSeenAtOpen] = useState(0);

  // Abrir conta como ler (a bolinha do botão some); o que chegar com a janela aberta também.
  useEffect(() => {
    if (!open || gm) return;
    setSeenAtOpen((was) => was || useJournalSeen.getState().seenAt || 1);
    markJournalRead(journal);
  }, [open, gm, journal]);

  const groups = useMemo(() => groupEntries(journal, query, tag), [journal, query, tag]);
  const selected = entryId === "new" ? null : (journal.find((e) => e.id === entryId) ?? null);

  // Abrindo sem escolher: a mais recente (o mestre, com o diário vazio, já numa nova). No celular, o jogador começa pela lista.
  useEffect(() => {
    if (!open || entryId !== null || (!gm && fullScreen)) return;
    const first = [...journal].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (first || gm) choose(first ? first.id : "new");
  }, [open, gm, fullScreen, entryId, journal]);

  // Jogador com uma entrada aberta que foi recolhida ou apagada: volta para a lista (ou para a mais recente).
  useEffect(() => {
    if (open && !gm && entryId !== null && !journal.some((e) => e.id === entryId)) choose(null);
  }, [open, gm, entryId, journal]);

  async function leaveDraft(): Promise<boolean> {
    if (!dirty) return true;
    const ok = await confirmAction({ title: t("journal.discardTitle"), message: t("journal.discardMessage"), confirmLabel: t("journal.discard"), danger: true });
    if (ok) setDirty(false);
    return ok;
  }
  async function pick(id: string) {
    if (id === entryId || !(await leaveDraft())) return;
    choose(id);
  }
  async function close() {
    if (!(await leaveDraft())) return;
    useJournalWindow.setState({ open: false, entryId: null });
    setSeenAtOpen(0);
  }
  // Celular: lista ou entrada, uma de cada vez.
  const showing = fullScreen && entryId !== null ? "entry" : "list";

  return (
    <Modal
      opened={open}
      onClose={() => void close()}
      size={1000}
      fullScreen={fullScreen}
      padding={0}
      title={
        <Group gap={8} wrap="nowrap">
          <IconBook size={18} />
          <Text ff="heading" fw={700} c="bronze.4" fz={18}>
            {t("journal.title")}
          </Text>
        </Group>
      }
      classNames={{ header: "journal-head", body: "journal-body" }}
    >
      <div className={`journal-split${fullScreen ? ` single ${showing}` : ""}`}>
        <aside className="journal-list">
          <Stack gap={8} p="sm" className="journal-tools">
            {gm && (
              <Button leftSection={<IconPlus size={14} />} disabled={journal.length >= LIMITS.journal} onClick={() => void pick("new")}>
                {t("journal.new")}
              </Button>
            )}
            <TextInput leftSection={<IconSearch size={14} />} placeholder={t("journal.search")} aria-label={t("journal.search")} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            <TagFilter value={tag} onChange={setTag} />
          </Stack>
          <JournalList groups={groups} selectedId={selected?.id ?? null} gm={gm} seenAt={seenAtOpen} onPick={(id) => void pick(id)} />
        </aside>
        <section className="journal-main">
          {fullScreen && (
            <Button variant="subtle" color="gray" leftSection={<IconChevronLeft size={16} />} m="xs" onClick={() => choose(null)}>
              {t("journal.back")}
            </Button>
          )}
          {gm ? (
            <EntryEditor key={seq} entryId={entryId} onDirty={setDirty} />
          ) : selected ? (
            <EntryReader entry={selected} />
          ) : (
            <Text c="dimmed" p="lg">
              {t("journal.pick")}
            </Text>
          )}
        </section>
      </div>
    </Modal>
  );
}

function TagFilter({ value, onChange }: { value: JournalTag | "all"; onChange: (tag: JournalTag | "all") => void }) {
  const t = useT();
  return (
    <SegmentedControl
      fullWidth
      size="xs"
      value={value}
      onChange={(v) => onChange(v as JournalTag | "all")}
      aria-label={t("journal.filter")}
      data={[
        { value: "all", label: t("journal.all") },
        ...JOURNAL_TAGS.map((tg) => {
          const TagIcon = TAG_ICON[tg];
          return {
            value: tg,
            label: (
              <Tooltip label={t(GROUP_LABEL[tg])}>
                <Box component="span" style={{ display: "grid", placeItems: "center" }} aria-label={t(GROUP_LABEL[tg])}>
                  <TagIcon size={14} />
                </Box>
              </Tooltip>
            ),
          };
        }),
      ]}
    />
  );
}

/** Lista agrupada por etiqueta; o mestre libera/recolhe pelo olho, o jogador vê a bolinha no que é novo. */
export function JournalList({ groups, selectedId, gm, seenAt = Infinity, onPick }: { groups: { tag: JournalTag; entries: JournalEntry[] }[]; selectedId: string | null; gm: boolean; seenAt?: number; onPick: (id: string) => void }) {
  const t = useT();
  if (groups.length === 0)
    return (
      <Text size="sm" c="dimmed" p="sm">
        {t("journal.noResults")}
      </Text>
    );
  return (
    <div className="journal-rows">
      {groups.map((g) => (
        <div key={g.tag}>
          <Text className="journal-group">{t(GROUP_LABEL[g.tag])}</Text>
          {g.entries.map((e) => (
            <JournalRow key={e.id} entry={e} active={e.id === selectedId} gm={gm} fresh={!gm && e.updatedAt > seenAt} onPick={() => onPick(e.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function JournalRow({ entry, active, gm, fresh, onPick }: { entry: JournalEntry; active: boolean; gm: boolean; fresh: boolean; onPick: () => void }) {
  const t = useT();
  const TagIcon = TAG_ICON[entry.tag];
  return (
    <div className={`journal-row${active ? " active" : ""}${entry.done ? " done" : ""}`}>
      <UnstyledButton className="journal-row-main" onClick={onPick} aria-current={active ? "true" : undefined}>
        <TagIcon size={16} className="journal-row-icon" />
        <Text size="sm" fw={500} truncate title={entry.title} className="journal-row-title">
          {entry.title}
        </Text>
        {entry.day !== undefined && (
          <Text size="xs" c="dimmed" className="journal-row-day">
            {t("journal.day", { n: entry.day })}
          </Text>
        )}
        {fresh && <span className="journal-dot" aria-label={t("journal.fresh")} />}
      </UnstyledButton>
      {gm && <ShareToggle entry={entry} />}
    </div>
  );
}

/** Olho da lista: libera ou recolhe sem abrir a entrada. */
export function ShareToggle({ entry }: { entry: JournalEntry }) {
  const t = useT();
  const label = entry.shared ? t("journal.sharedTip") : t("journal.hiddenTip");
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color={entry.shared ? "copper" : "gray"} aria-label={label} onClick={() => void act("journal:share", { id: entry.id, shared: !entry.shared })}>
        {entry.shared ? <IconEye size={16} /> : <IconEyeOff size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** Leitura do jogador: etiqueta, dia, título e o texto liberado (nunca a nota, que nem chega). */
function EntryReader({ entry }: { entry: JournalEntry }) {
  const t = useT();
  const TagIcon = TAG_ICON[entry.tag];
  return (
    <Stack gap={10} p="lg">
      <Group gap={6}>
        <Badge variant="default" leftSection={<TagIcon size={12} />}>
          {t(TAG_LABEL[entry.tag])}
        </Badge>
        {entry.done && (
          <Badge variant="light" color="copper" leftSection={<IconCircleCheck size={12} />}>
            {t("journal.done")}
          </Badge>
        )}
        {entry.day !== undefined && <Badge variant="default">{t("journal.day", { n: entry.day })}</Badge>}
      </Group>
      <Title order={3} c="bronze.4" fz={20} style={{ overflowWrap: "anywhere" }}>
        {entry.title}
      </Title>
      <Text className="journal-read-text" fz={16} lh={1.6}>
        {entry.text}
      </Text>
    </Stack>
  );
}

type Draft = { title: string; tag: JournalTag; day: number | string; text: string; note: string; shared: boolean; done: boolean };

function draftOf(entry: JournalEntry | null, defaultDay: number | undefined): Draft {
  if (!entry) return { title: "", tag: "session", day: defaultDay ?? "", text: "", note: "", shared: false, done: false };
  return { title: entry.title, tag: entry.tag, day: entry.day ?? "", text: entry.text, note: entry.note ?? "", shared: !!entry.shared, done: !!entry.done };
}

/**
 * Editor do mestre: rascunho local até Salvar; Descartar volta ao que foi salvo. A entrada que ele edita é a
 * escolhida ao abrir; uma nova passa a ter id depois de salva (o diário atualizado chega depois da resposta).
 */
function EntryEditor({ entryId, onDirty }: { entryId: string | null; onDirty: (dirty: boolean) => void }) {
  const t = useT();
  const clockDay = useApp((s) => s.state?.clock?.day);
  const [currentId, setCurrentId] = useState(entryId === "new" ? null : entryId);
  const entry = useApp((s) => s.journal.find((e) => e.id === currentId) ?? null);
  const isNew = currentId === null;
  const [base, setBase] = useState(() => draftOf(entry, clockDay));
  const [draft, setDraft] = useState(base);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  if (entryId === null || (!isNew && !entry))
    return (
      <Text c="dimmed" p="lg">
        {t("journal.pick")}
      </Text>
    );

  async function save() {
    setBusy(true);
    const payload = {
      title: draft.title,
      tag: draft.tag,
      text: draft.text,
      note: draft.note,
      shared: draft.shared,
      done: draft.tag === "quest" && draft.done,
      day: draft.day === "" ? null : Number(draft.day),
    };
    const res = await act("journal:upsert", currentId ? { id: currentId, ...payload } : payload);
    setBusy(false);
    if (!res.ok) return;
    setBase(draft);
    const id = res.ids?.[0];
    if (id && !currentId) {
      setCurrentId(id);
      useJournalWindow.setState({ entryId: id });
    }
  }

  async function remove() {
    if (!entry) return;
    if (!(await confirmAction({ title: t("journal.removeTitle", { title: entry.title }), message: t("journal.removeMessage"), confirmLabel: t("common.delete"), danger: true }))) return;
    if ((await act("journal:remove", { id: entry.id })).ok) {
      onDirty(false);
      choose(null);
    }
  }

  return (
    <Stack gap="sm" p="md" className="journal-editor">
      <div className="journal-fields">
        <TextInput label={t("journal.fieldTitle")} required maxLength={LIMITS.journalTitle} value={draft.title} onChange={(e) => set({ title: e.currentTarget.value })} data-autofocus={isNew || undefined} />
        <Select
          label={t("journal.fieldTag")}
          allowDeselect={false}
          value={draft.tag}
          onChange={(v) => v && set({ tag: v as JournalTag })}
          data={JOURNAL_TAGS.map((tg) => ({ value: tg, label: t(TAG_LABEL[tg]) }))}
          leftSection={(() => {
            const TagIcon = TAG_ICON[draft.tag];
            return <TagIcon size={14} />;
          })()}
        />
        <NumberInput label={t("journal.fieldDay")} min={1} max={LIMITS.clockDay} allowDecimal={false} value={draft.day} onChange={(v) => set({ day: v })} />
      </div>
      <Textarea label={t("journal.fieldText")} description={t("journal.textHint")} autosize minRows={6} maxRows={16} maxLength={LIMITS.journalText} value={draft.text} onChange={(e) => set({ text: e.currentTarget.value })} />
      <Paper className="journal-secret" p="sm">
        <Group gap={6} mb={6} wrap="nowrap">
          <IconLock size={14} />
          <Text size="xs" fw={700} c="bronze.4">
            {t("journal.note")}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {t("journal.noteHint")}
          </Text>
        </Group>
        <Textarea aria-label={t("journal.note")} autosize minRows={2} maxRows={8} maxLength={LIMITS.journalNote} value={draft.note} onChange={(e) => set({ note: e.currentTarget.value })} />
      </Paper>
      <Group gap="lg">
        <Checkbox color="copper" label={t("journal.shared")} checked={draft.shared} onChange={(e) => set({ shared: e.currentTarget.checked })} />
        {draft.tag === "quest" && <Checkbox label={t("journal.done")} checked={draft.done} onChange={(e) => set({ done: e.currentTarget.checked })} />}
      </Group>
      <Group gap="xs" justify="space-between" wrap="wrap">
        {entry ? (
          <Button variant="default" color="red" c="red.3" leftSection={<IconTrash size={14} />} onClick={() => void remove()}>
            {t("common.delete")}
          </Button>
        ) : (
          <span />
        )}
        <Group gap="xs">
          {dirty && (
            <Badge variant="light" color="yellow">
              {t("journal.unsavedEdit")}
            </Badge>
          )}
          <Button variant="subtle" color="gray" disabled={!dirty} onClick={() => setDraft(base)}>
            {t("journal.discard")}
          </Button>
          <Button loading={busy} disabled={!dirty || !draft.title.trim()} onClick={() => void save()}>
            {t("common.save")}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
