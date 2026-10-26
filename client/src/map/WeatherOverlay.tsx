import type { WeatherState } from "@rpg/shared";
import { useEffect, useRef } from "react";
import { playSfx } from "../audio/engine";
import { useApp } from "../store";
import { glows, hasLightning, LightningClock, WeatherPainter } from "./weatherFx";

/** Luz da cena: cor multiplicada sobre o mapa e vinheta nas bordas. */
const LIGHT_STYLE = {
  day: null,
  dusk: { color: "rgb(255 196 150)", vignette: 0.25 },
  night: { color: "rgb(70 82 125)", vignette: 0.65 },
  moon: { color: "rgb(150 170 215)", vignette: 0.45 },
} as const;

/** Trovão chega um pouco depois do clarão (de 0,4 a 2 s), o mesmo atraso para todos. */
function thunderDelay(at: number): number {
  const x = Math.sin(at * 12.9898) * 43758.5453;
  return 0.4 + (x - Math.floor(x)) * 1.6;
}

/**
 * Clima e luz por cima do mapa (E26), iguais para todos; só o mestre muda. Não recebe cliques.
 * Os relâmpagos da tempestade clareiam a tela no mesmo instante para todos e trazem o trovão (E25).
 */
export function WeatherOverlay({ weather }: { weather: WeatherState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useApp((s) => s.reduceFx);
  const light = LIGHT_STYLE[weather.light];
  const { kind, intensity, wind, startedAt } = weather;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!kind || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    const painter = new WeatherPainter({ kind, intensity, wind, reduce });
    const clock = hasLightning(kind) ? new LightningClock(startedAt, intensity) : null;
    const timers: number[] = [];
    let raf = 0;
    let last = performance.now();
    let prevT = (Date.now() - startedAt) / 1000;
    // Reduzido: metade dos quadros (PC fraco, celular).
    const minFrame = reduce ? 1000 / 30 : 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < minFrame) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = (Date.now() - startedAt) / 1000;
      if (clock) {
        for (const at of clock.between(prevT, t)) {
          timers.push(window.setTimeout(() => void playSfx({ kind: "gen", id: "thunder" }, ""), thunderDelay(at) * 1000));
        }
      }
      prevT = t;
      painter.frame(ctx, w, h, t, dt, clock ? clock.last(t) : null);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [kind, intensity, wind, startedAt, reduce]);

  const lightLayer = light && (
    <div
      className="map-light"
      style={{
        backgroundColor: light.color,
        boxShadow: `inset 0 0 18vmax rgb(0 0 0 / ${light.vignette})`,
      }}
    />
  );
  // A luz escurece chuva, névoa e neve junto com o mapa; o que brilha sozinho fica por cima dela.
  const glowing = !!kind && glows(kind);
  return (
    <>
      {kind && !glowing && <canvas ref={canvasRef} className="map-weather" />}
      {lightLayer}
      {glowing && <canvas ref={canvasRef} className="map-weather" />}
    </>
  );
}
