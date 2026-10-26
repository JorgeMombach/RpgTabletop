import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconCheck, IconLanguage } from "@tabler/icons-react";
import { LANGS, setLang, useLang, useT, type Lang } from "../i18n";

/** Troca o idioma da interface (só neste navegador). */
export function LanguageMenu({ size = "lg" }: { size?: "md" | "lg" }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={t("lang.tooltip")}>
          <ActionIcon variant="default" size={size} aria-label={t("lang.label")}>
            <IconLanguage size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("lang.label")}</Menu.Label>
        {(Object.keys(LANGS) as Lang[]).map((l) => (
          <Menu.Item key={l} lang={l} onClick={() => setLang(l)} rightSection={l === lang ? <IconCheck size={14} /> : null}>
            {LANGS[l]}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
