import type { SoundChannel, SoundSource, SoundState, SoundTrack } from "@rpg/shared";
import { AMBIENT, AMBIENT_LEVEL, SFX, SFX_LEVEL, type Voice } from "./synth";

/**
 * Motor de som da mesa (E25), um por navegador. Caminho do som:
 * fonte → transição (fade) → canal (volume do mestre) → geral (volume desta pessoa) → alto-falante.
 * O mestre decide o que toca e o volume de cada canal; cada pessoa só mexe no próprio volume geral.
 */

/** Transição ao trocar ou parar música/ambiente (segundos). */
const FADE = 1.5;

let ctx: AudioContext | null = null;
let master: GainNode;
const channels = {} as Record<SoundChannel | "sfx", GainNode>;
const playing: Record<SoundChannel, { key: string; stop: (fade: number) => void } | null> = { music: null, ambient: null };
/** Pedido mais recente por canal: um arquivo que termina de baixar depois de outra troca é descartado. */
const latest: Record<SoundChannel, string> = { music: "", ambient: "" };
const buffers = new Map<string, Promise<AudioBuffer>>();
let listeners: (() => void)[] = [];

/** Avisa quem mostra o botão "Ativar som" quando o navegador libera (ou bloqueia) o áudio. */
export function onAudioState(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function audio(): AudioContext {
  if (ctx) return ctx;
  // iPhone/iPad: sem isto o Web Audio obedece à chave de silencioso e a mesa fica muda (os dados,
  // que tocam por elemento de áudio, continuam soando). "playback" = mídia, como um player de música.
  // Safari 16.4+; nos outros navegadores a propriedade não existe e nada muda.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  ctx = new AudioContext();
  master = ctx.createGain();
  // Limitador na saída: vários sons juntos (trovão em cima da tempestade) não estouram.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  master.connect(limiter).connect(ctx.destination);
  for (const ch of ["music", "ambient", "sfx"] as const) {
    channels[ch] = ctx.createGain();
    channels[ch].connect(master);
  }
  ctx.onstatechange = () => listeners.forEach((l) => l());
  return ctx;
}

/** O navegador só libera som depois de um clique: true = ainda bloqueado. */
export function audioLocked(): boolean {
  return audio().state !== "running";
}

export function unlockAudio() {
  void audio().resume();
}

function ramp(param: AudioParam, value: number) {
  const c = audio();
  param.cancelScheduledValues(c.currentTime);
  param.setTargetAtTime(value, c.currentTime, 0.1);
}

/** Volume geral desta pessoa (0–1), só neste navegador. */
export function setPlayerVolume(volume: number, muted: boolean) {
  audio();
  ramp(master.gain, muted ? 0 : volume);
}

function sourceKey(s: SoundSource) {
  return s.kind === "file" ? `file:${s.name}` : `gen:${s.id}`;
}

/** Arquivo da pasta de sons, baixado e decodificado uma vez por sessão. */
function loadBuffer(name: string, token: string): Promise<AudioBuffer> {
  let p = buffers.get(name);
  if (!p) {
    p = fetch(`/sons/${encodeURIComponent(name)}?t=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Som "${name}" indisponível.`);
        return r.arrayBuffer();
      })
      .then((data) => audio().decodeAudioData(data));
    // Falhou: tenta de novo da próxima vez.
    p.catch(() => buffers.delete(name));
    buffers.set(name, p);
  }
  return p;
}

/** Liga uma fonte num canal com fade de entrada; devolve como pará-la com fade de saída. */
function withFade(input: AudioNode, dest: AudioNode, stopSource: () => void) {
  const c = audio();
  const fade = c.createGain();
  fade.gain.setValueAtTime(0.0001, c.currentTime);
  fade.gain.exponentialRampToValueAtTime(1, c.currentTime + FADE);
  input.connect(fade).connect(dest);
  return (seconds: number) => {
    fade.gain.cancelScheduledValues(c.currentTime);
    fade.gain.setValueAtTime(Math.max(0.0001, fade.gain.value), c.currentTime);
    fade.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + seconds);
    window.setTimeout(() => {
      stopSource();
      fade.disconnect();
    }, seconds * 1000 + 100);
  };
}

/** Toca (ou troca) o que está em loop num canal. Mesmo som com o mesmo início = nada muda. */
async function playLoop(channel: SoundChannel, track: SoundTrack, token: string) {
  const key = `${sourceKey(track.source)}@${track.startedAt}`;
  if (playing[channel]?.key === key || latest[channel] === key) return;
  latest[channel] = key;
  const c = audio();
  let stop: (fade: number) => void;
  if (track.source.kind === "gen") {
    const id = track.source.id as keyof typeof AMBIENT;
    const voice: Voice = AMBIENT[id](c);
    const level = c.createGain();
    level.gain.value = AMBIENT_LEVEL[id];
    voice.output.connect(level);
    stop = withFade(level, channels[channel], voice.stop);
  } else {
    let buffer: AudioBuffer;
    try {
      buffer = await loadBuffer(track.source.name, token);
    } catch {
      return;
    }
    if (latest[channel] !== key) return;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // Quem entra no meio começa no mesmo ponto da música que os outros.
    const elapsed = Math.max(0, (Date.now() - track.startedAt) / 1000);
    src.start(0, elapsed % buffer.duration);
    stop = withFade(src, channels[channel], () => src.stop());
  }
  playing[channel]?.stop(FADE);
  playing[channel] = { key, stop };
}

function stopLoop(channel: SoundChannel) {
  latest[channel] = "";
  playing[channel]?.stop(FADE);
  playing[channel] = null;
}

/** Deixa o som desta pessoa igual ao estado da mesa (chamado a cada estado novo). */
export function syncSound(sound: SoundState, token: string) {
  audio();
  for (const ch of ["music", "ambient", "sfx"] as const) ramp(channels[ch].gain, sound.volume[ch]);
  for (const ch of ["music", "ambient"] as const) {
    const track = sound[ch];
    if (track) void playLoop(ch, track, token);
    else if (playing[ch] || latest[ch]) stopLoop(ch);
  }
}

/** Efeito de uma vez (trovão, porta…), no canal de efeitos. */
export async function playSfx(source: SoundSource, token: string) {
  const c = audio();
  if (c.state !== "running") return;
  if (source.kind === "gen") {
    const id = source.id as keyof typeof SFX;
    if (!SFX[id]) return;
    const level = c.createGain();
    level.gain.value = SFX_LEVEL[id];
    level.connect(channels.sfx);
    SFX[id](c, level, c.currentTime + 0.02);
    // Solta o nó de nível quando o efeito já acabou (o mais longo, o gongo, dura ~6 s).
    window.setTimeout(() => level.disconnect(), 8000);
    return;
  }
  const buffer = await loadBuffer(source.name, token).catch(() => null);
  if (!buffer) return;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.connect(channels.sfx);
  src.start();
}
