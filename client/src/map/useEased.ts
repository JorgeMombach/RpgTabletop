import { useEffect, useRef, useState } from "react";

/**
 * Um número que vai do valor anterior ao novo em linha reta, em `durationMs` (um quadro por vez). Começa já no
 * valor de agora; com 0 ms, troca na hora.
 */
export function useEased(target: number, durationMs: number): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (durationMs <= 0) {
      current.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      const k = Math.min(1, (now - start) / durationMs);
      current.current = from + (target - from) * k;
      setValue(current.current);
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}
