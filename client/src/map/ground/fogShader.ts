/**
 * Shaders da névoa na placa de vídeo (docs/design/nevoa.md; a conta da página aprovada, nevoa-teste.ts). Duas máscaras
 * na metade da tela (casas e linha de visão) e um desenho de tela cheia que sai em três modos: a fumaça, o véu cinza
 * que tira a cor do explorado e o multiplicador das copas.
 */

/** Triângulos em casas para a tela (como o disco do mapa de alturas). */
export const FOG_MASK_VERTEX = `#version 300 es
in vec2 aCell;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen;
void main() {
  vec2 screen = (aCell * uMapGrid.z + uMapGrid.xy) * uStage.z + uStage.xy;
  gl_Position = vec4(screen.x / uScreen.x * 2.0 - 1.0, 1.0 - screen.y / uScreen.y * 2.0, 0.0, 1.0);
}`;

/** Uma cor só (o canal certo vem do `colorMask`). */
export const FOG_MASK_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec4 uColor;
void main() { outColor = uColor; }`;

/** Modos do desenho de tela cheia. */
export const FOG_MODE = { smoke: 0, tint: 1, canopy: 2 } as const;

/**
 * A névoa. Máscara das casas: R agora, G explorado, B revelado (a pincelada "cobrir" já apagada). Máscara da visão:
 * R o leque parado nas paredes, G o círculo sem paredes. As duas na metade da tela, com níveis menores (borda macia).
 */
export const FOG_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen, uCanvas;
uniform sampler2D uCells, uSight, uNoise;
uniform float uTime;
uniform int uUseSight;   // há leque (visão dos personagens com alguém no mapa)
uniform int uGm;         // bruma do mestre
uniform int uMode;       // 0 fumaça, 1 véu cinza, 2 copas

float cloudA(vec2 p) { return texture(uNoise, p).r; }
float cloudB(vec2 p) { return texture(uNoise, p).g; }

/** Pixels da máscara por casa (a máscara tem a metade do canvas). */
float maskPerCell() { return uMapGrid.z * uStage.z * (uCanvas.x / uScreen.x) * 0.5; }
/** Deslocamento em casas virado deslocamento na máscara (a máscara tem o alto da tela em cima). */
vec2 cellShift(vec2 cells) { return vec2(cells.x, -cells.y) * uMapGrid.z * uStage.z / uScreen; }
/** A máscara desfocada por ~\`cells\` casas: o nível menor certo e 8 leituras em volta. */
vec4 blurred(sampler2D mask, vec2 uv, float cells) {
  float lod = max(0.0, log2(max(1.0, cells * maskPerCell())));
  vec2 step = cellShift(vec2(cells * 0.5));
  vec4 sum = textureLod(mask, uv, lod) * 2.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    sum += textureLod(mask, uv + vec2(cos(a), sin(a)) * abs(step), lod);
  }
  return sum / 10.0;
}
/** As casas com a borda redonda (~meia casa para cada lado). */
vec4 cellsSoft(vec2 uv) { return smoothstep(0.1, 0.9, blurred(uCells, uv, 1.0)); }
/** As casas até a beira (só um respiro): na linha + casa, quem manda rente à parede é a linha. */
vec4 cellsFirm(vec2 uv) { return smoothstep(0.2, 0.55, blurred(uCells, uv, 0.1)); }
/** O que se vê agora, firme ou largo (\`cells\` casas de borda), pela linha cortada pelas casas ou só pelas casas. */
float nowAt(vec2 uv, float cells) {
  if (uUseSight == 0) return cellsSoft(uv).r;
  return min(blurred(uSight, uv, cells).r, cellsFirm(uv).r);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uCanvas;
  vec2 screen = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) * (uScreen / uCanvas);
  vec2 cell = ((screen - uStage.xy) / uStage.z - uMapGrid.xy) / uMapGrid.z;
  float t = uTime;
  // a fumaça corre devagar e se torce (1 ladrilho do ruído = 11 casas)
  vec2 p = cell / 11.0;
  vec2 flow = vec2(cloudA(p * 0.5 + vec2(t * 0.005, 0.0)), cloudB(p * 0.5 - vec2(0.0, t * 0.004))) - 0.5;
  vec2 q = p + flow * 0.4;
  float big = cloudA(q + vec2(t * 0.007, t * 0.002));
  float mid = cloudB(q * 2.1 - vec2(t * 0.012, -t * 0.005));
  float fine = cloudA(q * 3.1 + vec2(-t * 0.021, t * 0.014));
  float body = big * 0.6 + mid * 0.3 + fine * 0.1;
  // relevo da fumaça: a mesma nuvem um tico deslocada (a luz vem de cima, à esquerda)
  float lit = clamp((big - cloudA(q + vec2(t * 0.007, t * 0.002) + vec2(0.02, 0.03))) * 4.0 + 0.5, 0.0, 1.0);

  // o que se vê: firme (rente à parede) e largo (para saber onde é a borda); o revelado e o explorado pelas casas
  vec2 drift = flow * 1.4;
  vec2 uvDrift = uv + cellShift(drift);
  float firm = max(nowAt(uv, 0.1), cellsSoft(uv + cellShift(drift * 0.5)).b);
  float wide = max(nowAt(uvDrift, 0.8), cellsSoft(uvDrift).b);
  // explorado: vai até a beira da casa e só se espalha, com o balanço, para o lado do nunca visto
  float remembered = max(cellsFirm(uv).g, cellsSoft(uvDrift).g);
  // perto da borda (até ~1,5 casa), a fumaça avança e recua em fiapos; dentro do alcance a borda é de parede: firme
  float inRange = uUseSight == 0 ? 0.0 : smoothstep(0.6, 0.95, blurred(uSight, uv, 0.8).g);
  float loose = mix(1.0, 0.12, inRange);
  float band = 1.0 - abs(wide * 2.0 - 1.0);
  float wisp = (mid * 0.6 + fine * 0.4 - 0.5) * 1.5;
  float clear = clamp(mix(firm, wide, 0.45 * loose) + wisp * band * 0.95 * loose, 0.0, 1.0);
  float fog = smoothstep(0.2, 0.95, 1.0 - clear);                      // qualquer névoa (explorado incluído)
  float unseen = smoothstep(0.2, 0.95, 1.0 - max(clear, remembered));  // o nunca visto
  float explored = fog * (1.0 - unseen);

  if (uMode == 1) {
    // véu cinza (mistura "saturação"): tira a cor do explorado do jogador
    float alpha = uGm == 1 ? 0.0 : 0.55 * explored;
    outColor = vec4(vec3(0.5) * alpha, alpha);
    return;
  }
  if (uMode == 2) {
    // copas: some no nunca visto e escurece no explorado (jogador); o mestre só escurece
    float keep = uGm == 1 ? 1.0 : 1.0 - unseen;
    float shade = uGm == 1 ? mix(1.0, 0.7, unseen) : mix(1.0, 0.55, explored);
    outColor = vec4(vec3(shade * keep), keep);
    return;
  }
  vec3 color;
  float alpha;
  if (uGm == 0) {
    // jogador: tinta escura com reflexo violeta; dobras claras, vãos escuros
    vec3 hollow = vec3(4.0, 3.0, 8.0) / 255.0;
    vec3 shade = vec3(30.0, 24.0, 42.0) / 255.0;
    vec3 shine = vec3(96.0, 80.0, 128.0) / 255.0;
    color = mix(hollow, shade, smoothstep(0.2, 0.8, body));
    color = mix(color, shine, smoothstep(0.5, 0.9, body) * (0.2 + 0.35 * lit));
    // explorado: véu de fumaça (o mapa aparece escurecido); nunca visto: fumaça cheia
    alpha = mix(fog * (0.42 + 0.2 * smoothstep(0.45, 0.8, body)), 1.0, unseen);
    // a beira da fumaça pega um pouco de luz
    float rim = fog * (1.0 - fog) * 4.0;
    color += shine * rim * 0.18 * smoothstep(0.4, 0.75, body) / max(alpha, 0.05);
  } else {
    // mestre: bruma cinza translúcida
    color = mix(vec3(92.0, 88.0, 110.0), vec3(160.0, 156.0, 176.0), smoothstep(0.3, 0.75, body)) / 255.0;
    color = mix(color, vec3(232.0, 230.0, 240.0) / 255.0, smoothstep(0.6, 0.9, body) * (0.2 + 0.4 * lit));
    alpha = mix(fog * 0.3, 0.62, unseen);
  }
  outColor = vec4(clamp(color, 0.0, 1.0) * alpha, alpha);
}`;
