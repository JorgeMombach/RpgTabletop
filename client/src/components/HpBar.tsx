import { useEffect, useRef, useState } from "react";
import { hpLevel } from "../format";
import { useApp } from "../store";

/**
 * Barra de vida das listas e do painel (L4), a mesma "pílula forjada leve" do mapa: calha funda, fio de bronze,
 * marcas a cada 25% e losangos nas pontas; o chefe usa a versão de ferro escuro com filete de ouro e vida em
 * carmesim. Dano fantasma: o pedaço perdido fica claro por um instante e desce devagar; a cura dá um brilho.
 * A vida temporária aparece depois da vida, como um escudo listrado (a barra mede vida máx. + temporária).
 */
export function HpBar({ hp, hpMax, tempHp = 0, thick = false, boss = false }: { hp: number; hpMax: number; tempHp?: number; thick?: boolean; boss?: boolean }) {
  const reduceFx = useApp((s) => s.reduceFx);
  const [ghost, setGhost] = useState(hp);
  const [healKey, setHealKey] = useState(0);
  const prev = useRef(hp);

  useEffect(() => {
    const was = prev.current;
    prev.current = hp;
    if (hp >= was || reduceFx) {
      setGhost(hp);
      if (hp > was && !reduceFx) setHealKey((k) => k + 1);
      return;
    }
    // Dano: o fantasma fica onde a vida estava e só depois desce (a transição do CSS faz a descida).
    setGhost((g) => Math.max(g, was));
    const id = window.setTimeout(() => setGhost(hp), 450);
    return () => window.clearTimeout(id);
  }, [hp, reduceFx]);

  const total = hpMax + tempHp;
  const pct = (v: number) => (total > 0 ? Math.max(0, Math.min(100, (v / total) * 100)) : 0);
  const level = boss ? "boss" : hpLevel(hp, hpMax);

  return (
    <div
      className={`hpbar${thick ? " thick" : ""}${boss ? " boss" : ""}${reduceFx ? " still" : ""}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={hpMax}
      aria-valuenow={hp}
      aria-label={`Vida ${hp} de ${hpMax}${tempHp ? ` + ${tempHp}` : ""}`}
    >
      <div className="hpbar-track">
        <div className="hpbar-ghost" style={{ width: `${pct(Math.max(ghost, hp))}%` }} />
        <div className="hpbar-fill" data-level={level} style={{ width: `${pct(hp)}%` }} />
        {/* Brilho da cura: outro elemento a cada cura, para a animação recomeçar. */}
        {healKey > 0 && <div key={healKey} className="hpbar-heal" style={{ width: `${pct(hp)}%` }} />}
        {tempHp > 0 && <div className="hpbar-temp" style={{ left: `${pct(hp)}%`, width: `${pct(tempHp)}%` }} />}
        <div className="hpbar-marks" />
      </div>
    </div>
  );
}
