import { Badge, Box, Button, Collapse, Group, Modal, Paper, SegmentedControl, Stack, Table, Text, UnstyledButton } from "@mantine/core";
import { IconAlertTriangle, IconChevronDown, IconFileImport } from "@tabler/icons-react";
import type { CharacterSheet, MobTemplate, SheetCheckItem, SheetImportChoice } from "@rpg/shared";
import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { sheetDiff, diffSummary, type DiffRow } from "../sheetDiff";
import { importSheets, useSheetImport } from "../sheetFiles";
import { CombatantAvatar } from "./CombatantAvatar";

const label = { size: "xs", tt: "uppercase", fw: 700, style: { letterSpacing: "0.06em" } } as const;

/** Tabela "campo · na mesa · no arquivo"; listas mostram o que sai (vermelho) e o que entra (verde). */
function DiffTable({ rows, here }: { rows: DiffRow[]; here: string }) {
  const t = useT();
  return (
    <Table withRowBorders verticalSpacing={6} horizontalSpacing="xs" fz="sm" layout="fixed">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w="28%">
            <Text {...label} c="dimmed">
              {t("sheetFile.field")}
            </Text>
          </Table.Th>
          <Table.Th>
            <Text {...label} c="dimmed">
              {here}
            </Text>
          </Table.Th>
          <Table.Th>
            <Text {...label} c="bronze.4">
              {t("sheetFile.inFile")}
            </Text>
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.label}>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {r.label}
              </Text>
            </Table.Td>
            {"added" in r ? (
              <Table.Td colSpan={2}>
                <Group gap={4}>
                  {r.removed.map((x) => (
                    <Badge key={`-${x}`} variant="light" color="red" tt="none" fw={500} maw="100%">
                      − {x}
                    </Badge>
                  ))}
                  {r.added.map((x) => (
                    <Badge key={`+${x}`} variant="light" color="copper" tt="none" fw={500} maw="100%">
                      + {x}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
            ) : (
              <>
                <Table.Td>
                  <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                    {r.table}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="bronze.3" fw={700} style={{ overflowWrap: "anywhere" }}>
                    {r.file}
                  </Text>
                </Table.Td>
              </>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

const avatarOf = (s: CharacterSheet | MobTemplate, monsters: boolean) => ({ name: s.name, color: s.color, avatar: s.avatar, type: monsters ? ("mob" as const) : ("ally" as const) });

/**
 * Janela de importar fichas (Fase 4): aparece quando alguma ficha do arquivo é diferente da que está na mesa.
 * Uma ficha: a tabela inteira e Substituir / Importar como cópia / Cancelar. Várias: a lista dos diferentes,
 * cada um com Substituir, Cópia ou Pular (e "Todos"); os novos entram direto e os iguais ficam como estão.
 */
export function SheetImportModal({ gm }: { gm: boolean }) {
  const t = useT();
  const pending = useSheetImport((s) => s.pending);
  const [choice, setChoice] = useState<Record<string, SheetImportChoice>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Arquivo novo: tudo começa em Substituir e o primeiro diferente aberto.
  useEffect(() => {
    if (!pending) return;
    const differs = pending.items.filter((i) => i.status === "differs");
    setChoice(Object.fromEntries(differs.map((i) => [i.sheet.id, "replace"])));
    setOpen(differs[0]?.sheet.id ?? null);
  }, [pending]);

  if (!pending) return null;
  const close = () => useSheetImport.setState({ pending: null });
  const monsters = pending.kind === "monsters";
  const here = t(monsters ? "sheetFile.inBestiary" : "sheetFile.inTable");
  const differs = pending.items.filter((i) => i.status === "differs");
  const single = pending.items.length === 1 ? pending.items[0] : null;

  async function run(choices: Record<string, SheetImportChoice>) {
    if (!pending) return;
    setBusy(true);
    const ok = await importSheets(pending.file, pending.items, choices);
    setBusy(false);
    if (ok) close();
  }

  if (single) {
    const rows = sheetDiff(single.table!, single.sheet);
    return (
      <Modal opened onClose={close} size="lg" title={t(monsters ? "sheetFile.inBestiaryTitle" : "sheetFile.inTableTitle", { name: single.table!.name })}>
        <Stack gap="sm">
          <Group gap="sm" wrap="nowrap">
            <CombatantAvatar c={avatarOf(single.table!, monsters)} size={40} />
            <Text size="sm">{t("sheetFile.differsIntro")}</Text>
          </Group>
          <DiffTable rows={rows} here={here} />
          {!monsters && <Text size="xs" c="dimmed">{t("sheetFile.stateKept")}</Text>}
          {!gm && (
            <Paper p="xs" bg="dark.7">
              <Group gap={8} wrap="nowrap" align="flex-start">
                <IconAlertTriangle size={16} color="var(--mantine-color-bronze-4)" style={{ flex: "none", marginTop: 2 }} />
                <Text size="xs">{t("sheetFile.replaceRisk")}</Text>
              </Group>
            </Paper>
          )}
          <Group justify="flex-end" gap="xs" mt={4}>
            <Button variant="subtle" color="gray" onClick={close}>
              {t("common.cancel")}
            </Button>
            {single.canCopy && (
              <Button variant="default" loading={busy} onClick={() => void run({ [single.sheet.id]: "copy" })}>
                {t("sheetFile.importCopy")}
              </Button>
            )}
            <Button loading={busy} onClick={() => void run({ [single.sheet.id]: "replace" })}>
              {t(monsters ? "sheetFile.replaceBestiary" : "sheetFile.replaceTable")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  const count = (s: SheetCheckItem["status"]) => pending.items.filter((i) => i.status === s).length;
  const options = (item: SheetCheckItem) => [
    { value: "replace", label: t("sheetFile.replace") },
    { value: "copy", label: t("sheetFile.copy"), disabled: !item.canCopy },
    { value: "skip", label: t("sheetFile.skip") },
  ];
  const values = differs.map((i) => choice[i.sheet.id]);
  const all = values.every((v) => v === values[0]) ? values[0] : "";
  return (
    <Modal opened onClose={close} size="lg" title={t(monsters ? "sheetFile.importMonsters" : "sheetFile.importCharacters", { n: pending.items.length })}>
      <Stack gap="sm">
        <Group gap={6}>
          {count("new") > 0 && (
            <Badge variant="light" color="copper" tt="none" fw={500}>
              {t("sheetFile.countNew", { n: count("new") })}
            </Badge>
          )}
          {count("same") > 0 && (
            <Badge variant="light" color="gray" tt="none" fw={500}>
              {t("sheetFile.countSame", { n: count("same") })}
            </Badge>
          )}
          <Badge variant="light" color="bronze" tt="none" fw={500}>
            {t("sheetFile.countDiffers", { n: differs.length })}
          </Badge>
        </Group>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm">{t(monsters ? "sheetFile.differsBestiary" : "sheetFile.differsTable")}</Text>
          <Group gap={6} wrap="nowrap">
            <Text size="xs" c="dimmed">
              {t("sheetFile.all")}
            </Text>
            <SegmentedControl
              size="xs"
              data={[
                { value: "replace", label: t("sheetFile.replace") },
                { value: "copy", label: t("sheetFile.copy"), disabled: differs.some((i) => !i.canCopy) },
                { value: "skip", label: t("sheetFile.skip") },
              ]}
              value={all}
              onChange={(v) => setChoice(Object.fromEntries(differs.map((i) => [i.sheet.id, v as SheetImportChoice])))}
              aria-label={t("sheetFile.all")}
            />
          </Group>
        </Group>
        <Stack gap={6}>
          {differs.map((item) => {
            const rows = sheetDiff(item.table!, item.sheet);
            const id = item.sheet.id;
            return (
              <Paper key={id} p="xs" bg="dark.7" radius="sm">
                <Group gap="sm" wrap="nowrap">
                  <CombatantAvatar c={avatarOf(item.table!, monsters)} size={32} />
                  <UnstyledButton style={{ flex: 1, minWidth: 0 }} onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id}>
                    <Group gap={4} wrap="nowrap">
                      <Text size="sm" fw={700} truncate>
                        {item.table!.name}
                      </Text>
                      <IconChevronDown size={14} style={{ flex: "none", transform: open === id ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} />
                    </Group>
                    <Text size="xs" c="dimmed" truncate title={diffSummary(rows)}>
                      {diffSummary(rows)}
                    </Text>
                  </UnstyledButton>
                  <SegmentedControl
                    size="xs"
                    data={options(item)}
                    value={choice[id] ?? "replace"}
                    onChange={(v) => setChoice({ ...choice, [id]: v as SheetImportChoice })}
                    aria-label={item.table!.name}
                  />
                </Group>
                <Collapse expanded={open === id}>
                  <Box mt={6}>
                    <DiffTable rows={rows} here={here} />
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Stack>
        <Text size="xs" c="dimmed">
          {t(monsters ? "sheetFile.bestiaryNote" : "sheetFile.stateKept")}
        </Text>
        <Group justify="flex-end" gap="xs" mt={4}>
          <Button variant="subtle" color="gray" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button leftSection={<IconFileImport size={14} />} loading={busy} onClick={() => void run(choice)}>
            {t("sheetFile.import")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

