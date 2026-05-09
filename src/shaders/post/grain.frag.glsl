precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uIntensity;
uniform float uScale;
uniform float uMode;     // 0 = animated film grain, 1 = static paper grain

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1));
  float d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec3 col = texture2D(tDiffuse, vUv).rgb;
  float t = mix(uTime * 80.0, 0.0, step(0.5, uMode));
  float n = hash21(vUv * uScale + vec2(t, t * 1.31));
  float low = vnoise2(vUv * (uScale * 0.12) + 7.0);
  float grain = mix(n, low, step(0.5, uMode));
  col *= mix(1.0 - uIntensity, 1.0 + uIntensity, grain);
  gl_FragColor = vec4(col, 1.0);
}
