import { ActionIcon, Button, Divider, Group, Modal, Stack, Text, Tooltip } from "@mantine/core";
import { IconDownload, IconPencil } from "@tabler/icons-react";
import { downloadCharacters, downloadMonsters } from "../sheetFiles";
import { CatalogDetailsView } from "./CatalogDetails";
import type { ClientState, Combatant } from "@rpg/shared";
import { useEffect, useState } from "react";
import { fmtMod } from "../format";
import { useT } from "../i18n";
import { canOpenSheet, useApp } from "../store";
import { Abbr } from "./Abbr";
import { CombatantAvatar } from "./CombatantAvatar";
import { ConditionsSection } from "./ConditionsSection";
import { DeathSaves } from "./DeathSaves";
import { DescriptionSection } from "./DescriptionSection";
import { EditForm, HpBlock, kindText, MoreActions } from "./SelectedPanel";
import { SheetTabs } from "./SheetTabs";
import { StatsSection } from "./StatsSection";
import { SummonForm } from "./SummonForm";

/**
 * Ficha completa (duplo clique no token, nas listas ou o botão Ficha do cartão): tudo do combatente com espaço,
 * na frente da mesa. Só no computador; no celular a ficha já é uma aba inteira. O cartão da coluna direita fica
 * com o que se usa a cada rodada.
 */
export function SheetModal({ state }: { state: ClientState }) {
  const id = useApp((s) => s.sheetId);
  const gm = state.self.role === "gm";
  // Jogador só recebe os próprios aliados completos; o mestre, todos.
  const c = id && canOpenSheet(state, id) ? ([...state.allies, ...(gm ? [...state.battle.mobs, ...state.battle.npcs] : [])].find((o) => o.id === id) as Combatant | undefined) : undefined;
  const close = () => useApp.setState({ sheetId: null });
  // Removido (ou deixou de ser deste jogador) com a ficha aberta: fecha.
  useEffect(() => {
    if (id && !c) close();
  }, [id, c]);
  return (
    <Modal opened={!!c} onClose={close} withCloseButton={false} size={960} padding={0} classNames={{ content: "sheet-window" }}>
      {c && <SheetBody key={c.id} state={state} c={c} onClose={close} />}
    </Modal>
  );
}

function SheetBody({ state, c, onClose }: { state: ClientState; c: Combatant; onClose: () => void }) {
  const t = useT();
  const gm = state.self.role === "gm";
  const canEdit = gm || c.ownerId === state.self.id;
  const [mode, setMode] = useState<"view" | "edit" | "summon">("view");
  const kind = kindText(state, c, t);
  const source = c.type !== "ally" ? state.templates.find((x) => x.id === c.templateId)?.source : undefined;

  return (
    <Stack gap="md" p="lg">
      <Group gap="md" wrap="nowrap">
        <CombatantAvatar c={c} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text ff="heading" fw={700} fz={24} c="bronze.4" truncate title={c.name}>
            {c.name}
          </Text>
          <Text size="sm" c="dimmed" truncate title={kind}>
            {kind} · <Abbr title={t("selected.initTip")}>{t("selected.init")}</Abbr> {fmtMod(c.dexMod)}
          </Text>
        </div>
        {canEdit && mode === "view" && (
          <Tooltip label={t("sheetFile.downloadTip")}>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label={t("sheetFile.download")}
              onClick={() => void (c.type === "ally" ? downloadCharacters([c], c.name, gm) : downloadMonsters([c], c.name))}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        {canEdit && mode === "view" && (
          <Tooltip label={t("selected.editTip")}>
            <Button variant="default" leftSection={<IconPencil size={14} />} onClick={() => setMode("edit")}>
              {t("selected.edit")}
            </Button>
          </Tooltip>
        )}
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
      </Group>

      {mode === "edit" ? (
        <EditForm c={c} gm={gm} onDone={() => setMode("view")} />
      ) : mode === "summon" ? (
        <SummonForm summoner={c} templates={state.templates} onClose={() => setMode("view")} />
      ) : (
        <div className="sheet-grid">
          <Stack gap="md">
            <HpBlock c={c} canEdit={canEdit} />
            {c.type === "ally" && c.hp <= 0 && <DeathSaves c={c} editable={canEdit} gm={gm} />}
            <StatsSection c={c} canRoll={canEdit} gm={gm} />
            <ConditionsSection c={c} editable={canEdit} />
            <DescriptionSection c={c} gm={gm} />
            {/* Mob ou NPC do catálogo (Passo 12): as habilidades do SRD, só para o mestre. */}
            {gm && source && (
              <Stack gap={6}>
                <Divider label={t("catalog.detailsTitle")} labelPosition="left" />
                <CatalogDetailsView id={source} />
              </Stack>
            )}
          </Stack>
          <div style={{ minWidth: 0 }}>
            <SheetTabs c={c} editable={canEdit} gm={gm} wide />
          </div>
        </div>
      )}

      {canEdit && mode === "view" && (
        <>
          <Divider />
          <MoreActions state={state} c={c} onSummon={() => setMode("summon")} />
        </>
      )}
    </Stack>
  );
}
