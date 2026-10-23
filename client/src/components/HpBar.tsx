import { hpLevel, hpRatio } from "../format";

export function HpBar({ hp, hpMax, thick = false }: { hp: number; hpMax: number; thick?: boolean }) {
  return (
    <div className={`hpbar ${thick ? "thick" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={hpMax} aria-valuenow={hp}>
      <div className={`hpbar-fill ${hpLevel(hp, hpMax)}`} style={{ width: `${hpRatio(hp, hpMax) * 100}%` }} />
    </div>
  );
}
