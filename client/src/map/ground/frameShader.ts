/**
 * Moldura da cena (docs/design/moldura.md), gerada do shader aprovado na página (docs/design/moldura-teste.html):
 * fora da cena, a mesa (o ladrilho de `tableArt.ts`) com a sombra da moldura; na moldura, o perfil em relevo por
 * pixel (meia-esquadria, ornamento nos cantos, brilho de metal no bronze e no ferro); dentro, só a sombra da moldura.
 * Cor pré-multiplicada. A noite escurece tudo junto pela luz da cena (a camada fica embaixo dela).
 */
export const FRAME_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uSize;        // px do canvas (do aparelho)
uniform vec4 uRect;        // cena: x, y, largura, altura (px do canvas, y para baixo)
uniform float uT;          // espessura da moldura (px do canvas)
uniform int uStyle;        // 0 madeira entalhada, 1 ferro com rebites, 2 pedra, 3 bronze dourado
// A mesa por fora: o ladrilho de \`tableArt.ts\` em coordenadas do mapa, como o Konva a desenha (MapEdge/TableShape).
uniform sampler2D uTable;
uniform vec3 uTableMap;    // canto do grid (px do mapa) e lado do ladrilho (px do mapa)
uniform vec3 uStage;       // palco: x, y e escala
uniform vec2 uScreen;      // px da tela (CSS)
out vec4 outColor;
const float PI = 3.14159265;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }

// Onde o pixel está na moldura: u (0 dentro, 1 fora), s (px ao longo do lado, a partir do canto de cima/esquerda),
// lado (0 cima, 1 direita, 2 baixo, 3 esquerda) e o canto (distâncias até a quina de fora, para os ornamentos).
struct Frame { float u; float s; int side; vec2 corner; float len; };
Frame frameAt(vec2 p) {
  float left = uRect.x - p.x, right = p.x - (uRect.x + uRect.z), top = uRect.y - p.y, bottom = p.y - (uRect.y + uRect.w);
  float o = max(max(left, right), max(top, bottom));
  Frame f;
  f.u = o / uT;
  if (o == top) { f.side = 0; f.s = p.x - uRect.x; f.len = uRect.z; }
  else if (o == right) { f.side = 1; f.s = p.y - uRect.y; f.len = uRect.w; }
  else if (o == bottom) { f.side = 2; f.s = uRect.x + uRect.z - p.x; f.len = uRect.z; }
  else { f.side = 3; f.s = uRect.y + uRect.w - p.y; f.len = uRect.w; }
  // quina de fora mais perto (px): para os florões e as chapas dos cantos
  vec2 c0 = vec2(p.x < uRect.x + uRect.z * 0.5 ? uRect.x - uT * 0.5 : uRect.x + uRect.z + uT * 0.5, p.y < uRect.y + uRect.w * 0.5 ? uRect.y - uT * 0.5 : uRect.y + uRect.w + uT * 0.5);
  f.corner = p - c0;
  return f;
}
// perfis (altura 0..1) por faixas de u
float band(float u, float a, float b) { return smoothstep(a, a + 0.015, u) * (1.0 - smoothstep(b - 0.015, b, u)); }
float bump(float u, float a, float b) { float x = clamp((u - a) / (b - a), 0.0, 1.0); return sqrt(max(0.0, 1.0 - pow(x * 2.0 - 1.0, 2.0))); }
float cove(float u, float a, float b) { float x = clamp((u - a) / (b - a), 0.0, 1.0); return 1.0 - sqrt(max(0.0, 1.0 - pow(1.0 - x, 2.0))); }

float heightWood(Frame f) {
  float u = f.u, t = uT;
  float h = 0.0;
  // de dentro para fora: degrau fino da vista, painel entalhado, cordão torcido, cavado, lábio de fora
  h += band(u, 0.0, 0.1) * 0.25;
  float panel = band(u, 0.1, 0.46);
  if (panel > 0.0) {
    // folhas entalhadas: uma a cada 0,9 da espessura, alternando a inclinação
    float k = f.s / (t * 0.9);
    vec2 q = vec2(fract(k) - 0.5, (u - 0.28) / 0.18);
    float tilt = mod(floor(k), 2.0) * 2.0 - 1.0;
    vec2 r = mat2(cos(0.5 * tilt), -sin(0.5 * tilt), sin(0.5 * tilt), cos(0.5 * tilt)) * q;
    float leaf = max(0.0, 1.0 - length(r / vec2(0.42, 0.62)));
    float vein = 1.0 - smoothstep(0.0, 0.04, abs(r.x));
    h += panel * (0.42 + 0.28 * sqrt(leaf) - 0.05 * vein * step(0.05, leaf));
  }
  float rope = bump(u, 0.46, 0.64);
  if (rope > 0.0) {
    float twist = sin((f.s / (t * 0.22) + u * 9.0) * PI);
    h += 0.55 + 0.32 * rope + 0.08 * twist * rope;
  }
  h += (cove(u, 0.64, 0.86) * 0.5 + 0.35) * band(u, 0.64, 0.86);
  h += (0.8 + 0.12 * bump(u, 0.86, 1.0)) * band(u, 0.86, 1.0);
  return h;
}
float heightBronze(Frame f) {
  float u = f.u, t = uT;
  float h = 0.0;
  h += band(u, 0.0, 0.08) * 0.3;
  // fileira de contas
  float beads = band(u, 0.08, 0.26);
  if (beads > 0.0) {
    vec2 q = vec2((fract(f.s / (t * 0.2)) - 0.5) * t * 0.2, (u - 0.17) * t);
    h += beads * (0.35 + 0.35 * sqrt(max(0.0, 1.0 - dot(q, q) / pow(t * 0.075, 2.0))));
  }
  // óvalo e dardo no meio
  float egg = band(u, 0.26, 0.6);
  if (egg > 0.0) {
    float k = fract(f.s / (t * 0.42));
    vec2 q = vec2((k - 0.5) / 0.32, (u - 0.43) / 0.15);
    float ov = max(0.0, 1.0 - dot(q, q));
    float dart = (1.0 - smoothstep(0.0, 0.06, abs(k - 0.0) * (1.0 - step(0.5, k)) + abs(k - 1.0) * step(0.5, k))) * band(u, 0.3, 0.55);
    float rim = 1.0 - smoothstep(0.0, 0.12, abs(length(q) - 1.08));
    h += egg * (0.4 + 0.4 * sqrt(ov) + 0.18 * rim + 0.2 * dart);
  }
  h += (0.62 + 0.3 * bump(u, 0.6, 0.86)) * band(u, 0.6, 0.86);
  h += (0.75 + 0.1 * cove(u, 0.86, 1.0)) * band(u, 0.86, 1.0);
  return h;
}
float heightIron(Frame f) {
  float u = f.u, t = uT;
  float h = 0.5 + 0.25 * bump(u, 0.0, 1.0);
  h += (fbm(vec2(f.s, u * t) / (t * 0.18)) - 0.5) * 0.09;     // martelado
  // rebites
  float step_ = t * 1.1;
  vec2 q = vec2((fract(f.s / step_ + 0.5) - 0.5) * step_, (u - 0.5) * t);
  float rivet = max(0.0, 1.0 - dot(q, q) / pow(t * 0.12, 2.0));
  h += 0.35 * sqrt(rivet);
  return h;
}
float heightStone(Frame f) {
  float u = f.u, t = uT;
  float block = t * 1.5;
  float k = f.s / block;
  float joint = min(fract(k), 1.0 - fract(k)) * block;
  float mortar = smoothstep(0.0, t * 0.06, joint);
  float bevel = smoothstep(0.0, t * 0.12, min(joint, min(u, 1.0 - u) * t));
  float chisel = (fbm(vec2(f.s, u * t) / (t * 0.12)) - 0.5) * 0.12 + (noise(vec2(f.s, u * t) / (t * 0.035)) - 0.5) * 0.04;
  return 0.25 + 0.55 * bevel * mortar + chisel * mortar;
}
float heightAt(vec2 p) {
  Frame f = frameAt(p);
  if (f.u <= 0.0 || f.u >= 1.0) return 0.0;
  float h = uStyle == 0 ? heightWood(f) : uStyle == 1 ? heightIron(f) : uStyle == 2 ? heightStone(f) : heightBronze(f);
  // ornamento dos cantos: florão (madeira, bronze) ou chapa com 4 rebites (ferro); a pedra tem bloco de canto
  float r = length(f.corner);
  if (uStyle == 0 || uStyle == 3) {
    float a = atan(f.corner.y, f.corner.x);
    float petals = 0.5 + 0.5 * cos(a * 8.0);
    float rose = max(0.0, 1.0 - r / (uT * (0.42 + 0.08 * petals)));
    if (rose > 0.0) h = max(h, 0.7 + 0.45 * sqrt(rose) * (0.7 + 0.3 * petals) + 0.25 * max(0.0, 1.0 - r / (uT * 0.12)));
  } else if (uStyle == 1) {
    vec2 c = abs(f.corner);
    if (max(c.x, c.y) < uT * 0.62) {
      float plate = 0.95 + 0.15 * bump(1.0 - max(c.x, c.y) / (uT * 0.62), 0.0, 0.4);
      vec2 q = c - vec2(uT * 0.36);
      plate += 0.35 * sqrt(max(0.0, 1.0 - dot(q, q) / pow(uT * 0.11, 2.0)));
      h = max(h, plate + (fbm(f.corner / (uT * 0.15)) - 0.5) * 0.06);
    }
  } else {
    vec2 c = abs(f.corner);
    if (max(c.x, c.y) < uT * 0.75) h = max(h, 0.9 * smoothstep(0.0, uT * 0.12, uT * 0.75 - max(c.x, c.y)) + (fbm(f.corner / (uT * 0.1)) - 0.5) * 0.1);
  }
  return h;
}

vec3 materialAt(vec2 p, float h) {
  Frame f = frameAt(p);
  if (uStyle == 0) {
    // madeira: veio ao longo do lado (corta na diagonal dos cantos), anéis e poros; o fundo dos entalhes mais escuro
    vec2 g = vec2(f.s / uT, f.u * 3.0 + float(f.side) * 7.0);
    float ring = sin((g.y + fbm(g * vec2(0.4, 1.5)) * 2.5) * 6.0) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.33, 0.19, 0.09), vec3(0.55, 0.34, 0.17), ring * 0.6 + fbm(g * vec2(0.2, 3.0)) * 0.4);
    col *= 0.9 + 0.2 * noise(vec2(f.s * 0.8, f.u * uT * 6.0));
    return col;
  }
  if (uStyle == 3) {
    // bronze dourado: ouro velho, mais escuro e esverdeado nos fundos (pátina)
    vec3 gold = mix(vec3(0.62, 0.45, 0.2), vec3(0.85, 0.66, 0.32), fbm(p / (uT * 0.6)));
    vec3 patina = vec3(0.22, 0.2, 0.12);
    return mix(patina, gold, smoothstep(0.35, 0.75, h));
  }
  if (uStyle == 1) return vec3(0.25, 0.26, 0.28) * (0.85 + 0.3 * fbm(p / (uT * 0.3)));
  // pedra: cinza quente, com manchas e grão
  float k = floor(f.s / (uT * 1.5));
  vec3 col = mix(vec3(0.46, 0.43, 0.38), vec3(0.6, 0.57, 0.5), hash(vec2(k, float(f.side))));
  return col * (0.85 + 0.25 * fbm(p / (uT * 0.25))) * mix(0.55, 1.0, smoothstep(0.1, 0.3, h));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  Frame f = frameAt(p);
  vec3 lightDir = normalize(vec3(-0.55, -0.65, 0.75));
  if (f.u <= 0.0) {
    // dentro da cena: a sombra da moldura sobre o mapa (dos lados de cima e da esquerda), macia
    float inLeft = p.x - uRect.x, inTop = p.y - uRect.y;
    float shadow = max(1.0 - smoothstep(0.0, uT * 0.55, inLeft), 1.0 - smoothstep(0.0, uT * 0.55, inTop)) * 0.45;
    float rim = max(1.0 - smoothstep(0.0, 3.0, inLeft), max(1.0 - smoothstep(0.0, 3.0, inTop), max(1.0 - smoothstep(0.0, 3.0, uRect.x + uRect.z - p.x), 1.0 - smoothstep(0.0, 3.0, uRect.y + uRect.w - p.y)))) * 0.35;
    float a = max(shadow, rim);
    outColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }
  if (f.u >= 1.0) {
    // fora: a mesa, com a sombra da moldura caindo para baixo e à direita
    vec2 mapPx = (p * uScreen / uSize - uStage.xy) / uStage.z;
    vec3 table = texture(uTable, (mapPx - uTableMap.xy) / uTableMap.z).rgb;
    vec2 back = p - vec2(uT * 0.25, uT * 0.3);
    Frame g = frameAt(back);
    float a = g.u > 0.0 && g.u < 1.0 ? 0.55 : 0.0;
    a *= 1.0 - smoothstep(1.0, 1.4, f.u);
    outColor = vec4(table * (1.0 - a), 1.0);
    return;
  }
  // normal pela altura (diferença de um pixel), com a altura em px proporcional à espessura
  float depth = uT * 0.35;
  float h = heightAt(p);
  float hx = heightAt(p + vec2(1.0, 0.0)) - heightAt(p - vec2(1.0, 0.0));
  float hy = heightAt(p + vec2(0.0, 1.0)) - heightAt(p - vec2(0.0, 1.0));
  vec3 n = normalize(vec3(-hx * depth * 0.5, -hy * depth * 0.5, 1.0));
  vec3 base = materialAt(p, h);
  float diffuse = max(dot(n, lightDir), 0.0);
  float ao = mix(0.55, 1.0, smoothstep(0.15, 0.7, h));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfway = normalize(lightDir + viewDir);
  float metal = uStyle == 3 ? 1.0 : uStyle == 1 ? 0.6 : uStyle == 0 ? 0.12 : 0.04;
  float shininess = uStyle == 3 ? 48.0 : uStyle == 1 ? 28.0 : 16.0;
  float spec = pow(max(dot(n, halfway), 0.0), shininess) * metal;
  vec3 specColor = uStyle == 3 ? vec3(1.0, 0.86, 0.55) : vec3(0.9, 0.92, 0.95);
  vec3 col = base * (0.28 + 0.95 * diffuse) * ao + specColor * spec * (0.6 + 0.4 * ao);
  // borda de fora: um friso escuro de contato com a mesa
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.03, 1.0 - f.u));
  outColor = vec4(col, 1.0);
}`;
