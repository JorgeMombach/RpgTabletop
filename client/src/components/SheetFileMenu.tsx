import { ActionIcon, FileButton, Menu, Tooltip } from "@mantine/core";
import { IconDownload, IconFileImport, IconFileDescription } from "@tabler/icons-react";
import { useT } from "../i18n";
import { openSheetFile } from "../sheetFiles";

/**
 * Menu "Fichas em arquivo" (Fase 4) no canto de um painel: importar um arquivo e, se der, baixar.
 * `download`: o que baixar (rótulo e ação); ausente ou `disabled`, o item não aparece ou fica apagado.
 */
export function SheetFileMenu({ importLabel, download }: { importLabel: string; download?: { label: string; disabled?: boolean; run: () => void } }) {
  const t = useT();
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={t("sheetFile.menu")}>
          <ActionIcon variant="default" size="lg" aria-label={t("sheetFile.menu")}>
            <IconFileDescription size={16} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <FileButton accept="application/json,.json" onChange={(f) => void openSheetFile(f)}>
          {(props) => (
            <Menu.Item {...props} leftSection={<IconFileImport size={14} />}>
              {importLabel}
            </Menu.Item>
          )}
        </FileButton>
        {download && (
          <Menu.Item leftSection={<IconDownload size={14} />} disabled={download.disabled} onClick={download.run}>
            {download.label}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
