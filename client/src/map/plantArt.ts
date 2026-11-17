import { GREEN, PINE, type PlantTargets, type R } from "./propArt";
import { rng } from "./wallKit";

/**
 * Plantas que vieram com o vento (docs/design/vento.md): pinheiro, palmeira e grama alta, vistos de cima, em volta
 * de (0, 0), `c` = lado da casa já com o tamanho. Pintam nas camadas do vento (`PlantTargets`): parada, tudo no mesmo
 * canvas; com vento, o que balança mais vai na copa de cima. Desenho do teste aprovado (`docs/design/vento-teste.html`).
 */

/** Tinta do contorno da palmeira (a do teste aprovado). */
const INK = "#16261a";
const SHADOW = "rgba(18,8,22,.42)";

type Point = [number, number];

function fillPoints(ctx: CanvasRenderingContext2D, points: Point[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

/** Contorno irregular de um andar do pinheiro: o raio ondula com o ângulo (sem pontas regulares de estrela). */
function pineOutline(r: R, radius: number, wobble: number): Point[] {
  const points: Point[] = [];
  const count = 64;
  const phaseA = r() * 6;
  const phaseB = r() * 6;
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2;
    const wave = Math.sin(angle * 3 + phaseA) * 0.07 + Math.sin(angle * 7 + phaseB) * 0.05;
    const reach = radius * (1 + wave + (r() - 0.5) * wobble);
    points.push([Math.cos(angle) * reach, Math.sin(angle) * reach]);
  }
  return points;
}

/**
 * Pinheiro: quatro andares de agulhas soltas em volta do tronco, cada um menor, mais claro e puxado para a luz, com
 * sombra sobre o de baixo. Os dois de baixo na copa de baixo, os dois de cima na de cima (balançam mais).
 */
export function pine(targets: PlantTargets, c: number, seed: number) {
  const r = rng(seed);
  const radius = c * (0.8 + r() * 0.2);
  const base = pineOutline(r, radius, 0.22);
  const shadow = targets.shadow;
  shadow.save();
  shadow.translate(radius * 0.3, radius * 0.38);
  fillPoints(shadow, base, SHADOW);
  shadow.restore();
  const tiers = 4;
  for (let tier = 0; tier < tiers; tier++) {
    const k = tier / (tiers - 1);
    const ctx = tier < 2 ? targets.low : targets.high;
    const tierRadius = radius * (1 - k * 0.68);
    const centerX = -k * radius * 0.08;
    const centerY = -k * radius * 0.1;
    ctx.save();
    ctx.translate(centerX, centerY);
    const shape = tier === 0 ? base : pineOutline(r, tierRadius, 0.4);
    // Sombra do andar sobre o de baixo (separa os andares).
    if (tier > 0) {
      ctx.save();
      ctx.translate(tierRadius * 0.07, tierRadius * 0.09);
      fillPoints(ctx, shape, "rgba(8,18,10,.45)");
      ctx.restore();
    }
    fillPoints(ctx, shape, PINE[0]);
    // Agulhas: riscos curtos apontando para fora, mais compridos na borda, do escuro para o claro.
    const needles: [number, number, number, number][] = [];
    const count = Math.round(260 * (tierRadius / radius) ** 2) + 30;
    for (let index = 0; index < count; index++) {
      const angle = r() * Math.PI * 2;
      const distance = Math.sqrt(r()) * tierRadius * 1.02;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const light = 0.55 - ((x + y) / tierRadius) * 0.35 + k * 0.25 + (r() - 0.5) * 0.3;
      needles.push([x, y, angle + (r() - 0.5) * 0.7, Math.max(0, Math.min(3, Math.floor(light * 4)))]);
    }
    needles.sort((first, second) => first[3] - second[3]);
    ctx.lineCap = "round";
    for (const [x, y, angle, tone] of needles) {
      const length = c * (0.08 + r() * 0.06) * (0.7 + (Math.hypot(x, y) / tierRadius) * 0.9);
      ctx.strokeStyle = PINE[tone];
      ctx.lineWidth = Math.max(1, c * (0.035 + r() * 0.02));
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * length * 0.5, y - Math.sin(angle) * length * 0.5);
      ctx.lineTo(x + Math.cos(angle) * length * 0.5, y + Math.sin(angle) * length * 0.5);
      ctx.stroke();
      const glints = targets.glints;
      if (glints && tier >= 2 && tone >= 2 && glints.random() < 0.05) {
        glints.list.push({ x: x + centerX, y: y + centerY, width: length * 0.5, height: c * 0.025, turn: angle, phase: glints.random() * Math.PI * 2, speed: 2 + glints.random() * 2 });
      }
    }
    ctx.restore();
  }
  // Ponta: um tufinho mais claro no meio.
  targets.high.fillStyle = PINE[3];
  targets.high.beginPath();
  targets.high.arc(-radius * 0.1, -radius * 0.12, c * 0.05, 0, Math.PI * 2);
  targets.high.fill();
}

/** Folha da palmeira (deitada no eixo x a partir do centro): recortada em serra dos dois lados. */
function palmLeaf(length: number): Path2D {
  const width = length * 0.2;
  const path = new Path2D();
  path.moveTo(0, 0);
  const teeth = 7;
  for (let tooth = 1; tooth <= teeth; tooth++) {
    const t = tooth / teeth;
    const half = Math.sin(t * Math.PI) * width;
    path.lineTo(t * length - length * 0.04, -half * 1.15);
    path.lineTo(t * length, -half * 0.55);
  }
  for (let tooth = teeth; tooth >= 1; tooth--) {
    const t = tooth / teeth;
    const half = Math.sin(t * Math.PI) * width;
    path.lineTo(t * length, half * 0.55);
    path.lineTo(t * length - length * 0.04, half * 1.15);
  }
  path.closePath();
  return path;
}

/**
 * Palmeira: duas rodas de folhas compridas recortadas, com contorno escuro e nervura, e o tronco no meio. A sombra é
 * a mesma silhueta, escura e borrada, no chão; as folhas balançam inteiras na copa de cima.
 */
export function palm(targets: PlantTargets, c: number, seed: number) {
  const r = rng(seed);
  const size = c * (0.85 + r() * 0.2);
  const ink = Math.max(1, c * 0.026);
  const count = 7 + Math.floor(r() * 3);
  const tones = ["#2c5a2c", "#3f7a36", "#5b9a42", "#86bd5a"];
  const leaves: { angle: number; length: number; layer: number }[] = [];
  for (let layer = 0; layer < 2; layer++) {
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + layer * (Math.PI / count) + r() * 0.2;
      leaves.push({ angle, length: size * (layer === 0 ? 1 : 0.72) * (0.85 + r() * 0.2), layer });
    }
  }
  const shadow = targets.shadow;
  shadow.save();
  shadow.filter = `blur(${Math.max(1, c * 0.05)}px)`;
  shadow.fillStyle = "rgba(18,8,22,.35)";
  shadow.translate(c * 0.25, c * 0.32);
  for (const leaf of leaves) {
    shadow.save();
    shadow.rotate(leaf.angle);
    shadow.fill(palmLeaf(leaf.length));
    shadow.restore();
  }
  shadow.restore();
  const ctx = targets.high;
  ctx.lineJoin = "round";
  for (const { angle, length, layer } of leaves) {
    ctx.save();
    ctx.rotate(angle);
    const light = -Math.cos(angle) - Math.sin(angle);
    ctx.fillStyle = tones[Math.max(0, Math.min(3, Math.round(1 + layer + light * 0.7)))];
    const leaf = palmLeaf(length);
    ctx.fill(leaf);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink;
    ctx.stroke(leaf);
    // Nervura do meio.
    ctx.beginPath();
    ctx.moveTo(length * 0.05, 0);
    ctx.quadraticCurveTo(length * 0.5, -length * 0.02, length * 0.95, 0);
    ctx.lineWidth = ink * 0.7;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "#6b4a2e";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = ink;
  ctx.stroke();
}

/**
 * Grama alta: um tufo de folhas finas saindo do meio, curvas e afinando, mais claras viradas para a luz. A metade de
 * dentro de cada folha fica na copa de baixo e a ponta na de cima: só as pontas balançam de verdade.
 */
export function tallGrass(targets: PlantTargets, c: number, seed: number) {
  const r = rng(seed);
  const blades = 38 + Math.floor(r() * 12);
  const reach = c * (0.42 + r() * 0.1);
  // Sombra: uma mancha macia sob o tufo.
  const shadow = targets.shadow;
  shadow.save();
  shadow.fillStyle = "rgba(18,8,22,.3)";
  shadow.beginPath();
  shadow.ellipse(reach * 0.15, reach * 0.2, reach * 0.75, reach * 0.65, 0, 0, Math.PI * 2);
  shadow.fill();
  shadow.restore();
  const list: { angle: number; length: number; bend: number; rootX: number; rootY: number; tone: number }[] = [];
  for (let index = 0; index < blades; index++) {
    const angle = r() * Math.PI * 2;
    const length = reach * (0.6 + r() * 0.5);
    const bend = (r() - 0.5) * 0.9;
    const rootX = (r() - 0.5) * c * 0.18;
    const rootY = (r() - 0.5) * c * 0.18;
    const light = 0.5 - (Math.cos(angle) + Math.sin(angle)) * 0.3 + (r() - 0.5) * 0.4;
    list.push({ angle, length, bend, rootX, rootY, tone: Math.max(0, Math.min(3, Math.floor(light * 4))) });
  }
  // Das escuras para as claras: a luz fica por cima.
  list.sort((first, second) => first.tone - second.tone);
  const width = Math.max(1, c * 0.05);
  for (const blade of list) {
    const cos = Math.cos(blade.angle);
    const sin = Math.sin(blade.angle);
    // Ponto da folha a uma fração `t` do comprimento: curva para o lado com `bend`.
    const at = (t: number): Point => {
      const along = blade.length * t;
      const side = blade.bend * blade.length * t * t * 0.5;
      return [blade.rootX + cos * along - sin * side, blade.rootY + sin * along + cos * side];
    };
    const segment = (ctx: CanvasRenderingContext2D, from: number, to: number, thickness: number) => {
      const [x0, y0] = at(from);
      const [x1, y1] = at((from + to) / 2);
      const [x2, y2] = at(to);
      ctx.strokeStyle = GREEN[blade.tone];
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x1 * 2 - (x0 + x2) / 2, y1 * 2 - (y0 + y2) / 2, x2, y2);
      ctx.stroke();
    };
    segment(targets.low, 0, 0.55, width);
    segment(targets.high, 0.5, 1, width * 0.6);
  }
}
