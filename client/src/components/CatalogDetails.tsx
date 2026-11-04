import { Divider, List, Loader, Stack, Text } from "@mantine/core";
import type { CatalogBlock, CatalogDetails } from "@rpg/shared";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useLang, useT, type MessageKey } from "../i18n";
import { socket } from "../socket";

/** Texto de cada monstro, pedido uma vez por página (só quando o mestre abre). */
const cache = new Map<string, Promise<CatalogDetails | null>>();
function loadDetails(id: string): Promise<CatalogDetails | null> {
  let p = cache.get(id);
  if (!p) {
    p = socket
      .timeout(10_000)
      .emitWithAck("catalog:details", id)
      .then((res) => (res.ok ? res.details : null))
      .catch(() => {
        cache.delete(id);
        return null;
      });
    cache.set(id, p);
  }
  return p;
}

/** "**Primeiro Rugido.** texto": o que está entre ** vai em negrito. */
function inline(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>));
}

/** Descrição com parágrafos e listas ("* 1º nível: …"), como no SRD. */
function Desc({ text }: { text: string }) {
  const parts = text.split("\n").filter((l) => l.trim());
  const out: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length) {
      out.push(
        <List key={`l${out.length}`} size="xs" spacing={0} withPadding>
          {items.map((it, i) => (
            <List.Item key={i}>{inline(it)}</List.Item>
          ))}
        </List>,
      );
      items = [];
    }
  };
  for (const line of parts) {
    if (/^\*\s/.test(line)) items.push(line.replace(/^\*\s+/, ""));
    else {
      flush();
      out.push(
        <Text key={`p${out.length}`} size="xs">
          {inline(line)}
        </Text>,
      );
    }
  }
  flush();
  return <Stack gap={2}>{out}</Stack>;
}

function Blocks({ title, blocks }: { title?: string; blocks: CatalogBlock[] }) {
  if (!blocks.length) return null;
  return (
    <Stack gap={6}>
      {title && <Divider label={title} labelPosition="left" />}
      {blocks.map((b, i) => (
        <Stack key={i} gap={2}>
          <Text size="xs" fw={700} c="bronze.3">
            {b.name}.
          </Text>
          <Desc text={b.desc} />
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * Habilidades de um monstro do catálogo (Passo 12, fase C): deslocamento, sentidos, idiomas… e os traços e ações
 * do SRD, só para o mestre ler. O texto não vai no estado do jogo: vem do catálogo, pela origem (`srd:goblin`).
 */
export function CatalogDetailsView({ id }: { id: string }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [details, setDetails] = useState<CatalogDetails | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setDetails(undefined);
    void loadDetails(id).then((d) => alive && setDetails(d));
    return () => {
      alive = false;
    };
  }, [id]);

  if (details === undefined) return <Loader size="xs" color="bronze" />;
  if (details === null)
    return (
      <Text size="xs" c="dimmed">
        {t("catalog.detailsPending")}
      </Text>
    );
  const d = details[lang];
  const section = (k: MessageKey) => t(k);
  return (
    <Stack gap={8}>
      <Stack gap={2}>
        {d.lines.map((l) => (
          <Text key={l.label} size="xs">
            <b>{l.label}</b> {l.text}
          </Text>
        ))}
      </Stack>
      <Blocks blocks={d.traits} />
      <Blocks title={section("catalog.actions")} blocks={d.actions} />
      <Blocks title={section("catalog.reactions")} blocks={d.reactions} />
      <Blocks title={section("catalog.legendary")} blocks={d.legendary} />
    </Stack>
  );
}
