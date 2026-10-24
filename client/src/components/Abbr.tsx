import { Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

/** Abreviação com explicação ao passar o mouse (DES, ft, d20…). */
export function Abbr({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Tooltip label={title}>
      <abbr className="abbr" aria-label={title}>
        {children}
      </abbr>
    </Tooltip>
  );
}
