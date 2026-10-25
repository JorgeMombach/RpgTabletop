// Gera os ícones do app do mestre: assets/icon.ico (Windows) e assets/icon.png 512 px (macOS/Linux),
// e assets/splash.bmp (aparece enquanto o .exe portátil do Windows extrai o app).
// Um dado em bronze, face 5, nas cores do guia visual (docs/design/guia-visual.md).
// Desenhado por código para não depender de editor de imagem. Rodar: node scripts/make-icon.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SS = 4; // supersampling para bordas suaves

const FACE = [193, 154, 98]; // bronze
const EDGE = [110, 83, 49]; // bronze escuro
const PIP = [20, 18, 24]; // tinta
const INK = [20, 18, 24]; // fundo da tela de abertura (#141218)

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

/** Pixels RGBA de cima para baixo, com supersampling. */
function rgba(size) {
  const out = Buffer.alloc(size * size * 4);
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
      const o = (row * size + col) * 4;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return out;
}

/** PNG RGBA mínimo (para o electron-builder gerar os ícones de macOS e Linux). */
function png(size) {
  const px = rgba(size);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row++) px.copy(raw, row * (size * 4 + 1) + 1, row * size * 4, (row + 1) * size * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Bitmap 32 bpp (BGRA, de baixo para cima) + máscara AND, no formato que o ICO espera. */
function bitmap(size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // altura dobrada: cor + máscara
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const px = rgba(size);
  const pixels = Buffer.alloc(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = (row * size + col) * 4;
      const o = ((size - 1 - row) * size + col) * 4;
      pixels[o] = px[i + 2];
      pixels[o + 1] = px[i + 1];
      pixels[o + 2] = px[i];
      pixels[o + 3] = px[i + 3];
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
const outPng = path.join(root, "assets/icon.png");
writeFileSync(outPng, png(512));
console.log(`✓ ${path.relative(root, outPng)} (512 px)`);

/** Tela de abertura do .exe portátil: o dado no fundo tinta. BMP 24 bpp (o instalador só aceita BMP). */
function splash(width, height, die) {
  const px = rgba(die);
  const stride = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(stride * height);
  const x0 = Math.round((width - die) / 2);
  const y0 = Math.round((height - die) / 2);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const u = col - x0;
      const v = row - y0;
      let c = INK;
      if (u >= 0 && v >= 0 && u < die && v < die) {
        const i = (v * die + u) * 4;
        const a = px[i + 3] / 255;
        c = [0, 1, 2].map((k) => Math.round(px[i + k] * a + INK[k] * (1 - a)));
      }
      const o = (height - 1 - row) * stride + col * 3; // de baixo para cima, BGR
      pixels[o] = c[2];
      pixels[o + 1] = c[1];
      pixels[o + 2] = c[0];
    }
  }
  const header = Buffer.alloc(54);
  header.write("BM", 0);
  header.writeUInt32LE(54 + pixels.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixels.length, 34);
  return Buffer.concat([header, pixels]);
}

const outSplash = path.join(root, "assets/splash.bmp");
writeFileSync(outSplash, splash(320, 200, 120));
console.log(`✓ ${path.relative(root, outSplash)} (320 × 200 px)`);
