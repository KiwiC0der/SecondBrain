precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;

uniform float uVignetteAmount;
uniform float uVignetteSoftness;
uniform float uHueShift;
uniform float uSat;
uniform float uContrast;
uniform float uLift;
uniform float uGamma;
uniform float uGain;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec3 col = texture2D(tDiffuse, vUv).rgb;

  // Lift / Gamma / Gain (cinematic 3-way grade).
  col = max(vec3(0.0), col + uLift);
  col = pow(max(col, vec3(0.0)), vec3(1.0 / max(0.001, uGamma)));
  col *= uGain;

  // Hue / Sat / Contrast in HSV space (sat) + linear (contrast).
  vec3 hsv = rgb2hsv(col);
  hsv.x = fract(hsv.x + uHueShift);
  hsv.y = clamp(hsv.y * uSat, 0.0, 2.0);
  col = hsv2rgb(hsv);
  col = (col - 0.5) * uContrast + 0.5;

  // Vignette.
  vec2 d = vUv - 0.5;
  float r = length(d * vec2(1.2, 1.0));
  float vig = smoothstep(0.85 - uVignetteSoftness, 0.85, r);
  col *= mix(1.0, 1.0 - uVignetteAmount, vig);

  gl_FragColor = vec4(col, 1.0);
}
