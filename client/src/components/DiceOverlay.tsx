import { Paper, Stack, Text } from "@mantine/core";
import type { LogEntry } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { diceBox, fitBox, notationFor, paintBox, setDiceVolume } from "../dice3d";
import { rollerName } from "../format";
import { useApp, useVolume } from "../store";
import { naturalD20 } from "./RollLog";
import { useT } from "../i18n";

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
  const r = e.roll!;
  const nat = naturalD20(r.terms);
  const color = nat === 20 ? "copper.4" : nat === 1 ? "red.4" : "bronze.4";
  const note = e.kind === "attack" && nat === 20 ? t("log.crit") : nat === 20 ? t("log.nat20") : nat === 1 ? t("log.nat1") : null;

  return (
    <div className="dice-overlay-result">
      <Paper className="plaque" withBorder px="lg" py="sm" shadow="xl" role="status">
        <Stack gap={0} align="center">
          <Text size="sm" fw={600} truncate maw={360} title={rollerName(e)}>
            {rollerName(e)}
            {e.label && (
              <Text span size="sm" c="dimmed" fw={400}>
                {" · "}
                {e.label}
              </Text>
            )}
          </Text>
          <Text ff="heading" fz={40} fw={700} lh={1.1} c={color}>
            {r.total}
          </Text>
          <Text size="xs" c="dimmed">
            {r.expr}
            {r.mode !== "normal" && ` · ${r.mode === "adv" ? t("log.adv") : t("log.dis")}`}
            {e.hidden && ` · ${t("log.hidden")}`}
          </Text>
          {note && (
            <Text size="sm" fw={700} c={color}>
              {note}
            </Text>
          )}
        </Stack>
      </Paper>
    </div>
  );
}
