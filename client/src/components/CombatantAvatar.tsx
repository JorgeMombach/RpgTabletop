import { Avatar, Box } from "@mantine/core";
import type { CombatantView } from "@rpg/shared";
import { initials } from "../map/geometry";

/** Hexágono de ponta para cima (NPC), o mesmo formato do token no mapa. */
export const HEX_CLIP = "polygon(50% 0, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";

type AvatarSource = Pick<CombatantView, "name" | "color" | "avatar" | "type">;

/** Avatar do combatente (imagem ou iniciais) com o anel na cor do token. */
export function CombatantAvatar({ c, size = 36 }: { c: AvatarSource; size?: number }) {
  const npc = c.type === "npc";
  const avatar = (
    <Avatar
      src={c.avatar}
      size={npc ? size - 4 : size}
      // Aliado = círculo; mob = quadrado arredondado; NPC = hexágono, como no mapa.
      radius={npc ? 0 : c.type === "mob" ? "sm" : "xl"}
      color="gray"
      variant="filled"
      styles={{
        root: {
          border: npc ? undefined : `2px solid ${c.color}`,
          background: c.avatar ? undefined : c.color,
          clipPath: npc ? HEX_CLIP : undefined,
          flex: "none",
        },
        placeholder: { background: c.color, color: "#fff", fontSize: size * 0.36, fontWeight: 700 },
      }}
      aria-hidden
    >
      {initials(c.name)}
    </Avatar>
  );
  if (!npc) return avatar;
  // clip-path corta a borda; o anel vem de um hexágono maior por trás.
  return (
    <Box w={size} h={size} bg={c.color} p={2} style={{ clipPath: HEX_CLIP, flex: "none" }} aria-hidden>
      {avatar}
    </Box>
  );
}
