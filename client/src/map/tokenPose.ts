// Altura e direção do token (Passo 10): só desenho, nada de regra (ADR-06).

/**
 * Sombra no chão de quem voa: para baixo e à direita (a mesma luz das sombras do cenário), mais longe e mais
 * suave quanto mais alto. `r` é o raio do token; `h`, a altura em pés (positiva).
 */
export function drawGroundShadow(ctx: CanvasRenderingContext2D, r: number, h: number) {
  const k = Math.min(1, Math.log2(1 + h / 10) / 3);
  ctx.save();
  ctx.translate(r * 0.45 * (0.6 + k), r * 0.7 * (0.6 + k));
  ctx.fillStyle = `rgb(10 6 14 / ${0.6 - k * 0.2})`;
  ctx.filter = `blur(${(3 + k * 5) * (r / 38)}px)`;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * (0.95 - k * 0.15), r * (0.6 - k * 0.1), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Plaquinha da altura em cima do token: "↑ 30 ft" voando, "↓ 10 ft" escavando (borda mais apagada).
 * `top`: onde termina o token (raio, ou a moldura do chefe); `unit`: tamanho de referência (não cresce com o bicho).
 */
export function drawHeightPill(ctx: CanvasRenderingContext2D, top: number, unit: number, h: number) {
  const text = `${h > 0 ? "↑" : "↓"} ${Math.abs(h)} ft`;
  ctx.save();
  ctx.font = `700 ${unit * 0.36}px "Alegreya Sans", sans-serif`;
  const w = ctx.measureText(text).width + unit * 0.4;
  const ph = unit * 0.5;
  // Acima das medalhas de condição (que começam no alto, à direita).
  const y = -top - ph * 1.25;
  ctx.fillStyle = "rgb(20 18 24 / 0.92)";
  ctx.strokeStyle = h > 0 ? "#d8b47a" : "#8a7a64";
  ctx.lineWidth = unit * 0.04;
  ctx.beginPath();
  ctx.roundRect(-w / 2, y - ph / 2, w, ph, ph / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ece4d4";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, y + unit * 0.02);
  ctx.restore();
}

/** Setinha na borda do token, para onde ele olha (0° = para cima). `edge`: distância do centro até a borda. */
export function drawFacing(ctx: CanvasRenderingContext2D, edge: number, unit: number, deg: number, color: string) {
  ctx.save();
  ctx.rotate((deg * Math.PI) / 180);
  const y = -edge - unit * 0.03;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#141218";
  ctx.lineWidth = unit * 0.05;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, y - unit * 0.32);
  ctx.lineTo(unit * 0.22, y + unit * 0.02);
  ctx.lineTo(-unit * 0.22, y + unit * 0.02);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/** Distância do centro até a borda na direção `deg`: o quadrado do mob tem cantos mais longe que o círculo. */
export function edgeAt(kind: "ally" | "mob" | "npc", r: number, deg: number): number {
  if (kind !== "mob") return kind === "npc" ? r * 1.04 : r;
  const a = (deg * Math.PI) / 180;
  // Cantos arredondados: não vai até a ponta do quadrado.
  return Math.min(r / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))), r * 1.22);
}
