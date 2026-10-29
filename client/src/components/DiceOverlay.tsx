import { Paper, Stack, Text } from "@mantine/core";
import type { LogEntry } from "@rpg/shared";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { diceBox, fitBox, notationFor, paintBox, setDiceVolume } from "../dice3d";
import { rollerName } from "../format";
import { useApp, useVolume } from "../store";
import { naturalD20, natTone } from "./RollLog";
import { useT, logLabel } from "../i18n";

/** Tempo do resultado na tela depois que os dados param. */
const SHOW_MS = 2500;
/** Primeira carga dos dados 3D (biblioteca e sons): passou disso, rola sem animação desta vez. */
const LOAD_TIMEOUT_MS = 8000;
/** Se a física travar (aba em segundo plano…), segue a fila assim mesmo. */
const ROLL_TIMEOUT_MS = 6000;
/** Fila longa (várias pessoas rolando juntas): as mais antigas pulam a animação (continuam no log). */
const MAX_QUEUE = 3;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** O log revela estas rolagens (E26): os dados pararam, ou a animação foi pulada. */
function reveal(ids: string[]) {
  if (ids.length === 0) return;
  useApp.setState((s) => ({ rolling: s.rolling.filter((id) => !ids.includes(id)) }));
}

/**
 * Rolagem no centro do mapa (E22): cada rolagem nova que chega no log (as que esta pessoa pode ver)
 * rola em 3D e termina no valor que o servidor sorteou, com o resultado por cima. Desligável no painel Dados.
 */
export function DiceOverlay() {
  const log = useApp((s) => s.state?.log);
  const enabled = useApp((s) => s.diceAnim);
  const boxRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<LogEntry[]>([]);
  const running = useRef(false);
  const [shown, setShown] = useState<LogEntry | null>(null);

  useEffect(() => {
    if (!log) return;
    // Na primeira vez (entrar, reconectar) o histórico não anima: só o que chegar depois.
    if (!seen.current) {
      seen.current = new Set(log.map((e) => e.id));
      return;
    }
    const fresh = log.filter((e) => !seen.current!.has(e.id));
    for (const e of fresh) seen.current.add(e.id);
    // Desligada, ou aba em segundo plano (o navegador pausa a animação): só o log.
    if (!enabled || document.hidden) {
      reveal(queue.current.map((e) => e.id));
      queue.current = [];
      return;
    }
    const rolls = fresh.filter((e) => e.roll);
    if (rolls.length === 0) return;
    queue.current.push(...rolls);
    useApp.setState((s) => ({ rolling: [...s.rolling, ...rolls.map((e) => e.id)] }));
    if (queue.current.length > MAX_QUEUE) reveal(queue.current.splice(0, queue.current.length - MAX_QUEUE).map((e) => e.id));
    void run();
  }, [log]);

  // Desligou a animação: o que estava na fila aparece no log na hora.
  useEffect(() => {
    if (enabled) return;
    reveal(queue.current.map((e) => e.id));
    queue.current = [];
  }, [enabled]);

  // Carrega os dados 3D logo depois de abrir a mesa, para a primeira rolagem não esperar o download.
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => boxRef.current && void diceBox(boxRef.current).catch(() => undefined), 2000);
    return () => clearTimeout(t);
  }, [enabled]);

  async function run() {
    if (running.current) return;
    running.current = true;
    try {
      let next: LogEntry | undefined;
      while ((next = queue.current.shift())) {
        const notation = notationFor(next.roll!);
        // Caixa que não termina de carregar (um som que não chega…): segue sem animação, não trava a fila.
        const box = notation && boxRef.current ? await Promise.race([diceBox(boxRef.current).catch(() => null), wait(LOAD_TIMEOUT_MS).then(() => null)]) : null;
        if (box && notation && boxRef.current) {
          fitBox(box, boxRef.current);
          // Cor de quem rolou; se falhar, rola com a cor anterior.
          await Promise.race([paintBox(box, next.color).catch(() => undefined), wait(2000)]);
          // Barulho dos dados no volume de efeitos da mesa e no volume geral desta pessoa (mudo = sem barulho).
          const { volume, muted } = useVolume.getState();
          setDiceVolume(box, muted ? 0 : volume * (useApp.getState().state?.sound.volume.sfx ?? 0.8));
          await Promise.race([box.roll(notation), wait(ROLL_TIMEOUT_MS)]);
        }
        setShown(next);
        reveal([next.id]);
        await wait(SHOW_MS);
        setShown(null);
        box?.clearDice();
      }
    } finally {
      running.current = false;
    }
  }

  return (
    <div className="dice-overlay" aria-hidden={!shown}>
      <div ref={boxRef} className="dice-overlay-box" />
      {shown && <ResultBanner e={shown} />}
    </div>
  );
}

function ResultBanner({ e }: { e: LogEntry }) {
  const t = useT();
  const reduceFx = useApp((s) => s.reduceFx);
  const r = e.roll!;
  const nat = naturalD20(r.terms);
  const tone = natTone(nat);
  const note = e.kind === "attack" && nat === 20 ? t("log.crit") : nat === 20 ? t("log.nat20") : nat === 1 ? t("log.nat1") : null;

  return (
    <div className="dice-overlay-result">
      <Paper className={`plaque${tone ? ` roll-${tone}` : ""}${reduceFx ? "" : " fx"}`} withBorder px="lg" py="sm" shadow="xl" role="status">
        <Stack gap={0} align="center">
          <Text size="sm" fw={600} truncate maw={360} title={rollerName(e)}>
            {rollerName(e)}
            {e.label && (
              <Text span size="sm" c="dimmed" fw={400}>
                {" · "}
                {logLabel(e)}
              </Text>
            )}
          </Text>
          <Text ff="heading" fz={40} fw={700} lh={1.1} c={tone ? undefined : "bronze.4"} className="roll-total">
            {r.total}
          </Text>
          <Text size="xs" c="dimmed">
            {r.expr}
            {r.mode !== "normal" && ` · ${r.mode === "adv" ? t("log.adv") : t("log.dis")}`}
            {e.hidden && ` · ${t("log.hidden")}`}
          </Text>
          {note && (
            <Text size="sm" fw={700} ff="heading" className="roll-note">
              {note}
            </Text>
          )}
        </Stack>
        {tone === "fumble" && <Crack />}
        {tone === "fumble" && !reduceFx && <Chips />}
      </Paper>
      {tone === "crit" && !reduceFx && <Sparks />}
    </div>
  );
}

/** Faíscas douradas que saem do número no crítico (pontos e riscos), sorteadas uma vez por resultado. */
function Sparks() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 90;
        return {
          streak: i % 3 === 0,
          style: {
            "--dx": `${Math.cos(a) * dist}px`,
            "--dy": `${Math.sin(a) * dist * 0.7}px`,
            "--s": `${3 + Math.random() * 5}px`,
            "--d": `${650 + Math.random() * 550}ms`,
            "--w": `${Math.random() * 120}ms`,
            "--r": `${(a * 180) / Math.PI - 90}deg`,
          } as CSSProperties,
        };
      }),
    [],
  );
  return (
    <div className="roll-sparks">
      {sparks.map((s, i) => (
        <span key={i} className={`roll-spark${s.streak ? " streak" : ""}`} style={s.style} />
      ))}
    </div>
  );
}

/** Lascas que caem da placa na falha. */
function Chips() {
  const chips = useMemo(
    () =>
      Array.from({ length: 7 }, () => ({
        left: `${55 + Math.random() * 20}%`,
        top: `${30 + Math.random() * 40}%`,
        "--dx": `${(Math.random() - 0.5) * 40}px`,
        "--r": `${(Math.random() - 0.5) * 400}deg`,
        "--w": `${0.1 + Math.random() * 0.2}s`,
      }) as CSSProperties),
    [],
  );
  return (
    <>
      {chips.map((style, i) => (
        <span key={i} className="roll-chip" style={style} />
      ))}
    </>
  );
}

/** Fenda irregular: a linha `pts` vira um polígono que engrossa no meio (de `w0` a `w1`). */
function fissure(pts: [number, number][], w0: number, w1: number): string {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)];
    const [nx, ny] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const dx = (nx - px) / len;
    const dy = (ny - py) / len;
    const w = (w0 + (w1 - w0) * Math.sin((Math.PI * i) / (pts.length - 1))) * (0.7 + (0.6 * ((i * 37) % 10)) / 10);
    left.push([x - dy * w, y + dx * w]);
    right.push([x + dy * w, y - dx * w]);
  });
  return `M${[...left, ...right.reverse()].map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L")} Z`;
}

/** Rachadura da falha: de cima a baixo, ao lado do número, com dois galhos. */
const CRACK = [
  fissure([[124, 0], [119, 12], [127, 22], [116, 36], [123, 48], [110, 62], [117, 74], [104, 90], [109, 102], [101, 112]], 0.6, 2.4),
  fissure([[116, 36], [104, 42], [97, 53], [90, 57]], 1, 0.3),
  fissure([[123, 48], [137, 55], [142, 66], [151, 71]], 1, 0.3),
];

function Crack() {
  return (
    <svg className="roll-crack" viewBox="0 0 200 112" preserveAspectRatio="none" aria-hidden>
      <g className="lip">
        {CRACK.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="gap">
        {CRACK.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
