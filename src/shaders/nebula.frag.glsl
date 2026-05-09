precision highp float;

varying vec3 vWorldDir;

uniform float uTime;
uniform vec3  uPaletteA;
uniform vec3  uPaletteB;
uniform vec3  uPaletteC;
uniform vec3  uPaletteD;
uniform float uContrast;
uniform float uDensity;
uniform float uSwirl;
uniform float uDrift;
uniform vec2  uCoreOffset;
uniform int   uOctaves;

// --- 3D hash + value noise (cheap, no textures) ---
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

float fbm(vec3 p, int oct) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

vec3 palette4(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  // Smooth quartic-ish blend across 4 stops.
  t = clamp(t, 0.0, 1.0);
  float t1 = smoothstep(0.0, 0.34, t);
  float t2 = smoothstep(0.33, 0.66, t);
  float t3 = smoothstep(0.65, 1.0, t);
  vec3 ab = mix(a, b, t1);
  vec3 bc = mix(ab, c, t2);
  return mix(bc, d, t3);
}

void main() {
  vec3 dir = normalize(vWorldDir);
  // Domain-warp the sampling direction to create the swirl illusion.
  vec3 q = dir * 1.6;
  float t = uTime * uDrift;
  vec3 warp = vec3(
    fbm(q + vec3(0.0, 0.0,  t), 3),
    fbm(q + vec3(5.2, 1.3, -t), 3),
    fbm(q + vec3(9.8, 8.4,  t * 0.7), 3)
  );
  vec3 sampleDir = q + (warp - 0.5) * uSwirl * 1.4;

  float n = fbm(sampleDir, uOctaves);

  // Soft directional gradient toward two galactic cores (in screen-ish space).
  float core1 = 1.0 - smoothstep(0.0, 1.4, length(dir.xy - uCoreOffset));
  float core2 = 1.0 - smoothstep(0.0, 1.6, length(dir.xz + vec2(-0.15, 0.4)));
  float coreLift = max(core1 * 0.55, core2 * 0.4);

  float density = pow(clamp(n + coreLift * uDensity, 0.0, 1.0), uContrast);

  // Painterly tonal banding: quantize then re-soften.
  float bands = 6.0;
  float banded = floor(density * bands) / bands;
  density = mix(banded, density, 0.55);

  vec3 col = palette4(density, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

  // Subtle vignette toward poles so the painting feels framed.
  float vert = abs(dir.y);
  col *= mix(1.0, 0.65, smoothstep(0.6, 1.0, vert));

  // Background should never be pitch black; lift just a touch.
  col = max(col, uPaletteA * 0.45);

  gl_FragColor = vec4(col, 1.0);
}
