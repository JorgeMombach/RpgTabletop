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

/*
 * Trovão, explosão, espada, flecha, magia, raio e moedas são calculados amostra por amostra (ruído com
 * filtros que mudam no tempo, ressonâncias de metal, corda dedilhada, estalos espalhados), como numa
 * gravação: soa bem mais natural que só ligar nós do Web Audio. Cada toque sai um pouco diferente.
 * Contas pesadas (filtro que muda, envelope) andam em blocos de 16 amostras, para gerar em poucos ms.
 */

const TAU = Math.PI * 2;
const BLOCK = 16;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const white = () => Math.random() * 2 - 1;

/** Filtro de estado variável (passa-baixa, passa-banda e passa-alta de uma vez). */
class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private g = 0;
  private k = 1;
  lp = 0;
  bp = 0;
  hp = 0;
  constructor(private sr: number, fc = 1000, q = 0.7) {
    this.set(fc, q);
  }
  /** Muda frequência e Q (chame no máximo uma vez por bloco: a tangente é cara). */
  set(fc: number, q = 0.7) {
    this.g = Math.tan((Math.PI * Math.min(Math.max(fc, 10), this.sr * 0.45)) / this.sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    return this;
  }
  run(x: number) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * (this.ic1 + this.g * v3);
    const v2 = this.ic2 + this.g * v1;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
    return this;
  }
}

/** Ruído marrom (branco integrado com vazamento): ronco grave. */
function brownStep(state: { v: number }) {
  state.v = (state.v + 0.02 * white()) / 1.02;
  return state.v * 3.5;
}

/**
 * Gera o som em dois canais. Os acontecimentos (pancadas, tilintares) são sorteados fora, iguais nos dois
 * canais; o ruído de cada canal é independente, o que abre o som no estéreo. Normaliza o pico em 0,9.
 */
function render(ctx: BaseAudioContext, seconds: number, fill: (d: Float32Array, sr: number) => void): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(2, Math.ceil(seconds * sr), sr);
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    fill(d, sr);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak > 0) {
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] *= 0.9 / peak;
    }
  }
  return buf;
}

/** Toca um som gerado, com um pouco de eco do ambiente (`wet`). */
function playRendered(ctx: BaseAudioContext, out: AudioNode, at: number, buf: AudioBuffer, wet = 0) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(out);
  if (wet > 0) {
    const echo = reverb(ctx);
    src.connect(echo).connect(gain(ctx, wet)).connect(out);
  }
  src.start(at);
}

/** Roda quando o navegador estiver folgado (gerar um som leva dezenas de ms). */
function idle(fn: () => void) {
  // Safari não tem requestIdleCallback.
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 50);
}

/**
 * Um som de cada já pronto: tocar não espera a geração. Depois de usar, o próximo (diferente) é gerado
 * com o navegador ocioso.
 */
const ready = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
function prepared(ctx: BaseAudioContext, key: string, make: () => AudioBuffer): AudioBuffer {
  let cache = ready.get(ctx);
  if (!cache) ready.set(ctx, (cache = new Map()));
  const buf = cache.get(key) ?? make();
  cache.delete(key);
  idle(() => cache.set(key, make()));
  return buf;
}

/** Envelope de ataque e queda exponencial, a partir de `t0`. */
const hit = (t: number, t0: number, attack: number, decay: number) =>
  t < t0 ? 0 : t < t0 + attack ? (t - t0) / attack : Math.exp(-(t - t0 - attack) / decay);

/**
 * Soma em `d` um metal batendo a partir de `t0`: parciais desafinadas (lâmina, moeda), cada uma com a
 * própria queda. Oscilador recursivo (gira um fasor), sem seno nem exponencial por amostra.
 */
function addMetal(d: Float32Array, sr: number, t0: number, f0: number, amp: number, partials: readonly (readonly [number, number, number])[]) {
  const start = Math.floor(t0 * sr);
  for (const [ratio, a, decay] of partials) {
    const w = (TAU * f0 * ratio) / sr;
    if (w >= Math.PI) continue;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const r = Math.exp(-1 / (decay * sr));
    const phase = Math.random() * TAU;
    let c = Math.cos(phase);
    let s = Math.sin(phase);
    let level = amp * a;
    const end = Math.min(d.length, start + Math.ceil(decay * sr * 7));
    const attack = sr * 0.001;
    for (let i = start; i < end; i++) {
      const j = i - start;
      d[i] += s * level * (j < attack ? j / attack : 1);
      const nc = c * cw - s * sw;
      s = s * cw + c * sw;
      c = nc;
      level *= r;
    }
  }
}

/** Soma em `d` um estalo de ruído filtrado (passa-alta) em `t0`. */
function addClick(d: Float32Array, sr: number, t0: number, amp: number, decay: number, fc: number) {
  const f = new Svf(sr, fc);
  const start = Math.floor(t0 * sr);
  const end = Math.min(d.length, start + Math.ceil(decay * sr * 6));
  let level = amp;
  const r = Math.exp(-1 / (decay * sr));
  for (let i = start; i < end; i++) {
    d[i] += f.run(white() * level).hp;
    level *= r;
  }
}

/**
 * Trovão: o estalo que rasga (perto) e o ronco que rola em ondas irregulares e some aos poucos.
 * `distance` 0 = caiu do lado (estalo forte); 1 = longe (só o ronco abafado).
 */
function thunderBuffer(ctx: BaseAudioContext, distance: number): AudioBuffer {
  const seconds = 6 + distance * 1.5;
  const near = 1 - distance;
  const sr = ctx.sampleRate;
  // Ondas do ronco: a principal logo no começo e outras cada vez mais fracas e espaçadas.
  const rolls = [{ t: 0.12 + distance * 0.5, a: 1, w: 0.45 + distance * 0.4 }];
  for (let i = 0, n = 9 + Math.floor(Math.random() * 6); i < n; i++) {
    const t = 0.3 + Math.random() ** 1.4 * (seconds - 1.8);
    rolls.push({ t, a: rand(0.3, 0.9) * Math.exp(-t / 2.4), w: rand(0.15, 0.7) });
  }
  // Envelope calculado uma vez, em blocos (igual nos dois canais).
  const blocks = Math.ceil((seconds * sr) / BLOCK) + 1;
  const env = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    const t = (b * BLOCK) / sr;
    let e = 0.2 * Math.exp(-t / 3);
    for (const r of rolls) e += r.a * Math.exp(-(((t - r.t) / r.w) ** 2));
    env[b] = e * Math.min(1, t / 0.08) * Math.min(1, Math.max(0, seconds - t));
  }
  // Rasgo do raio: estalos rápidos e encavalados no primeiro quarto de segundo.
  const cracks = near > 0.15 ? Array.from({ length: 8 + Math.floor(Math.random() * 8) }, () => ({ t: Math.random() ** 2 * 0.28, a: rand(0.4, 1) * near })) : [];
  return render(ctx, seconds, (d, sr) => {
    const brown = { v: 0 };
    const low = new Svf(sr);
    const mid = new Svf(sr, 380 - 200 * distance, 0.9);
    const tear = new Svf(sr, 1800);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // Ronco: grave que fica mais abafado com o tempo e com a distância.
      if (i % BLOCK === 0) low.set(90 + 260 * near * Math.exp(-t / 1.6), 0.8);
      const e = env[(i / BLOCK) | 0];
      const rumble = low.run(brownStep(brown)).lp;
      const body = mid.run(white()).bp * 0.35 * Math.exp(-t / (1 + distance));
      let crack = 0;
      if (t < 0.4) {
        for (const c of cracks) if (t >= c.t && t < c.t + 0.06) crack += c.a * Math.exp(-(t - c.t) / 0.012) * white();
        crack += near * Math.exp(-t / 0.08) * 0.2 * white();
      }
      d[i] = Math.tanh((rumble * e * 1.6 + body * e + tear.run(crack).hp * 1.4) * 1.5);
    }
  });
}

function explosionBuffer(ctx: BaseAudioContext): AudioBuffer {
  // Destroços caindo: estalos espalhados, mais no começo.
  const debris = Array.from({ length: 30 }, () => ({ t: 0.12 + Math.random() ** 1.8 * 2.2, a: rand(0.1, 0.5) }));
  return render(ctx, 3.8, (d, sr) => {
    const brown = { v: 0 };
    const blast = new Svf(sr);
    const roar = new Svf(sr, 220, 0.9);
    let phase = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // Baque grave que afunda (sente-se mais do que se ouve).
      phase += (TAU * (28 + 40 * Math.exp(-t / 0.18))) / sr;
      const thump = Math.sin(phase) * hit(t, 0, 0.004, 0.35) * 1.3;
      // Onda de choque: ruído aberto que vai fechando rápido.
      if (i % BLOCK === 0) blast.set(140 + 7000 * Math.exp(-t / 0.06) + 900 * Math.exp(-t / 0.5));
      const shock = blast.run(white()).lp * (hit(t, 0, 0.002, 0.45) + 0.35 * hit(t, 0, 0.05, 1.4));
      const rumble = roar.run(brownStep(brown)).lp * hit(t, 0.02, 0.08, 1.2) * 0.9;
      d[i] = thump + shock * 1.4 + rumble;
    }
    for (const p of debris) addClick(d, sr, p.t, p.a, 0.004, 2500);
    for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * 2);
  });
}

/** Lâmina de aço: parciais de barra livre (1; 2,76; 5,40; 8,93), curtas: um "tim" seco, não um sino. */
const BLADE = [
  [1, 0.4, 0.35],
  [2.756, 0.3, 0.22],
  [5.404, 0.18, 0.12],
  [8.933, 0.08, 0.07],
] as const;

/** Golpe de espada: o corte no ar é o principal; a lâmina batendo é curta e contida. */
function swordBuffer(ctx: BaseAudioContext): AudioBuffer {
  const strike = 0.22;
  const f0 = rand(900, 1100);
  return render(ctx, 0.9, (d, sr) => {
    const swish = new Svf(sr);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // Lâmina cortando o ar: sopro rápido que sobe e desce de tom.
      if (t < strike + 0.04) {
        const u = t / (strike + 0.04);
        const arc = Math.sin(Math.PI * u) ** 2;
        if (i % BLOCK === 0) swish.set(400 + 2200 * arc, 1.8);
        d[i] = swish.run(white()).bp * arc;
      }
    }
    // Pancada: estalo seco e o aço tinindo de leve.
    addClick(d, sr, strike, 0.7, 0.006, 2500);
    addMetal(d, sr, strike, f0, 0.35, BLADE);
  });
}

/** Flecha: o "fiu" do voo, passando rápido, e o baque cravando na madeira. Só isso, sem enfeite. */
function arrowBuffer(ctx: BaseAudioContext): AudioBuffer {
  const impact = 0.3;
  return render(ctx, 0.65, (d, sr) => {
    const air = new Svf(sr);
    const wood = new Svf(sr, 450, 5);
    let phase = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      let x = 0;
      // Voo: sopro que chega forte e cai de tom ao passar (efeito Doppler).
      if (t < impact) {
        const u = t / impact;
        if (i % BLOCK === 0) air.set(3500 - 2200 * u, 2);
        x += air.run(white()).bp * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 2 * 1.1;
      }
      // Cravou: baque grave curto e a madeira ressoando.
      if (t >= impact) {
        phase += (TAU * (75 + 90 * Math.exp(-(t - impact) / 0.025))) / sr;
        x += Math.sin(phase) * hit(t, impact, 0.001, 0.05) * 0.9;
        x += wood.run(white()).bp * hit(t, impact, 0.001, 0.06) * 2.2;
      }
      d[i] = x;
    }
    addClick(d, sr, impact, 0.8, 0.002, 3000);
  });
}

function magicBuffer(ctx: BaseAudioContext): AudioBuffer {
  // Faíscas cintilando em notas de uma escala (soa "encantado", não aleatório).
  const scale = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5, 3, 3.333, 4];
  const base = rand(700, 900);
  const sparks = Array.from({ length: 38 }, () => ({ t: 0.08 + Math.random() ** 1.3 * 1.5, f: base * scale[Math.floor(Math.random() * scale.length)], a: rand(0.04, 0.12), dec: rand(0.12, 0.45) }));
  return render(ctx, 2.6, (d, sr) => {
    const swell = new Svf(sr);
    let whomp = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // Energia juntando: sopro que sobe de tom até a liberação.
      const u = Math.min(1, t / 0.75);
      if (i % BLOCK === 0) swell.set(300 + 4200 * u * u, 3);
      let x = swell.run(white()).bp * (t < 0.75 ? u * u : Math.exp(-(t - 0.75) / 0.25)) * 0.7;
      // Pano de fundo: dois tons com vibrato, entrando devagar.
      x += (Math.sin(TAU * base * 0.5 * t + 0.6 * Math.sin(TAU * 5 * t)) + 0.6 * Math.sin(TAU * base * 0.75 * t)) * hit(t, 0.1, 0.5, 0.9) * 0.08;
      // Liberação: "vum" grave quando o feitiço sai.
      if (t >= 0.75) {
        whomp += (TAU * (55 + 90 * Math.exp(-(t - 0.75) / 0.12))) / sr;
        x += Math.sin(whomp) * hit(t, 0.75, 0.01, 0.3) * 0.5;
      }
      d[i] = x;
    }
    for (const s of sparks) addMetal(d, sr, s.t, s.f, s.a, [[1, 1, s.dec]]);
  });
}

function zapBuffer(ctx: BaseAudioContext): AudioBuffer {
  // O arco tremula: nível sorteado a cada poucos milissegundos.
  const steps = Array.from({ length: 120 }, () => rand(0.25, 1));
  const pops = Array.from({ length: 45 }, () => ({ t: Math.random() * 0.85, a: rand(0.3, 1) }));
  return render(ctx, 1.05, (d, sr) => {
    const hp = new Svf(sr, 180);
    let phase = 0;
    let wob = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // Zumbido do arco: dente-de-serra grave com a frequência tremendo, rasgado pela saturação.
      wob = (wob + (Math.random() - 0.5) * 0.02) * 0.999;
      phase += (100 * (1 + wob)) / sr;
      const saw = 2 * (phase % 1) - 1;
      const flicker = steps[Math.min(steps.length - 1, Math.floor(t / 0.009))];
      const fade = t < 0.02 ? t / 0.02 : t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1;
      d[i] = Math.tanh(hp.run(saw * 0.8 + white() * 0.5).hp * flicker * fade * 2.5) * 0.6;
    }
    // Estalo da descarga e as faíscas estalando.
    addClick(d, sr, 0, 2, 0.02, 1500);
    for (const p of pops) addClick(d, sr, p.t, p.a * 0.9, 0.0012, 2500);
  });
}

/** Moeda: disco de metal fino, tilintar agudo com parciais desafinadas. */
const COIN = [
  [1, 1, 0.16],
  [1.52, 0.6, 0.11],
  [2.14, 0.45, 0.08],
  [2.83, 0.3, 0.06],
  [3.6, 0.18, 0.04],
] as const;

function coinsBuffer(ctx: BaseAudioContext): AudioBuffer {
  // Punhado caindo: tilintares encavalados e, no fim, uma moeda quicando cada vez mais rápido.
  const clinks: { t: number; f: number; a: number }[] = [];
  let t = 0;
  for (let i = 0; i < 14; i++) {
    t += -Math.log(1 - Math.random()) * 0.045;
    clinks.push({ t, f: rand(2600, 5200), a: rand(0.3, 1) });
  }
  const last = rand(3000, 4200);
  for (const gap of [0.16, 0.11, 0.075, 0.05, 0.035, 0.025, 0.018]) {
    t += gap;
    clinks.push({ t, f: last * rand(0.99, 1.01), a: 0.35 + gap * 2 });
  }
  return render(ctx, t + 0.5, (d, sr) => {
    for (const c of clinks) {
      addMetal(d, sr, c.t, c.f, c.a * 0.4, COIN);
      addClick(d, sr, c.t, c.a * 0.5, 0.002, 5000);
    }
  });
}

export const SFX: Record<GenSfxId, (ctx: BaseAudioContext, out: AudioNode, at: number, distance?: number) => void> = {
  thunder(ctx, out, at, distance) {
    // Trovão do efeito (perto) sai pronto; os da tempestade (distância sorteada) são gerados na hora.
    const buf = distance === undefined ? prepared(ctx, "thunder", () => thunderBuffer(ctx, 0.15)) : thunderBuffer(ctx, distance);
    playRendered(ctx, out, at, buf, 0.35);
  },
  explosion(ctx, out, at) {
    playRendered(ctx, out, at, prepared(ctx, "explosion", () => explosionBuffer(ctx)), 0.3);
  },
  sword(ctx, out, at) {
    playRendered(ctx, out, at, prepared(ctx, "sword", () => swordBuffer(ctx)), 0.15);
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
    playRendered(ctx, out, at, prepared(ctx, "arrow", () => arrowBuffer(ctx)), 0.12);
  },
  magic(ctx, out, at) {
    playRendered(ctx, out, at, prepared(ctx, "magic", () => magicBuffer(ctx)), 0.6);
  },
  zap(ctx, out, at) {
    playRendered(ctx, out, at, prepared(ctx, "zap", () => zapBuffer(ctx)), 0.1);
  },
  coins(ctx, out, at) {
    playRendered(ctx, out, at, prepared(ctx, "coins", () => coinsBuffer(ctx)), 0.12);
  },
};

/**
 * Nível de cada som, medido (RMS) e acertado para todos soarem parecidos: trocar de som não pede
 * mexer no volume. Os grilos, por exemplo, saem bem mais baixos que o mar sem isso.
 */
export const SFX_LEVEL: Record<GenSfxId, number> = {
  thunder: 0.85,
  explosion: 0.8,
  sword: 1.5,
  bell: 0.8,
  gong: 0.8,
  drum: 0.85,
  arrow: 1.4,
  magic: 1.4,
  zap: 2.1,
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
      // Trovões espaçados, uns perto e outros longe (os de longe, mais baixos e abafados).
      const thunder = every(12, 30, () =>
        idle(() => {
          const distance = Math.random() ** 0.7;
          const level = gain(ctx, 0.9 - distance * 0.45);
          level.connect(out);
          SFX.thunder(ctx, level, ctx.currentTime, distance);
        }),
      );
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
