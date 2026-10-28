import { Button, Menu, Tooltip, type ButtonProps } from "@mantine/core";
import { IconBed } from "@tabler/icons-react";
import type { Combatant } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT } from "../i18n";
import { useApp } from "../store";

type Kind = "short" | "long";

/**
 * Descanso curto ou longo de um combatente, com confirmação (um clique sem querer não enche a vida de ninguém).
 * Jogador: só fora de combate (o servidor também recusa). O mestre pode sempre. Vai para o log.
 */
export function RestButton({ who: c, kind, ...props }: { who: Combatant; kind: Kind } & ButtonProps) {
  const t = useT();
  const gm = useApp((s) => s.state?.self.role === "gm");
  const inCombat = useApp((s) => !!s.state?.battle.combat.active);
  const blocked = inCombat && !gm;

  async function rest() {
    const ok = await confirmAction({
      title: t(kind === "long" ? "rest.longTitle" : "rest.shortTitle", { name: c.name }),
      message: t(kind === "long" ? "sheet.rest.longTip" : "sheet.rest.shortTip"),
      confirmLabel: t(kind === "long" ? "sheet.rest.long" : "sheet.rest.short"),
    });
    if (ok) void act("rest", { id: c.id, kind });
  }

  return (
    <Tooltip label={blocked ? t("rest.inCombat") : t(kind === "long" ? "sheet.rest.longTip" : "sheet.rest.shortTip")}>
      <Button variant="default" disabled={blocked} onClick={() => void rest()} {...props}>
        {t(kind === "long" ? "sheet.rest.long" : "sheet.rest.short")}
      </Button>
    </Tooltip>
  );
}

/** Mestre: o mesmo descanso para todos os aliados de uma vez (no painel Aliados). */
export function RestAllMenu() {
  const t = useT();

  async function restAll(kind: Kind) {
    const ok = await confirmAction({
      title: t(kind === "long" ? "rest.allLongTitle" : "rest.allShortTitle"),
      message: t(kind === "long" ? "sheet.rest.longTip" : "sheet.rest.shortTip"),
      confirmLabel: t(kind === "long" ? "sheet.rest.long" : "sheet.rest.short"),
    });
    if (ok) void act("rest:all", { kind });
  }

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={t("rest.allTip")}>
          <Button variant="default" leftSection={<IconBed size={14} />}>
            {t("rest.all")}
          </Button>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => void restAll("short")}>{t("sheet.rest.short")}</Menu.Item>
        <Menu.Item onClick={() => void restAll("long")}>{t("sheet.rest.long")}</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
