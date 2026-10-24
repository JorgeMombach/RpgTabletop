import { Progress } from "@mantine/core";
import { hpLevel, hpRatio } from "../format";

const COLORS = { full: "teal", mid: "yellow", low: "red", zero: "red" } as const;

export function HpBar({ hp, hpMax, thick = false }: { hp: number; hpMax: number; thick?: boolean }) {
  return (
    <Progress
      value={hpRatio(hp, hpMax) * 100}
      color={COLORS[hpLevel(hp, hpMax)]}
      size={thick ? "md" : "xs"}
      radius="xl"
      bg="dark.5"
      transitionDuration={200}
      aria-label={`Vida ${hp} de ${hpMax}`}
    />
  );
}
