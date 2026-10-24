/** Emblema do app: um d20 em bronze em vetor (tela de entrada). */
export function D20Emblem({ size = 112 }: { size?: number }) {
  // Hexágono externo e triângulo central da vista frontal de um icosaedro.
  const top = [100, 10];
  const ur = [178, 55];
  const lr = [178, 145];
  const bottom = [100, 190];
  const ll = [22, 145];
  const ul = [22, 55];
  const t1 = [100, 62];
  const t2 = [146, 140];
  const t3 = [54, 140];
  const p = (...pts: number[][]) => pts.map((q) => q.join(",")).join(" ");
  const line = (a: number[], b: number[]) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Dado de 20 lados">
      <defs>
        <linearGradient id="d20-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8d4ab" />
          <stop offset="0.55" stopColor="#b9905a" />
          <stop offset="1" stopColor="#6e5331" />
        </linearGradient>
        <radialGradient id="d20-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#a9844f" stopOpacity="0.35" />
          <stop offset="1" stopColor="#a9844f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#d20-glow)" />
      <polygon points={p(top, ur, lr, bottom, ll, ul)} fill="url(#d20-face)" stroke="#523d24" strokeWidth="3" strokeLinejoin="round" />
      {/* Triângulo central um pouco mais claro: a face voltada para quem olha. */}
      <polygon points={p(t1, t2, t3)} fill="#f3e5c4" fillOpacity="0.35" />
      <g stroke="#523d24" strokeWidth="2.5" strokeLinecap="round">
        {line(top, t1)}
        {line(t1, ul)}
        {line(t1, ur)}
        {line(ul, t3)}
        {line(ur, t2)}
        {line(ll, t3)}
        {line(lr, t2)}
        {line(bottom, t3)}
        {line(bottom, t2)}
        {line(t1, t2)}
        {line(t2, t3)}
        {line(t3, t1)}
      </g>
      <text
        x="100"
        y="122"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontWeight="700"
        fontSize="34"
        fill="#3b2a0d"
      >
        20
      </text>
    </svg>
  );
}
