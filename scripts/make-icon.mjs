// Gera assets/icon.ico (ícone do executável no Windows): um dado dourado, face 5.
// Desenhado por código para não depender de editor de imagem. Rodar: node scripts/make-icon.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SS = 4; // supersampling para bordas suaves

const FACE = [212, 162, 76]; // --accent
const EDGE = [122, 88, 30];
const PIP = [26, 20, 6]; // --accent-text

/** Cor (RGBA 0–1) no ponto (u, v) ∈ [0,1]² — quadrado arredondado com 5 pontos. */
function sample(u, v) {
  const m = 0.06; // margem
  const r = 0.2; // raio do canto
  const x = (u - 0.5) / (0.5 - m);
  const y = (v - 0.5) / (0.5 - m);
  const k = 1 - r;
  const dx = Math.max(Math.abs(x) - k, 0);
  const dy = Math.max(Math.abs(y) - k, 0);
  const d = Math.hypot(dx, dy) - r; // < 0 dentro do quadrado arredondado
  if (d > 0) return null;
  const pips = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0, 0],
    [-0.5, 0.5],
    [0.5, 0.5],
  ];
  if (pips.some(([px, py]) => Math.hypot(x - px, y - py) < 0.2)) return PIP;
  return d > -0.09 ? EDGE : FACE;
}

/** Bitmap 32 bpp (BGRA, de baixo para cima) + máscara AND, no formato que o ICO espera. */
function bitmap(size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // altura dobrada: cor + máscara
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const pixels = Buffer.alloc(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((col + (sx + 0.5) / SS) / size, (row + (sy + 0.5) / SS) / size);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a++;
        }
      }
      const n = SS * SS;
      const o = ((size - 1 - row) * size + col) * 4;
      pixels[o] = a ? Math.round(b / a) : 0;
      pixels[o + 1] = a ? Math.round(g / a) : 0;
      pixels[o + 2] = a ? Math.round(r / a) : 0;
      pixels[o + 3] = Math.round((a / n) * 255);
    }
  }
  const maskRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)]);
}

const images = SIZES.map(bitmap);
const dir = Buffer.alloc(6 + 16 * images.length);
dir.writeUInt16LE(1, 2); // tipo: ícone
dir.writeUInt16LE(images.length, 4);
let offset = dir.length;
images.forEach((img, i) => {
  const e = 6 + i * 16;
  const s = SIZES[i];
  dir.writeUInt8(s >= 256 ? 0 : s, e); // 0 = 256
  dir.writeUInt8(s >= 256 ? 0 : s, e + 1);
  dir.writeUInt16LE(1, e + 4); // planos
  dir.writeUInt16LE(32, e + 6); // bpp
  dir.writeUInt32LE(img.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += img.length;
});

mkdirSync(path.join(root, "assets"), { recursive: true });
const out = path.join(root, "assets/icon.ico");
writeFileSync(out, Buffer.concat([dir, ...images]));
console.log(`✓ ${path.relative(root, out)} (${SIZES.join(", ")} px)`);
