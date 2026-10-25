import type { RollResult } from "@rpg/shared";

// Dados 3D (E22) com @3d-dice/dice-box-threejs: a física é só para mostrar. O resultado vem do servidor
// e a notação "2d6@4,1" faz os dados pararem exatamente nesses valores (ADR-07: quem sorteia é o servidor).
// O valor que a biblioteca devolve no fim da rolagem vem errado no d4 (bug dela), mas a face na tela está certa
// (conferido): por isso nada aqui usa o retorno de roll(); o total mostrado é sempre o do servidor.

/** Faces que a biblioteca desenha; outras (d3, d7…) ficam só no resultado escrito. */
const DRAWABLE = new Set([4, 6, 8, 10, 12, 20, 100]);
/** Muitos dados viram uma bagunça na tela: acima disso, só o resultado escrito. */
const MAX_DICE = 20;

/**
 * Notação da biblioteca a partir da rolagem do servidor: os valores vão todos num `@` só, no fim,
 * na ordem dos dados ("2d6+1d8@6,6,2"). `null` = nada para animar.
 * O "d100" da biblioteca é só o dado das dezenas (10…90, 00): o d100 vira o par dezenas + d10,
 * como na mesa (29 = "20" + 9; 100 = "00" + 0).
 */
export function notationFor(roll: RollResult): string | null {
  const parts: string[] = [];
  const values: number[] = [];
  for (const t of roll.terms) {
    if (t.kind !== "dice" || !DRAWABLE.has(t.faces)) continue;
    if (t.faces === 100) {
      for (const v of t.rolls) {
        const units = v % 10;
        const tens = v - units;
        parts.push("1d100", "1d10");
        values.push(tens === 0 || v === 100 ? 100 : tens, units === 0 ? 10 : units);
      }
      continue;
    }
    parts.push(`${t.rolls.length}d${t.faces}`);
    values.push(...t.rolls);
  }
  if (parts.length === 0 || values.length > MAX_DICE) return null;
  return `${parts.join("+")}@${values.join(",")}`;
}

/** Bronze do guia visual: dados do mestre (e de quem não tem cor). */
const BRONZE = "#c19a62";
const INK = "#141218";

/** Número preto ou branco, o que tiver mais contraste com a cor do dado. */
function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.25 ? INK : "#ffffff";
}

/** Dado na cor do token de quem rolou (E22); sem cor, bronze. */
function themeFor(color = BRONZE) {
  const bg = /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : BRONZE;
  const fg = inkFor(bg);
  // O nome é a chave do cache de cores da biblioteca: uma por cor.
  return { name: `dado-${bg.slice(1)}`, foreground: fg, background: bg, outline: fg === INK ? "#00000055" : "#ffffff55", texture: "none", material: "metal" };
}

interface Box {
  initialize(): Promise<void>;
  roll(notation: string): Promise<unknown>;
  clearDice(): void;
  setDimensions(size: { x: number; y: number }): void;
  updateConfig(config: Record<string, unknown>): Promise<void>;
  renderer: { domElement: HTMLCanvasElement };
}

let currentColor: string | undefined;

/** Troca a cor dos próximos dados (só recarrega o tema se a cor mudou). */
export async function paintBox(box: Box, color?: string) {
  if (color === currentColor) return;
  await box.updateConfig({ theme_customColorset: themeFor(color) });
  currentColor = color;
}

/**
 * A biblioteca só se ajusta quando a janela muda de tamanho; arrastar as colunas muda só o mapa.
 * Antes de rolar, faz o mesmo ajuste que ela faria no resize.
 */
export function fitBox(box: Box, container: HTMLElement) {
  const canvas = box.renderer.domElement;
  const { clientWidth: x, clientHeight: y } = container;
  if (canvas.width !== x || canvas.height !== y) box.setDimensions({ x, y });
}

let loading: Promise<Box> | null = null;

/** Carrega a biblioteca só na primeira rolagem (three.js é pesado para a abertura da página). */
export function diceBox(container: HTMLElement): Promise<Box> {
  if (!container.id) container.id = "dice-box";
  loading ??= import("@3d-dice/dice-box-threejs")
    .then(async ({ default: DiceBox }) => {
      const box = new DiceBox(`#${container.id}`, {
        theme_customColorset: themeFor(),
        shadows: true,
        sounds: false,
        light_intensity: 0.9,
        baseScale: 90,
        strength: 1,
        gravity_multiplier: 400,
      }) as Box;
      await box.initialize();
      return box;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}
