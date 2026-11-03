import { EFFECT_PRESETS, type EffectPreset, type GenAmbientId, type GenSfxId, type LightId, type WeatherId } from "@rpg/shared";
import { t, type MessageKey } from "./i18n";

/**
 * Nomes que vêm das listas compartilhadas (efeitos, clima, luz, sons gerados) no idioma de quem lê.
 * Os rótulos em português de `@rpg/shared` continuam valendo para o servidor e o arquivo de sessão.
 */
export const presetLabel = (p: EffectPreset) => t(`preset.${p}` as MessageKey);
/**
 * Nome de um efeito no idioma de quem vê: o nome próprio, se tiver; senão o do tipo ("Fogo", e "Fogo (pintado)"
 * na pintura do pincel). Efeitos de antes, gravados com o nome do tipo em português, contam como sem nome.
 */
export function effectLabel(e: { name: string; preset: EffectPreset; cells?: number[] }): string {
  const pt = EFFECT_PRESETS[e.preset].label;
  if (e.name && e.name !== pt && e.name !== `${pt} (pintado)`) return e.name;
  return e.cells ? t("paint.name", { effect: presetLabel(e.preset) }) : presetLabel(e.preset);
}
export const weatherLabel = (w: WeatherId) => t(`weather.${w}` as MessageKey);
export const lightLabel = (l: LightId) => t(`light.${l}` as MessageKey);
export const soundLabel = (id: GenAmbientId | GenSfxId) => t(`sound.${id}` as MessageKey);

const GROUPS: Record<string, MessageKey> = {
  "Água e frio": "weatherGroup.water",
  Ar: "weatherGroup.air",
  "Fogo e terra": "weatherGroup.fire",
  "Mágico e sombrio": "weatherGroup.magic",
};
export const weatherGroupLabel = (g: string) => (GROUPS[g] ? t(GROUPS[g]) : g);
