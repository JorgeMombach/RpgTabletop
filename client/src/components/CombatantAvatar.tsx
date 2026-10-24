import { Avatar } from "@mantine/core";
import type { CombatantView } from "@rpg/shared";
import { initials } from "../map/geometry";

/** Avatar do combatente (imagem ou iniciais) com o anel na cor do token. */
export function CombatantAvatar({ c, size = 36 }: { c: Pick<CombatantView, "name" | "color" | "avatar" | "type">; size?: number }) {
  return (
    <Avatar
      src={c.avatar}
      size={size}
      // Aliado = círculo; mob = quadrado arredondado, como no mapa.
      radius={c.type === "mob" ? "sm" : "xl"}
      color="gray"
      variant="filled"
      styles={{
        root: { border: `2px solid ${c.color}`, background: c.avatar ? undefined : c.color, flex: "none" },
        placeholder: { background: c.color, color: "#fff", fontSize: size * 0.36, fontWeight: 700 },
      }}
      aria-hidden
    >
      {initials(c.name)}
    </Avatar>
  );
}
