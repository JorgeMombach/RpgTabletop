import type { EffectPreset } from "@rpg/shared";

/**
 * Texturas dos efeitos no mapa (E19), desenhadas em canvas: nada para baixar, funciona offline.
 * Cada textura é um ladrilho que se repete sem emenda (o que passa da borda é desenhado
 * também do outro lado). Fundo semitransparente: os tokens ficam por cima e continuam visíveis.
 */
export const TILE = 128;

type Ctx = CanvasRenderingContext2D;

/** Aleatório com semente: a textura sai igual em todas as máquinas. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Desenha nas 9 posições (centro + vizinhos) para o ladrilho emendar nas bordas. */
function wrapped(ctx: Ctx, draw: () => void) {
  for (const dx of [-TILE, 0, TILE]) {
    for (const dy of [-TILE, 0, TILE]) {
      ctx.save();
      ctx.translate(dx, dy);
      draw();
      ctx.restore();
    }
  }
}

function base(ctx: Ctx, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE, TILE);
}

const painters: Record<Exclude<EffectPreset, "custom">, (ctx: Ctx, r: () => number) => void> = {
  fire(ctx, r) {
    base(ctx, "rgba(150, 30, 0, 0.45)");
    for (let i = 0; i < 16; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const h = 22 + r() * 30;
      const w = 9 + r() * 10;
      wrapped(ctx, () => {
        const g = ctx.createLinearGradient(x, y, x, y - h);
        g.addColorStop(0, "rgba(255, 220, 90, 0.85)");
        g.addColorStop(0.5, "rgba(255, 120, 20, 0.7)");
        g.addColorStop(1, "rgba(200, 30, 0, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.quadraticCurveTo(x - w * 0.8, y - h * 0.6, x, y - h);
        ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.6, x + w, y);
        ctx.quadraticCurveTo(x, y + w * 0.6, x - w, y);
        ctx.fill();
      });
    }
  },
  water(ctx, r) {
    base(ctx, "rgba(30, 110, 200, 0.45)");
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const len = 18 + r() * 26;
      ctx.strokeStyle = `rgba(190, 230, 255, ${0.35 + r() * 0.35})`;
      ctx.lineWidth = 1.5 + r() * 1.5;
      wrapped(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len / 3, y - 5, x + (2 * len) / 3, y + 5, x + len, y);
        ctx.stroke();
      });
    }
  },
  wet(ctx, r) {
    base(ctx, "rgba(15, 25, 35, 0.3)");
    for (let i = 0; i < 6; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rx = 10 + r() * 18;
      const ry = 6 + r() * 10;
      wrapped(ctx, () => {
        ctx.fillStyle = "rgba(90, 130, 170, 0.45)";
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(220, 235, 250, 0.35)";
        ctx.beginPath();
        ctx.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.3, ry * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },
  electric(ctx, r) {
    base(ctx, "rgba(20, 50, 110, 0.4)");
    ctx.lineJoin = "round";
    for (let i = 0; i < 5; i++) {
      const pts: [number, number][] = [[r() * TILE, r() * TILE]];
      for (let j = 0; j < 5; j++) {
        const [px, py] = pts[pts.length - 1];
        pts.push([px + 6 + r() * 8, py + (r() - 0.5) * 14]);
      }
      wrapped(ctx, () => {
        for (const [style, width] of [["rgba(90, 170, 255, 0.5)", 4], ["rgba(240, 250, 255, 0.95)", 1.2]] as const) {
          ctx.strokeStyle = style;
          ctx.lineWidth = width;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      });
    }
  },
  steam(ctx, r) {
    base(ctx, "rgba(235, 240, 245, 0.18)");
    for (let i = 0; i < 12; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rad = 14 + r() * 20;
      wrapped(ctx, () => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(250, 252, 255, 0.55)");
        g.addColorStop(1, "rgba(250, 252, 255, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      });
    }
  },
  mud(ctx, r) {
    base(ctx, "rgba(80, 52, 28, 0.6)");
    for (let i = 0; i < 14; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rx = 6 + r() * 14;
      const ry = 4 + r() * 8;
      const a = r() * Math.PI;
      wrapped(ctx, () => {
        ctx.fillStyle = "rgba(45, 28, 14, 0.55)";
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(200, 170, 130, 0.22)";
        ctx.beginPath();
        ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.3, ry * 0.18, a, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },
  burnt(ctx, r) {
    base(ctx, "rgba(28, 20, 16, 0.6)");
    for (let i = 0; i < 40; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const s = 1 + r() * 3;
      // Cor sorteada fora do `wrapped`: as 9 cópias saem iguais e o ladrilho emenda.
      const fillStyle = r() < 0.2 ? "rgba(255, 110, 30, 0.7)" : `rgba(${120 + r() * 60}, ${115 + r() * 50}, ${110 + r() * 40}, 0.35)`;
      wrapped(ctx, () => {
        ctx.fillStyle = fillStyle;
        ctx.fillRect(x, y, s, s);
      });
    }
  },
  toxic(ctx, r) {
    base(ctx, "rgba(110, 170, 50, 0.22)");
    for (let i = 0; i < 10; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rad = 18 + r() * 24;
      wrapped(ctx, () => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(170, 230, 90, 0.5)");
        g.addColorStop(1, "rgba(170, 230, 90, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      });
    }
  },
  grease(ctx, r) {
    base(ctx, "rgba(60, 45, 25, 0.55)");
    for (let i = 0; i < 12; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rx = 8 + r() * 16;
      const ry = 5 + r() * 10;
      const a = r() * Math.PI;
      wrapped(ctx, () => {
        ctx.fillStyle = "rgba(20, 14, 8, 0.65)";
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
        ctx.fill();
        // Brilho de óleo.
        ctx.fillStyle = "rgba(255, 245, 220, 0.3)";
        ctx.beginPath();
        ctx.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.25, ry * 0.18, a, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },
  web(ctx) {
    base(ctx, "rgba(230, 230, 230, 0.08)");
    const c = TILE / 2;
    const spokes = 10;
    ctx.strokeStyle = "rgba(245, 245, 245, 0.75)";
    ctx.lineWidth = 1.2;
    wrapped(ctx, () => {
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.cos(a) * TILE * 0.72, c + Math.sin(a) * TILE * 0.72);
        ctx.stroke();
      }
      for (let ring = 1; ring <= 6; ring++) {
        const rr = ring * 10;
        ctx.beginPath();
        for (let i = 0; i <= spokes; i++) {
          const a = (i / spokes) * Math.PI * 2;
          // Fios levemente caídos entre os raios.
          const sag = i % 2 ? 0.9 : 1;
          ctx.lineTo(c + Math.cos(a) * rr * sag, c + Math.sin(a) * rr * sag);
        }
        ctx.stroke();
      }
    });
  },
  plants(ctx, r) {
    base(ctx, "rgba(40, 90, 30, 0.3)");
    for (let i = 0; i < 26; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const a = r() * Math.PI * 2;
      const len = 7 + r() * 8;
      const g = 110 + Math.floor(r() * 90);
      wrapped(ctx, () => {
        ctx.fillStyle = `rgba(${40 + Math.floor(g / 4)}, ${g}, 40, 0.8)`;
        ctx.beginPath();
        ctx.ellipse(x, y, len, len * 0.38, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(20, 60, 15, 0.7)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      });
    }
  },
  roots(ctx, r) {
    base(ctx, "rgba(70, 45, 20, 0.28)");
    ctx.lineCap = "round";
    const branch = (rand: () => number, x: number, y: number, a: number, len: number, w: number, depth: number) => {
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      ctx.lineWidth = w;
      ctx.strokeStyle = "rgba(110, 70, 35, 0.85)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x2, y2);
      ctx.stroke();
      if (depth > 0) {
        branch(rand, x2, y2, a - 0.5 - rand() * 0.4, len * 0.7, w * 0.65, depth - 1);
        branch(rand, x2, y2, a + 0.4 + rand() * 0.4, len * 0.6, w * 0.6, depth - 1);
      }
    };
    for (let i = 0; i < 4; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const a = r() * Math.PI * 2;
      const seed = Math.floor(r() * 1e6);
      // Mesma semente nas 9 cópias: os galhos saem iguais e o ladrilho emenda.
      wrapped(ctx, () => branch(rng(seed), x, y, a, 26, 4, 3));
    }
  },
  fog(ctx, r) {
    base(ctx, "rgba(210, 215, 222, 0.22)");
    for (let i = 0; i < 10; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rad = 20 + r() * 26;
      wrapped(ctx, () => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(240, 242, 245, 0.45)");
        g.addColorStop(1, "rgba(240, 242, 245, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      });
    }
  },
  ice(ctx, r) {
    base(ctx, "rgba(160, 215, 240, 0.42)");
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const pts: [number, number][] = [[r() * TILE, r() * TILE]];
      for (let j = 0; j < 4; j++) {
        const [px, py] = pts[pts.length - 1];
        pts.push([px + (r() - 0.5) * 34, py + (r() - 0.5) * 34]);
      }
      wrapped(ctx, () => {
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      });
    }
  },
  darkness(ctx, r) {
    base(ctx, "rgba(8, 4, 16, 0.8)");
    for (let i = 0; i < 30; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      ctx.fillStyle = `rgba(120, 80, 180, ${0.1 + r() * 0.25})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  },
};

const cache = new Map<string, HTMLCanvasElement>();

/** Ladrilho da textura; `custom` = cor lisa semitransparente. */
export function effectTexture(preset: EffectPreset, color: string): HTMLCanvasElement {
  const key = preset === "custom" ? `custom:${color}` : preset;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext("2d")!;
  if (preset === "custom") {
    ctx.globalAlpha = 0.4;
    base(ctx, color);
  } else {
    painters[preset](ctx, rng(preset.length * 7919 + preset.charCodeAt(0)));
  }
  cache.set(key, canvas);
  return canvas;
}

/** Miniatura para listas e para o seletor de efeito. */
export function effectPreview(preset: EffectPreset, color: string): string {
  return effectTexture(preset, color).toDataURL();
}
