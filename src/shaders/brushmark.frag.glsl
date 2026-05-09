precision highp float;

varying vec2 vUv;
varying float vSeed;

uniform float uTime;
uniform float uOpacity;
uniform vec3  uPaletteA;
uniform vec3  uPaletteB;
uniform vec3  uPaletteC;
uniform vec3  uPaletteD;

float hash12(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm2(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise2(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 palette4(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  t = clamp(t, 0.0, 1.0);
  float t1 = smoothstep(0.0, 0.34, t);
  float t2 = smoothstep(0.33, 0.66, t);
  float t3 = smoothstep(0.65, 1.0, t);
  vec3 ab = mix(a, b, t1);
  vec3 bc = mix(ab, c, t2);
  return mix(bc, d, t3);
}

void main() {
  vec2 p = vUv - 0.5;

  // Long elliptical falloff = the basic stroke shape.
  float ellipse = length(vec2(p.x * 1.0, p.y * 4.5));
  float stroke = 1.0 - smoothstep(0.18, 0.46, ellipse);
  if (stroke <= 0.0) discard;

  // Bristle texture: warped noise streaks running along the stroke long axis.
  vec2 q = vec2(p.x * 6.0 + vSeed * 11.0, p.y * 1.6 + uTime * 0.06);
  float bristles = fbm2(q + fbm2(q * 1.3) * 0.6);
  bristles = pow(bristles, 1.5);

  float alpha = stroke * (0.55 + 0.55 * bristles) * uOpacity;

  // Color pick from palette, biased per-stroke by seed.
  float t = clamp(0.18 + 0.65 * fract(vSeed * 7.123) + 0.15 * (bristles - 0.5), 0.0, 1.0);
  vec3 col = palette4(t, uPaletteA, uPaletteB, uPaletteC, uPaletteD) * 1.18;

  gl_FragColor = vec4(col, alpha);
}
