// Gera os ícones do app do mestre: assets/icon.ico (Windows), assets/icon.png 512 px (macOS/Linux) e
// assets/splash.bmp (aparece enquanto o .exe portátil do Windows extrai o app).
// Desenho aprovado depois da 2.11 ("placa de couro"): quadrado de couro com cantoneiras de bronze e o d20 de
// bronze da tela de entrada, nas cores do guia visual (docs/design/guia-visual.md). Nos tamanhos de 32 px para
// baixo o desenho é simplificado (sem o 20, sem filete e cantoneiras, linhas mais grossas), senão vira borrão.
// Desenhado por código no canvas do Electron, que tem a fonte Cinzel de verdade. Rodar: npm run icon
const { app, BrowserWindow } = require("electron");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const font = readFileSync(require.resolve("@fontsource/cinzel/files/cinzel-latin-700-normal.woff2", { paths: [path.join(root, "client")] }));

/** Roda na página: desenha o ícone em `n` px num canvas. Coordenadas do desenho em 256 × 256. */
function pageCode() {
  const P = { top: [0, -1], ur: [0.868, -0.5], lr: [0.868, 0.5], bot: [0, 1], ll: [-0.868, 0.5], ul: [-0.868, -0.5], t1: [0, -0.42], t2: [0.52, 0.46], t3: [-0.52, 0.46] };
  // Faces do icosaedro visto de frente, com luz de cima à esquerda (o índice é o tom).
  const FACES = [
    ["t1", "t2", "t3", 0], ["top", "ul", "t1", 1], ["top", "t1", "ur", 2], ["ul", "t3", "t1", 3], ["ur", "t1", "t2", 4],
    ["ul", "ll", "t3", 5], ["ur", "t2", "lr", 6], ["ll", "bot", "t3", 7], ["lr", "t2", "bot", 8], ["t3", "bot", "t2", 7],
  ];
  const SHADES = ["#f0dcb2", "#e3c48e", "#c9a26a", "#d4b07a", "#a9844f", "#b48d58", "#8a6a3e", "#8a6a3e", "#6e5331"];
  const EDGE = "#3b2a0d";

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function d20(ctx, cx, cy, r, number, sw) {
    const pt = (k) => [cx + P[k][0] * r, cy + P[k][1] * r];
    ctx.lineJoin = "round";
    ctx.strokeStyle = EDGE;
    for (const [a, b, c, i] of FACES) {
      ctx.beginPath();
      for (const k of [a, b, c]) ctx.lineTo(...pt(k));
      ctx.closePath();
      ctx.fillStyle = SHADES[i];
      ctx.fill();
      ctx.lineWidth = sw;
      ctx.stroke();
    }
    ctx.beginPath();
    for (const k of ["top", "ur", "lr", "bot", "ll", "ul"]) ctx.lineTo(...pt(k));
    ctx.closePath();
    ctx.lineWidth = sw * 1.4;
    ctx.stroke();
    if (number) {
      ctx.fillStyle = EDGE;
      ctx.font = `700 ${r * 0.38}px Cinzel`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("20", cx, cy + r * 0.32);
    }
  }

  /** O ícone em `n` px, desenhado a partir de (x, y) num contexto já existente. */
  function icon(ctx, n, x = 0, y = 0) {
    const small = n <= 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(n / 256, n / 256);
    const g = ctx.createRadialGradient(10 + 236 * 0.35, 10 + 236 * 0.25, 0, 10 + 236 * 0.35, 10 + 236 * 0.25, 236 * 0.9);
    g.addColorStop(0, "#43384d");
    g.addColorStop(1, "#1a1520");
    roundRect(ctx, 10, 10, 236, 236, small ? 40 : 36);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = small ? 10 : 6;
    ctx.strokeStyle = "#a9844f";
    ctx.stroke();
    if (!small) {
      // Filete por dentro e as cantoneiras (superior esquerda e inferior direita), como as placas dos painéis.
      roundRect(ctx, 22, 22, 212, 212, 26);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(216, 180, 122, 0.35)";
      ctx.stroke();
      ctx.strokeStyle = "#d8b47a";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.stroke(new Path2D("M14 70 V40 a26 26 0 0 1 26 -26 H70"));
      ctx.stroke(new Path2D("M242 186 V216 a26 26 0 0 1 -26 26 H186"));
    }
    d20(ctx, 128, 130, small ? 96 : 86, !small, small ? 7 : 3);
    ctx.restore();
  }

  window.iconPixels = (n) => {
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const ctx = c.getContext("2d");
    icon(ctx, n);
    return Array.from(ctx.getImageData(0, 0, n, n).data);
  };

  // Tela de abertura do .exe portátil: o ícone no fundo tinta, com o brilho de bronze da tela de entrada.
  window.splashPixels = (w, h, die) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#141218";
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45);
    glow.addColorStop(0, "rgba(169, 132, 79, 0.18)");
    glow.addColorStop(1, "rgba(169, 132, 79, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    icon(ctx, die, Math.round((w - die) / 2), Math.round((h - die) / 2));
    return Array.from(ctx.getImageData(0, 0, w, h).data);
  };
}

/** Bitmap 32 bpp (BGRA, de baixo para cima) + máscara AND, no formato que o ICO espera. */
function bitmap(size, px) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // altura dobrada: cor + máscara
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
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

function ico(images) {
  const dir = Buffer.alloc(6 + 16 * images.length);
  dir.writeUInt16LE(1, 2); // tipo: ícone
  dir.writeUInt16LE(images.length, 4);
  let offset = dir.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, e); // 0 = 256
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1);
    dir.writeUInt16LE(1, e + 4); // planos
    dir.writeUInt16LE(32, e + 6); // bpp
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([dir, ...images.map((img) => img.data)]);
}

/** BMP 24 bpp (o lançador do .exe portátil só aceita BMP), de baixo para cima, BGR. */
function bmp(width, height, px) {
  const stride = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      const o = (height - 1 - row) * stride + col * 3;
      pixels[o] = px[i + 2];
      pixels[o + 1] = px[i + 1];
      pixels[o + 2] = px[i];
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

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  const css = `@font-face { font-family: Cinzel; font-weight: 700; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); }`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><style>${css}</style><body>`)}`);
  await win.webContents.executeJavaScript(`(${pageCode.toString()})(); document.fonts.load("700 32px Cinzel").then(() => true)`);
  const pixels = (expr) => win.webContents.executeJavaScript(expr);

  const dir = path.join(root, "assets");
  mkdirSync(dir, { recursive: true });
  const images = [];
  for (const size of SIZES) images.push({ size, data: bitmap(size, await pixels(`iconPixels(${size})`)) });
  writeFileSync(path.join(dir, "icon.ico"), ico(images));
  console.log(`✓ assets/icon.ico (${SIZES.join(", ")} px)`);

  // PNG 512 para macOS e Linux: o canvas já codifica.
  const png = await pixels(`(() => { const c = document.createElement("canvas"); c.width = c.height = 512; const d = c.getContext("2d"); d.putImageData(new ImageData(new Uint8ClampedArray(iconPixels(512)), 512, 512), 0, 0); return c.toDataURL("image/png"); })()`);
  writeFileSync(path.join(dir, "icon.png"), Buffer.from(png.split(",")[1], "base64"));
  console.log("✓ assets/icon.png (512 px)");

  writeFileSync(path.join(dir, "splash.bmp"), bmp(320, 200, await pixels("splashPixels(320, 200, 128)")));
  console.log("✓ assets/splash.bmp (320 × 200 px)");
  app.quit();
});
