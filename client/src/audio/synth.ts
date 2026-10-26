import type { GenAmbientId, GenSfxId } from "@rpg/shared";

/**
 * Sons gerados pelo app (E25), com Web Audio: ruído filtrado, osciladores e eco gerado por código.
 * Nada para baixar e nenhuma licença envolvida. Ambientes tocam até `stop()`; efeitos tocam uma vez.
 */

/** Ambiente tocando: `output` vai para o canal; `stop()` desliga tudo (timers e fontes). */
export interface Voice {
  output: AudioNode;
  stop: () => void;
}

/* ---------- peças ---------- */

const noiseCache = new WeakMap<BaseAudioContext, Record<string, AudioBuffer>>();

/** Ruído em loop: branco (chiado), rosa (chuva) ou marrom (grave, rumor). */
function noiseBuffer(ctx: BaseAudioContext, color: "white" | "pink" | "brown"): AudioBuffer {
  const cache = noiseCache.get(ctx) ?? {};
  noiseCache.set(ctx, cache);
  if (cache[color]) return cache[color];
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === "white") d[i] = w * 0.5;
      else if (color === "pink") {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    }
  }
  cache[color] = buf;
  return buf;
}

function noise(ctx: BaseAudioContext, color: "white" | "pink" | "brown"): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, color);
  src.loop = true;
  // Começa num ponto diferente: duas camadas do mesmo ruído não "batem".
  src.start(0, Math.random() * 3);
  return src;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** Liga em série: a → b → c… e devolve o último. */
function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

/** Oscilador lento que mexe num parâmetro (vento que sobe e desce, ondas). */
function lfo(ctx: BaseAudioContext, target: AudioParam, rate: number, depth: number) {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const g = gain(ctx, depth);
  o.connect(g).connect(target);
  o.start();
  return o;
}

const reverbCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Eco de caverna/salão: resposta de ruído que decai, gerada por código. */
function reverb(ctx: BaseAudioContext, seconds = 2.8): ConvolverNode {
  let ir = reverbCache.get(ctx);
  if (!ir) {
    const len = Math.floor(ctx.sampleRate * seconds);
    ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    reverbCache.set(ctx, ir);
  }
  const c = ctx.createConvolver();
  c.buffer = ir;
  return c;
}

/** Envelope: sobe em `attack` s até `peak` e cai até quase zero em `decay` s. */
function envelope(param: AudioParam, at: number, peak: number, attack: number, decay: number) {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak), at + attack);
  param.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

/** Tom curto (sino, moeda, gota): senoide com envelope, opcionalmente deslizando de frequência. */
function tone(ctx: BaseAudioContext, out: AudioNode, at: number, freq: number, peak: number, decay: number, opts: { type?: OscillatorType; to?: number; attack?: number } = {}) {
  const o = ctx.createOscillator();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, at);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, at + decay);
  const g = ctx.createGain();
  envelope(g.gain, at, peak, opts.attack ?? 0.005, decay);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + (opts.attack ?? 0.005) + decay + 0.05);
}

/** Rajada de ruído filtrado (estalo, pancada, sopro). */
function burst(ctx: BaseAudioContext, out: AudioNode, at: number, color: "white" | "pink" | "brown", type: BiquadFilterType, freq: number, peak: number, decay: number, attack = 0.003) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, color);
  const f = filter(ctx, type, freq, 1);
  const g = ctx.createGain();
  envelope(g.gain, at, peak, attack, decay);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 3);
  src.stop(at + attack + decay + 0.05);
  return f;
}

/** Agenda eventos aleatórios (gotas, estalos, trovões) enquanto o ambiente toca. */
function every(min: number, max: number, fire: () => void) {
  let timer = 0;
  let alive = true;
  const next = () => {
    if (!alive) return;
    timer = window.setTimeout(() => {
      fire();
      next();
    }, (min + Math.random() * (max - min)) * 1000);
  };
  next();
  return () => {
    alive = false;
    clearTimeout(timer);
  };
}

/** Monta um ambiente: `build` liga as fontes em `out` e devolve o que desligar no fim. */
function ambient(ctx: BaseAudioContext, build: (out: GainNode) => (AudioScheduledSourceNode | (() => void))[]): Voice {
  const out = gain(ctx, 1);
  const parts = build(out);
  return {
    output: out,
    stop: () => {
      for (const p of parts) {
        if (typeof p === "function") p();
        else
          try {
            p.stop();
          } catch {
            // já parado
          }
      }
    },
  };
}

/* ---------- efeitos de uma vez ---------- */

export const SFX: Record<GenSfxId, (ctx: BaseAudioContext, out: AudioNode, at: number) => void> = {
  thunder(ctx, out, at) {
    // Estalo seco e o ronco que rola e vai sumindo, com "ondas".
    burst(ctx, out, at, "white", "highpass", 1200, 0.6, 0.25);
    const rumble = burst(ctx, out, at + 0.05, "brown", "lowpass", 180, 1.2, 4, 0.08);
    rumble.frequency.setValueAtTime(400, at);
    rumble.frequency.exponentialRampToValueAtTime(90, at + 4);
    for (let i = 0; i < 4; i++) burst(ctx, out, at + 0.4 + i * (0.4 + Math.random() * 0.6), "brown", "lowpass", 250, 0.6, 1.2, 0.05);
  },
  explosion(ctx, out, at) {
    const f = burst(ctx, out, at, "white", "lowpass", 3000, 0.8, 1.8, 0.005);
    f.frequency.setValueAtTime(3000, at);
    f.frequency.exponentialRampToValueAtTime(120, at + 1.6);
    tone(ctx, out, at, 90, 0.65, 1.4, { to: 30 });
    burst(ctx, out, at + 0.1, "brown", "lowpass", 300, 0.5, 2.5, 0.05);
  },
  sword(ctx, out, at) {
    // Parciais desafinadas: soa metálico. Um raspão de ruído antes.
    burst(ctx, out, at, "white", "bandpass", 5000, 0.35, 0.12);
    for (const [f, a] of [[1180, 0.25], [2630, 0.18], [3910, 0.12], [5170, 0.08], [7020, 0.05]] as const) tone(ctx, out, at + 0.01, f, a, 0.9);
  },
  bell(ctx, out, at) {
    const f = 620;
    for (const [m, a, d] of [[0.5, 0.25, 4], [1, 0.35, 3.5], [1.19, 0.18, 2.5], [1.56, 0.15, 2.2], [2, 0.12, 2], [2.74, 0.08, 1.5], [3.76, 0.05, 1.2]] as const) tone(ctx, out, at, f * m, a, d);
  },
  gong(ctx, out, at) {
    const f = 98;
    for (const [m, a, d] of [[1, 0.35, 6], [1.47, 0.22, 5], [2.09, 0.18, 4.5], [2.56, 0.12, 4], [3.31, 0.1, 3.5], [4.13, 0.06, 3]] as const) {
      tone(ctx, out, at, f * m, a, d, { attack: 0.04 });
    }
    burst(ctx, out, at, "pink", "bandpass", 900, 0.2, 2.5, 0.02);
  },
  drum(ctx, out, at) {
    // Três batidas de tambor de guerra: bum, bum, BUM.
    for (const [t, a] of [[0, 0.7], [0.45, 0.7], [0.9, 1]] as const) {
      tone(ctx, out, at + t, 110, a, 0.55, { to: 48 });
      burst(ctx, out, at + t, "brown", "lowpass", 600, a * 0.5, 0.25);
    }
  },
  arrow(ctx, out, at) {
    const f = burst(ctx, out, at, "white", "bandpass", 2500, 0.5, 0.35, 0.05);
    f.frequency.setValueAtTime(3000, at);
    f.frequency.exponentialRampToValueAtTime(600, at + 0.4);
    // Fincou.
    tone(ctx, out, at + 0.42, 180, 0.5, 0.15, { to: 90 });
    burst(ctx, out, at + 0.42, "brown", "lowpass", 900, 0.4, 0.12);
  },
  magic(ctx, out, at) {
    const echo = reverb(ctx);
    const wet = gain(ctx, 0.6);
    echo.connect(wet).connect(out);
    // Arpejo subindo, com brilho.
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
      tone(ctx, out, at + i * 0.07, f, 0.18, 1.2, { type: "triangle" });
      tone(ctx, echo, at + i * 0.07, f * 2, 0.08, 1, { type: "sine" });
    });
    burst(ctx, echo, at, "white", "highpass", 6000, 0.15, 1.5, 0.3);
  },
  zap(ctx, out, at) {
    // Faíscas: dente-de-serra pulando de frequência e estalos de ruído.
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const g = ctx.createGain();
    for (let i = 0; i < 18; i++) o.frequency.setValueAtTime(80 + Math.random() * 900, at + i * 0.03);
    envelope(g.gain, at, 0.25, 0.005, 0.6);
    o.connect(filter(ctx, "highpass", 300)).connect(g).connect(out);
    o.start(at);
    o.stop(at + 0.7);
    for (let i = 0; i < 8; i++) burst(ctx, out, at + Math.random() * 0.5, "white", "highpass", 3000, 0.35, 0.04);
  },
  coins(ctx, out, at) {
    for (let i = 0; i < 7; i++) {
      const t = at + i * (0.04 + Math.random() * 0.09);
      const f = 2800 + Math.random() * 1800;
      tone(ctx, out, t, f, 0.15, 0.25);
      tone(ctx, out, t, f * 1.52, 0.08, 0.18);
    }
  },
};

/**
 * Nível de cada som, medido (RMS) e acertado para todos soarem parecidos: trocar de som não pede
 * mexer no volume. Os grilos, por exemplo, saem bem mais baixos que o mar sem isso.
 */
export const SFX_LEVEL: Record<GenSfxId, number> = {
  thunder: 1,
  explosion: 0.8,
  sword: 1.5,
  bell: 0.8,
  gong: 0.8,
  drum: 0.85,
  arrow: 2,
  magic: 1.4,
  zap: 2.2,
  coins: 1.8,
};

export const AMBIENT_LEVEL: Record<GenAmbientId, number> = {
  rain: 0.7,
  storm: 0.65,
  wind: 1.4,
  campfire: 0.95,
  cave: 1.7,
  sea: 0.6,
  stream: 1.2,
  night: 2.6,
  dungeon: 1,
  heartbeat: 1.2,
};

/* ---------- ambientes ---------- */

export const AMBIENT: Record<GenAmbientId, (ctx: BaseAudioContext) => Voice> = {
  rain: (ctx) =>
    ambient(ctx, (out) => {
      const hiss = noise(ctx, "pink");
      chain(hiss, filter(ctx, "highpass", 500), filter(ctx, "lowpass", 7000), gain(ctx, 0.9), out);
      const body = noise(ctx, "brown");
      chain(body, filter(ctx, "lowpass", 500), gain(ctx, 0.25), out);
      // Pingos maiores de vez em quando.
      const drops = every(0.03, 0.15, () => burst(ctx, out, ctx.currentTime, "white", "bandpass", 2500 + Math.random() * 3000, 0.08 + Math.random() * 0.1, 0.03));
      return [hiss, body, drops];
    }),

  storm: (ctx) =>
    ambient(ctx, (out) => {
      const rain = AMBIENT.rain(ctx);
      rain.output.connect(gain(ctx, 1.1)).connect(out);
      const wind = AMBIENT.wind(ctx);
      wind.output.connect(gain(ctx, 0.6)).connect(out);
      const thunder = every(7, 18, () => {
        // Trovões mais perto ou mais longe.
        const level = gain(ctx, 0.5 + Math.random() * 0.4);
        level.connect(out);
        SFX.thunder(ctx, level, ctx.currentTime);
      });
      return [rain.stop, wind.stop, thunder];
    }),

  wind: (ctx) =>
    ambient(ctx, (out) => {
      const src = noise(ctx, "pink");
      const band = filter(ctx, "bandpass", 500, 1.2);
      const level = gain(ctx, 0.6);
      chain(src, band, level, out);
      // Rajadas: o filtro e o volume sobem e descem em ritmos que não se repetem juntos.
      const a = lfo(ctx, band.frequency, 0.07, 250);
      const b = lfo(ctx, band.frequency, 0.19, 120);
      const c = lfo(ctx, level.gain, 0.11, 0.35);
      return [src, a, b, c];
    }),

  campfire: (ctx) =>
    ambient(ctx, (out) => {
      const roar = noise(ctx, "brown");
      chain(roar, filter(ctx, "lowpass", 350), gain(ctx, 0.5), out);
      const crackle = every(0.04, 0.35, () => {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) burst(ctx, out, ctx.currentTime + i * 0.02, "white", "highpass", 1500 + Math.random() * 3000, 0.1 + Math.random() * 0.3, 0.015 + Math.random() * 0.03);
      });
      return [roar, crackle];
    }),

  cave: (ctx) =>
    ambient(ctx, (out) => {
      const echo = reverb(ctx, 3.5);
      echo.connect(gain(ctx, 0.9)).connect(out);
      const air = noise(ctx, "brown");
      chain(air, filter(ctx, "lowpass", 180), gain(ctx, 0.25), out);
      // Gotas: tom curto que cai de frequência, com eco.
      const drips = every(0.6, 2.8, () => {
        const f = 900 + Math.random() * 900;
        tone(ctx, echo, ctx.currentTime, f, 0.25, 0.09, { to: f * 0.55 });
      });
      return [air, drips];
    }),

  sea: (ctx) =>
    ambient(ctx, (out) => {
      const surf = noise(ctx, "brown");
      const low = filter(ctx, "lowpass", 600);
      const level = gain(ctx, 0.5);
      chain(surf, low, level, out);
      const foam = noise(ctx, "pink");
      const foamLevel = gain(ctx, 0.15);
      chain(foam, filter(ctx, "highpass", 1500), foamLevel, out);
      // Ondas: sobem e quebram num ciclo de ~8 s.
      const a = lfo(ctx, level.gain, 0.12, 0.4);
      const b = lfo(ctx, low.frequency, 0.12, 400);
      const c = lfo(ctx, foamLevel.gain, 0.12, 0.12);
      return [surf, foam, a, b, c];
    }),

  stream: (ctx) =>
    ambient(ctx, (out) => {
      const water = noise(ctx, "pink");
      const band = filter(ctx, "bandpass", 1800, 0.8);
      chain(water, band, gain(ctx, 0.9), out);
      const a = lfo(ctx, band.frequency, 3.1, 500);
      const b = lfo(ctx, band.frequency, 5.3, 300);
      // Borbulhas rápidas.
      const bubbles = every(0.05, 0.25, () => {
        const f = 600 + Math.random() * 900;
        tone(ctx, out, ctx.currentTime, f, 0.05, 0.05, { to: f * 1.8 });
      });
      return [water, a, b, bubbles];
    }),

  night: (ctx) =>
    ambient(ctx, (out) => {
      const breeze = noise(ctx, "pink");
      chain(breeze, filter(ctx, "lowpass", 900), gain(ctx, 0.12), out);
      // Grilos: chilreios curtos em sequência, cada um no seu ritmo e tom.
      const crickets = [0, 1, 2].map((k) =>
        every(0.8 + k * 0.4, 2.2 + k * 0.6, () => {
          const f = 4200 + k * 400 + Math.random() * 200;
          const at = ctx.currentTime;
          for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) tone(ctx, out, at + i * 0.055, f, 0.035, 0.035, { type: "square" });
        }),
      );
      return [breeze, ...crickets];
    }),

  dungeon: (ctx) =>
    ambient(ctx, (out) => {
      const echo = reverb(ctx, 4);
      echo.connect(gain(ctx, 0.7)).connect(out);
      // Zumbido grave e opressivo: dois tons quase iguais "batendo".
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = b.type = "sawtooth";
      a.frequency.value = 55;
      b.frequency.value = 55.6;
      const low = filter(ctx, "lowpass", 220);
      const level = gain(ctx, 0.12);
      a.connect(low);
      b.connect(low);
      chain(low, level, out);
      a.start();
      b.start();
      const sweep = lfo(ctx, low.frequency, 0.05, 90);
      const air = noise(ctx, "brown");
      chain(air, filter(ctx, "lowpass", 150), gain(ctx, 0.2), out);
      const drips = every(2, 6, () => tone(ctx, echo, ctx.currentTime, 700 + Math.random() * 500, 0.15, 0.1, { to: 400 }));
      return [a, b, sweep, air, drips];
    }),

  heartbeat: (ctx) =>
    ambient(ctx, (out) => {
      const beat = () => {
        const at = ctx.currentTime;
        tone(ctx, out, at, 70, 0.9, 0.18, { to: 45 });
        tone(ctx, out, at + 0.22, 60, 0.6, 0.2, { to: 40 });
      };
      beat();
      // ~75 batidas por minuto.
      const timer = window.setInterval(beat, 800);
      return [() => clearInterval(timer)];
    }),
};
