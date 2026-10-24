import { Progress } from "@mantine/core";
import { hpLevel, hpRatio } from "../format";

// Cobre claro → bronze → sangue conforme a vida cai (guia visual E20).
const COLORS = { full: "copper.4", mid: "bronze.5", low: "red.5", zero: "red.5" } as const;

export function HpBar({ hp, hpMax, thick = false }: { hp: number; hpMax: number; thick?: boolean }) {
  return (
    <Progress
      value={hpRatio(hp, hpMax) * 100}
      color={COLORS[hpLevel(hp, hpMax)]}
      size={thick ? "md" : "xs"}
      radius="xl"
      bg="dark.7"
      style={{ border: "1px solid var(--mantine-color-dark-4)" }}
      transitionDuration={200}
      aria-label={`Vida ${hp} de ${hpMax}`}
    />
  );
}
