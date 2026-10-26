import type { WeatherId } from "@rpg/shared";

/**
 * Clima sobre o mapa (E26): partículas e névoa desenhadas num canvas por cima do mapa, em pixels
 * da tela (o clima é do ambiente, não anda com o mapa ao arrastar). Tudo gerado por código.
 * Quantidades por área da tela e intensidade; "reduzir" corta partículas e o clarão dos relâmpagos.
 */

type Ctx = CanvasRenderingContext2D;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Fase própria (balanço, piscar). */
  phase: number;
  rot: number;
  vr: number;
  color: string;
}

type Motion = "fall" | "rise" | "drift" | "wander";

interface Kind {
  /** Partículas por megapixel de tela, na intensidade máxima. */
  density: number;
  motion: Motion;
  /** Velocidade principal (px/s) e variação. */
  speed: [number, number];
  size: [number, number];
  colors: string[];
  draw: (ctx: Ctx, p: Particle, t: number) => void;
  /** Véu de cor por cima do mapa (alfa na intensidade máxima). */
  tint?: string;
  tintAlpha?: number;
  /** Nuvens de névoa andando. */
  fog?: { color: string; alpha: number; speed: number };
  /** Brilho aditivo (brasas, vagalumes…). */
  glow?: boolean;
  /** Balanço lateral (neve, folhas): amplitude em px/s. */
  sway?: number;
  lightning?: boolean;
  heat?: boolean;
}

const streak = (width: number) => (ctx: Ctx, p: Particle) => {
  // Risco na direção do movimento, com o comprimento proporcional à velocidade.
  const k = p.size / Math.hypot(p.vx, p.vy);
  ctx.strokeStyle = p.color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
  ctx.stroke();
};

const dot = (ctx: Ctx, p: Particle) => {
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
};

const softDot = (pulse: number) => (ctx: Ctx, p: Particle, t: number) => {
  const a = pulse ? 0.35 + 0.65 * Math.max(0, Math.sin(t * pulse + p.phase)) : 1;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
  g.addColorStop(0, p.color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
  ctx.globalAlpha = 1;
};

const flake = (ctx: Ctx, p: Particle) => {
  // Folha ou pétala: elipse girando (o "achatamento" simula a virada no ar).
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(p.rot * 1.7 + p.phase)));
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const RAIN = "rgba(180,200,230,0.42)";

const KINDS: Record<WeatherId, Kind> = {
  rain: { density: 420, motion: "fall", speed: [900, 250], size: [16, 8], colors: [RAIN], draw: streak(1), tint: "#1c2633", tintAlpha: 0.1 },
  heavyRain: { density: 1000, motion: "fall", speed: [1300, 300], size: [24, 10], colors: [RAIN, "rgba(200,215,240,0.5)"], draw: streak(1.2), tint: "#141c27", tintAlpha: 0.22 },
  storm: {
    density: 1000,
    motion: "fall",
    speed: [1400, 300],
    size: [26, 10],
    colors: [RAIN, "rgba(200,215,240,0.5)"],
    draw: streak(1.2),
    tint: "#0e141d",
    tintAlpha: 0.32,
    lightning: true,
  },
  hail: { density: 380, motion: "fall", speed: [800, 200], size: [1.6, 1.2], colors: ["rgba(235,242,250,0.85)", "rgba(210,225,240,0.75)"], draw: dot, tint: "#1c2633", tintAlpha: 0.15 },
  snow: { density: 380, motion: "fall", speed: [55, 35], size: [1.4, 2.2], colors: ["rgba(255,255,255,0.9)", "rgba(235,240,250,0.75)"], draw: dot, sway: 22, tint: "#dde6f0", tintAlpha: 0.08 },
  blizzard: {
    density: 900,
    motion: "fall",
    speed: [320, 120],
    size: [1.2, 2.2],
    colors: ["rgba(255,255,255,0.9)", "rgba(230,238,248,0.7)"],
    draw: dot,
    sway: 40,
    tint: "#e4ecf4",
    tintAlpha: 0.22,
    fog: { color: "236,242,248", alpha: 0.22, speed: 90 },
  },
  fog: { density: 0, motion: "drift", speed: [0, 0], size: [0, 0], colors: [], draw: dot, tint: "#b9c2c9", tintAlpha: 0.1, fog: { color: "205,212,218", alpha: 0.3, speed: 12 } },
  leaves: {
    density: 70,
    motion: "drift",
    speed: [140, 70],
    size: [5, 3],
    colors: ["#b5651d", "#c98b2b", "#8a3b12", "#a8a03a", "#d1a23a"],
    draw: flake,
    sway: 30,
  },
  sand: {
    density: 700,
    motion: "drift",
    speed: [520, 200],
    size: [10, 8],
    colors: ["rgba(214,180,120,0.45)", "rgba(190,150,95,0.4)"],
    draw: streak(1.4),
    tint: "#b08850",
    tintAlpha: 0.28,
    fog: { color: "196,160,104", alpha: 0.3, speed: 160 },
  },
  ash: { density: 220, motion: "fall", speed: [45, 30], size: [1.2, 1.8], colors: ["rgba(120,118,115,0.85)", "rgba(80,78,76,0.8)", "rgba(170,165,160,0.7)"], draw: flake, sway: 18, tint: "#3a3532", tintAlpha: 0.18 },
  embers: { density: 70, motion: "rise", speed: [60, 50], size: [1.4, 1.6], colors: ["rgba(255,150,50,1)", "rgba(255,110,30,1)", "rgba(255,200,90,1)"], draw: softDot(6), sway: 25, glow: true, tint: "#5a2410", tintAlpha: 0.1 },
  heat: { density: 0, motion: "drift", speed: [0, 0], size: [0, 0], colors: [], draw: dot, tint: "#ff9a3c", tintAlpha: 0.1, heat: true },
  fireflies: { density: 35, motion: "wander", speed: [22, 14], size: [2, 1.2], colors: ["rgba(214,255,120,1)", "rgba(250,240,120,1)"], draw: softDot(2.2), glow: true },
  magic: {
    density: 45,
    motion: "rise",
    speed: [22, 16],
    size: [1.6, 1.6],
    colors: ["rgba(180,120,255,1)", "rgba(110,190,255,1)", "rgba(120,255,220,1)", "rgba(255,150,230,1)"],
    draw: softDot(3.5),
    sway: 14,
    glow: true,
  },
  spores: { density: 70, motion: "wander", speed: [14, 10], size: [1.6, 1.8], colors: ["rgba(200,220,120,0.9)", "rgba(170,200,140,0.8)"], draw: softDot(0), tint: "#4a5a2a", tintAlpha: 0.1 },
  petals: { density: 35, motion: "fall", speed: [50, 30], size: [3.5, 2], colors: ["#f2a7c3", "#f7c6d8", "#e88aae", "#fde2ec"], draw: flake, sway: 35 },
  bloodRain: {
    density: 480,
    motion: "fall",
    speed: [950, 250],
    size: [16, 8],
    colors: ["rgba(150,18,24,0.6)", "rgba(110,10,16,0.6)"],
    draw: streak(1.2),
    tint: "#4a0508",
    tintAlpha: 0.2,
  },
};

const MAX_PARTICLES = 1800;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nuvem macia (vários círculos com degradê), desenhada uma vez por cor e reaproveitada. */
const clouds = new Map<string, HTMLCanvasElement>();
function cloud(color: string): HTMLCanvasElement {
  let c = clouds.get(color);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const r = rng(color.length * 7919);
  for (let i = 0; i < 14; i++) {
    const x = 60 + r() * 136;
    const y = 70 + r() * 116;
    const rad = 40 + r() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${color},0.35)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  clouds.set(color, c);
  return c;
}

/**
 * Relâmpagos com hora marcada (E26): a semente é a hora em que o clima começou, então todos
 * os navegadores calculam os mesmos instantes. Devolve os instantes (segundos desde o início).
 */
export class LightningClock {
  private times: number[] = [];
  private next: () => number;
  constructor(seed: number, intensity: number) {
    const r = rng(seed);
    let t = 3 + r() * 6;
    this.next = () => {
      const now = t;
      // Mais intensidade, relâmpagos mais seguidos (de ~6 a ~22 s entre um e outro).
      t += (6 + r() * 16) / (0.5 + intensity);
      return now;
    };
  }
  /** Instantes entre `from` e `to` (segundos desde o início do clima). */
  between(from: number, to: number): number[] {
    while ((this.times.at(-1) ?? -1) < to) this.times.push(this.next());
    // Só guarda o que ainda pode servir (o clarão dura menos de 1 s).
    while (this.times.length > 1 && this.times[0] < from - 2) this.times.shift();
    return this.times.filter((x) => x > from && x <= to);
  }
  /** Último relâmpago até `now`. */
  last(now: number): number | null {
    this.between(now - 2, now);
    let found: number | null = null;
    for (const x of this.times) if (x <= now) found = x;
    return found;
  }
}

/** Clarão de um relâmpago `dt` segundos depois dele: dois piscões e um apagar suave. */
function flash(dt: number): number {
  if (dt < 0 || dt > 0.9) return 0;
  if (dt < 0.08) return 0.45;
  if (dt < 0.16) return 0.1;
  if (dt < 0.26) return 0.32;
  return 0.32 * (1 - (dt - 0.26) / 0.64);
}

export interface WeatherScene {
  kind: WeatherId;
  intensity: number;
  wind: number;
  reduce: boolean;
}

/** Desenha um clima num canvas; `frame` é chamado a cada quadro com o tempo desde o início do clima. */
export class WeatherPainter {
  private particles: Particle[] = [];
  private fogs: { x: number; y: number; s: number; v: number }[] = [];
  private w = 0;
  private h = 0;
  private r = Math.random;
  private key = "";

  constructor(private scene: WeatherScene) {}

  setScene(scene: WeatherScene) {
    this.scene = scene;
  }

  private get kind(): Kind {
    return KINDS[this.scene.kind];
  }

  /** Vento: deslocamento lateral por unidade de queda. Sem vento, folhas e areia vão para a direita. */
  private windX(): number {
    return Math.tan((this.scene.wind * Math.PI) / 180);
  }

  private spawn(p: Particle, anywhere: boolean) {
    const k = this.kind;
    const { w, h, r } = this;
    const speed = k.speed[0] + (r() - 0.5) * 2 * k.speed[1] * 0.5;
    p.size = k.size[0] + r() * k.size[1];
    p.color = k.colors[Math.floor(r() * k.colors.length)];
    p.phase = r() * Math.PI * 2;
    p.rot = r() * Math.PI * 2;
    p.vr = (r() - 0.5) * 3;
    const wx = this.windX();
    if (k.motion === "fall") {
      p.vy = speed;
      p.vx = speed * wx;
      // Nasce acima da tela, deslocado contra o vento para cobrir a tela toda.
      p.x = anywhere ? r() * w : r() * (w + Math.abs(wx) * h) - (wx > 0 ? wx * h : 0);
      p.y = anywhere ? r() * h : -20 - r() * 40;
    } else if (k.motion === "rise") {
      p.vy = -speed;
      p.vx = speed * wx * 0.6;
      p.x = r() * w;
      p.y = anywhere ? r() * h : h + 10 + r() * 30;
    } else if (k.motion === "drift") {
      const dir = this.scene.wind < 0 ? -1 : 1;
      // Vento mais forte, mais rápido; o ângulo vira um leve sobe/desce.
      p.vx = dir * speed * (0.6 + Math.abs(this.scene.wind) / 60);
      p.vy = speed * 0.15 + Math.abs(speed) * (r() - 0.5) * 0.2;
      p.x = anywhere ? r() * w : dir > 0 ? -20 : w + 20;
      p.y = r() * h;
    } else {
      const a = r() * Math.PI * 2;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.x = r() * w;
      p.y = r() * h;
    }
  }

  private fit(w: number, h: number) {
    const k = this.kind;
    const key = `${this.scene.kind}|${this.scene.intensity}|${this.scene.wind}|${this.scene.reduce}|${w}x${h}`;
    if (key === this.key) return;
    const resized = w !== this.w || h !== this.h;
    this.key = key;
    this.w = w;
    this.h = h;
    const want = Math.min(MAX_PARTICLES, Math.round(((w * h) / 1e6) * k.density * this.scene.intensity * (this.scene.reduce ? 0.35 : 1)));
    if (resized || this.particles.length === 0) this.particles = [];
    // Troca de clima/vento: todas as partículas renascem com as regras novas.
    this.particles.length = Math.min(this.particles.length, want);
    for (const p of this.particles) this.spawn(p, true);
    while (this.particles.length < want) {
      const p = {} as Particle;
      this.spawn(p, true);
      this.particles.push(p);
    }
    const nFog = k.fog ? Math.round(5 + 7 * this.scene.intensity) : 0;
    this.fogs = Array.from({ length: nFog }, () => ({
      x: this.r() * w,
      y: this.r() * h,
      s: (0.6 + this.r() * 0.9) * Math.max(w, h) * 0.5,
      v: 0.5 + this.r(),
    }));
  }

  /** `t` = segundos desde o início do clima; `dt` = segundos desde o último quadro. */
  frame(ctx: Ctx, w: number, h: number, t: number, dt: number, lightningAt: number | null) {
    this.fit(w, h);
    const k = this.kind;
    const { intensity, reduce } = this.scene;
    ctx.clearRect(0, 0, w, h);

    if (k.tint) {
      ctx.globalAlpha = (k.tintAlpha ?? 0.1) * (0.4 + 0.6 * intensity);
      ctx.fillStyle = k.tint;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    if (k.fog) {
      const img = cloud(k.fog.color);
      const dir = this.scene.wind < 0 ? -1 : 1;
      ctx.globalAlpha = k.fog.alpha * (0.35 + 0.65 * intensity);
      for (const f of this.fogs) {
        f.x += dir * k.fog.speed * f.v * dt;
        if (f.x - f.s > w) f.x = -f.s;
        if (f.x + f.s < 0) f.x = w + f.s;
        ctx.drawImage(img, f.x - f.s, f.y - f.s, f.s * 2, f.s * 2);
      }
      ctx.globalAlpha = 1;
    }

    if (k.heat && !reduce) {
      // Miragem: faixas onduladas e translúcidas subindo devagar.
      ctx.strokeStyle = "rgba(255,220,180,0.06)";
      ctx.lineWidth = 6;
      for (let i = 0; i < 14; i++) {
        const y0 = (((i / 14) * h - t * 18) % h + h) % h;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 24) {
          const y = y0 + Math.sin(x / 70 + t * 2 + i) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    if (k.glow) ctx.globalCompositeOperation = "lighter";
    const margin = 60;
    for (const p of this.particles) {
      const sway = k.sway ? Math.sin(t * 1.3 + p.phase) * k.sway : 0;
      if (k.motion === "wander") {
        // Muda de direção aos poucos.
        const a = Math.atan2(p.vy, p.vx) + Math.sin(t * 0.7 + p.phase) * dt;
        const s = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
      }
      p.x += (p.vx + sway) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (k.motion === "wander") {
        if (p.x < -margin) p.x = w + margin;
        else if (p.x > w + margin) p.x = -margin;
        if (p.y < -margin) p.y = h + margin;
        else if (p.y > h + margin) p.y = -margin;
      } else if (p.y > h + margin || p.y < -margin * 2 || p.x < -margin * 3 - w * 0.5 || p.x > w * 1.5 + margin * 3) {
        this.spawn(p, false);
      } else if (k.motion === "drift" && (p.x < -margin || p.x > w + margin)) {
        this.spawn(p, false);
      }
      k.draw(ctx, p, t);
    }
    ctx.globalCompositeOperation = "source-over";

    if (k.lightning && lightningAt !== null) {
      const a = flash(t - lightningAt) * (reduce ? 0.25 : 1);
      if (a > 0) {
        ctx.fillStyle = `rgba(225,232,255,${a})`;
        ctx.fillRect(0, 0, w, h);
      }
    }
  }
}

/** Partículas que brilham sozinhas (brasas, vagalumes…): ficam por cima da luz da cena, sem escurecer à noite. */
export function glows(kind: WeatherId): boolean {
  return KINDS[kind].glow === true;
}

export function hasLightning(kind: WeatherId): boolean {
  return KINDS[kind].lightning === true;
}
