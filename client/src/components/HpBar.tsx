import { Progress } from "@mantine/core";
import { hpLevel, hpRatio } from "../format";

// Cobre claro → bronze → sangue conforme a vida cai (guia visual E20).
const COLORS = { full: "copper.4", mid: "bronze.5", low: "red.5", zero: "red.5" } as const;

/** Barra de vida; a vida temporária aparece clara, depois da vida (a barra passa a medir vida máx. + temporária). */
export function HpBar({ hp, hpMax, tempHp = 0, thick = false }: { hp: number; hpMax: number; tempHp?: number; thick?: boolean }) {
  const total = hpMax + tempHp;
  return (
    <Progress.Root
      size={thick ? "md" : "xs"}
      radius="xl"
      bg="dark.7"
      style={{ border: "1px solid var(--mantine-color-dark-4)" }}
      aria-label={`Vida ${hp} de ${hpMax}${tempHp ? ` + ${tempHp}` : ""}`}
    >
      <Progress.Section value={hpRatio(hp, total) * 100} color={COLORS[hpLevel(hp, hpMax)]} />
      {tempHp > 0 && <Progress.Section value={(tempHp / total) * 100} color="gray.3" />}
    </Progress.Root>
  );
}
