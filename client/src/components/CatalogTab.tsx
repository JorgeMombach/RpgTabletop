import { Badge, Button, Collapse, Group, Loader, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { IconCircleCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { ABILITIES, CREATURE_COLOR, CREATURE_TYPES, crValue, type CatalogCollection, type CatalogEntry, type MobTemplate } from "@rpg/shared";
import { useEffect, useMemo, useState } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { fmtMod } from "../format";
import { localizeError, useLang, useT, type MessageKey } from "../i18n";
import { toast } from "../notify";
import { socket } from "../socket";
import { CombatantAvatar } from "./CombatantAvatar";

/** Faixas de ND do filtro (0 a 1, 2 a 4…). */
const CR_BANDS: [string, number, number][] = [
  ["0-1", 0, 1],
  ["2-4", 2, 4],
  ["5-10", 5, 10],
  ["11-16", 11, 16],
  ["17+", 17, 99],
];

/** A lista vem do servidor uma vez por página (só texto; carrega ao abrir a aba). */
let cache: Promise<CatalogCollection[]> | null = null;
function loadCatalog(): Promise<CatalogCollection[]> {
  cache ??= socket
    .timeout(10_000)
    .emitWithAck("catalog:list")
    .then((res) => {
      if (!res.ok) throw new Error(localizeError(res));
      return res.collections;
    })
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

/**
 * Aba Catálogo do Bestiário (Passo 12): monstros prontos (SRD 5.1), com busca e filtros. Adicionar copia para o
 * bestiário do mestre (editável); Pôr no mapa também cria os mobs. Já no bestiário, Pôr no mapa usa o modelo dele.
 */
export function CatalogTab({ templates, onAdded }: { templates: MobTemplate[]; onAdded?: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [collections, setCollections] = useState<CatalogCollection[] | null>(null);
  const [search, setSearch] = useState("");
  const [band, setBand] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog().then(setCollections, (err: Error) => toast({ kind: "error", text: err.message }));
  }, []);

  const all = useMemo(() => (collections ?? []).flatMap((c) => c.entries), [collections]);
  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(lang);
    const range = CR_BANDS.find((b) => b[0] === band);
    return all
      .filter((e) => !q || e.name[lang].toLocaleLowerCase(lang).includes(q) || e.name.en.toLowerCase().includes(q))
      .filter((e) => !range || (crValue(e.cr) >= range[1] && crValue(e.cr) <= range[2]) || (range[1] === 0 && crValue(e.cr) < 1))
      .filter((e) => !type || e.type === type)
      .sort((a, b) => crValue(a.cr) - crValue(b.cr) || a.name[lang].localeCompare(b.name[lang], lang));
  }, [all, search, band, type, lang]);

  if (!collections) return <Loader size="sm" color="bronze" mx="auto" my="md" />;

  return (
    <Stack gap="xs">
      <TextInput placeholder={t("catalog.search")} leftSection={<IconSearch size={14} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} aria-label={t("catalog.search")} />
      <Group gap={4} grow>
        <Select
          placeholder={t("catalog.anyCr")}
          data={CR_BANDS.map(([v]) => ({ value: v, label: t("catalog.crBand", { band: v.replace("-", t("catalog.to")) }) }))}
          value={band}
          onChange={setBand}
          clearable
          comboboxProps={{ withinPortal: true }}
          aria-label={t("catalog.crFilter")}
        />
        <Select
          placeholder={t("catalog.anyType")}
          data={CREATURE_TYPES.filter((ty) => all.some((e) => e.type === ty)).map((ty) => ({ value: ty, label: t(`creature.${ty}` as MessageKey) }))}
          value={type}
          onChange={setType}
          clearable
          comboboxProps={{ withinPortal: true }}
          aria-label={t("catalog.typeFilter")}
        />
      </Group>
      <Text size="xs" c="dimmed">
        {t("catalog.count", { n: shown.length, total: all.length })} · {collections.map((c) => c.name).join(", ")}
      </Text>
      {shown.map((e) => (
        <CatalogRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} owned={templates.find((x) => x.source === e.id)} onAdded={onAdded} />
      ))}
    </Stack>
  );
}

function CatalogRow({ e, open, onToggle, owned, onAdded }: { e: CatalogEntry; open: boolean; onToggle: () => void; owned?: MobTemplate; onAdded?: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [qty, setQty] = useState<string | number>(1);
  const name = e.name[lang];
  const kind = `${t(`creature.${e.type}` as MessageKey)} · ${t(`size.${e.size}` as MessageKey).replace(/ \(.*\)$/, "")}`;

  async function add() {
    let copy = false;
    if (owned) {
      copy = await confirmAction({ title: t("catalog.ownedTitle", { name: owned.name }), message: t("catalog.ownedMessage"), confirmLabel: t("catalog.addCopy") });
      if (!copy) return;
    }
    const res = await act("catalog:add", { entryId: e.id, lang, ...(copy && { copy }) });
    if (res.ok) toast({ kind: "success", text: t("catalog.added", { name }) });
  }

  async function place() {
    const res = await act("catalog:add", { entryId: e.id, lang, place: Number(qty) || 1 });
    if (res.ok) {
      toast({ kind: "success", text: t(owned ? "catalog.placedOwned" : "catalog.placed", { n: Number(qty) || 1, name: owned?.name ?? name }) });
      onAdded?.();
    }
  }

  return (
    <Paper p="xs" bg="dark.7">
      <UnstyledButton w="100%" onClick={onToggle} aria-expanded={open}>
        <Group gap="sm" wrap="nowrap">
          <CombatantAvatar c={{ name, color: CREATURE_COLOR[e.type], type: "mob" }} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" truncate title={name}>
              {name}
            </Text>
            <Text size="xs" c="dimmed" truncate title={kind}>
              {kind}
            </Text>
          </div>
          {owned && (
            // Ícone e não etiqueta: na coluna mínima o nome precisa do espaço.
            <Tooltip label={t("catalog.ownedTip")}>
              <IconCircleCheck size={14} color="var(--mantine-color-copper-4)" style={{ flex: "none" }} aria-label={t("catalog.owned")} />
            </Tooltip>
          )}
          <Tooltip label={t("catalog.crTip")}>
            <Badge variant="default" size="sm" style={{ flex: "none" }}>
              {t("catalog.cr", { cr: e.cr })}
            </Badge>
          </Tooltip>
          <IconChevronDown size={14} style={{ flex: "none", transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} />
        </Group>
      </UnstyledButton>
      {/* Detalhes só da linha aberta: com o catálogo inteiro, montar todos pesaria (e os botões escondidos ficariam no Tab). */}
      <Collapse expanded={open}>
        {open && (
        <Stack gap={6} mt="xs">
          <Text size="xs">
            {t("catalog.stats", { hp: e.hpMax, ac: e.ac, init: fmtMod(Math.floor((e.abilities.dex - 10) / 2)) })}
          </Text>
          <SimpleGrid cols={6} spacing={2}>
            {ABILITIES.map((k) => (
              <Stack key={k} gap={0} align="center" className="catalog-ability">
                <Text fz={10} c="dimmed" fw={700}>
                  {t(`ability.${k}` as MessageKey)}
                </Text>
                <Text size="xs" fw={700}>
                  {e.abilities[k]}
                </Text>
                <Text fz={10} c="dimmed">
                  {fmtMod(Math.floor((e.abilities[k] - 10) / 2))}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>
          {e.attacks.map((a, i) => (
            <Text key={i} size="xs">
              <b>{a.name[lang]}</b>{" "}
              <Text span c="dimmed" size="xs">
                {[a.bonus !== undefined ? fmtMod(a.bonus) : null, a.damage].filter(Boolean).join(" · ")}
              </Text>
            </Text>
          ))}
          <Group gap="xs" wrap="wrap" mt={4}>
            <Button style={{ flex: "1 1 auto" }} onClick={() => void add()}>
              {t("catalog.add")}
            </Button>
            <Group gap={4} wrap="nowrap" style={{ flex: "1 1 auto" }}>
              <NumberInput w={52} min={1} max={50} allowDecimal={false} allowNegative={false} clampBehavior="strict" value={qty} onChange={setQty} aria-label={t("summon.qty")} />
              <Tooltip label={t(owned ? "catalog.placeOwnedTip" : "catalog.placeTip")}>
                <Button variant="default" style={{ flex: 1 }} onClick={() => void place()}>
                  {t("catalog.place")}
                </Button>
              </Tooltip>
            </Group>
          </Group>
        </Stack>
        )}
      </Collapse>
    </Paper>
  );
}
