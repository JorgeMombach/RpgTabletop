import { Button, Tooltip } from "@mantine/core";
import { IconDice5 } from "@tabler/icons-react";
import type { Combatant } from "@rpg/shared";
import { act } from "../actions";
import { useT } from "../i18n";
import { useRollLock } from "../rollLock";
import { useApp } from "../store";

/**
 * Botão de rolar o dano guardado numa magia ou habilidade da ficha ("Bola de fogo · Dano" no log).
 * Mesma trava do painel Dados; o mestre rola como o combatente (oculto se for mob ou NPC).
 */
export function DamageRollButton({ c, name, expr, disabled }: { c: Combatant; name: string; expr: string; disabled?: boolean }) {
  const t = useT();
  const gm = useApp((s) => s.state?.self.role === "gm");
  const lock = useRollLock();
  return (
    <Tooltip label={lock.reason ? t(lock.reason) : t("sheet.rollDamageOf", { name, expr })}>
      <Button
        size="compact-sm"
        variant="default"
        leftSection={<IconDice5 size={14} />}
        disabled={disabled}
        data-disabled={lock.blocked || undefined}
        onClick={() => {
          if (!lock.blocked) void act("dice:roll", { expr, kind: "damage", name, ...(gm ? { asId: c.id, hidden: c.type !== "ally" } : {}) });
        }}
        aria-label={t("sheet.rollDamageOf", { name, expr })}
        style={{ flex: "none" }}
      >
        {expr}
      </Button>
    </Tooltip>
  );
}
