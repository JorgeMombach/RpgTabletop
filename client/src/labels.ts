import type { EffectPreset, GenAmbientId, GenSfxId, LightId, WeatherId } from "@rpg/shared";
import { t, type MessageKey } from "./i18n";

/**
 * Nomes que vêm das listas compartilhadas (efeitos, clima, luz, sons gerados) no idioma de quem lê.
 * Os rótulos em português de `@rpg/shared` continuam valendo para o servidor e o arquivo de sessão.
 */
export const presetLabel = (p: EffectPreset) => t(`preset.${p}` as MessageKey);
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
