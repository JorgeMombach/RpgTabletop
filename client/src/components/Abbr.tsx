import type { ReactNode } from "react";

/** Abreviação com explicação ao passar o mouse (DES, ft, d20…). */
export function Abbr({ title, children }: { title: string; children: ReactNode }) {
  return (
    <abbr className="abbr" title={title}>
      {children}
    </abbr>
  );
}
