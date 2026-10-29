import { useEffect, useRef, useState } from "react";

/**
 * Pulso de número que mudou (L7): devolve a classe (`num-hurt` ao descer, `num-heal` ao subir) e uma chave que
 * muda a cada mudança, para a animação recomeçar. No primeiro valor, nada.
 */
export function usePulse(value: number): { className: string | undefined; pulseKey: number } {
  const prev = useRef(value);
  const [pulse, setPulse] = useState<{ className?: string; key: number }>({ key: 0 });
  useEffect(() => {
    if (value === prev.current) return;
    const className = value < prev.current ? "num-hurt" : "num-heal";
    prev.current = value;
    setPulse((p) => ({ className, key: p.key + 1 }));
  }, [value]);
  return { className: pulse.className, pulseKey: pulse.key };
}
