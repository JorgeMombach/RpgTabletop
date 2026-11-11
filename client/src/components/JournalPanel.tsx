import { ActionIcon, Button, Stack, TextInput, Tooltip } from "@mantine/core";
import { IconBook, IconPlus, IconSearch } from "@tabler/icons-react";
import { LIMITS } from "@rpg/shared";
import { useMemo, useState } from "react";
import { useT } from "../i18n";
import { useApp } from "../store";
import { EmptyState } from "./EmptyState";
import { groupEntries, JournalList, openJournal } from "./JournalWindow";
import { Panel } from "./Panel";

/** Mestre (Passo 14): o diário em lista compacta na aba Mesa; libera pelo olho e abre a janela para escrever. */
export function JournalPanel() {
  const t = useT();
  const journal = useApp((s) => s.journal);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupEntries(journal, query, "all"), [journal, query]);
  const full = journal.length >= LIMITS.journal;
  return (
    <Panel
      title={t("journal.panel")}
      anchor="journal"
      aside={
        <Tooltip label={t("journal.new")}>
          <ActionIcon variant="default" aria-label={t("journal.new")} disabled={full} onClick={() => openJournal("new")}>
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>
      }
    >
      {journal.length === 0 ? (
        <EmptyState
          icon={IconBook}
          title={t("journal.emptyTitle")}
          text={t("journal.empty")}
          action={
            <Button size="compact-sm" leftSection={<IconPlus size={14} />} onClick={() => openJournal("new")}>
              {t("journal.new")}
            </Button>
          }
        />
      ) : (
        <Stack gap={6}>
          <TextInput size="xs" leftSection={<IconSearch size={14} />} placeholder={t("journal.searchShort")} aria-label={t("journal.search")} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <JournalList groups={groups} selectedId={null} gm onPick={(id) => openJournal(id)} />
        </Stack>
      )}
    </Panel>
  );
}
