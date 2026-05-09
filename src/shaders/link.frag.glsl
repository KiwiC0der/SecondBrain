precision highp float;

varying vec2 vUv;
varying float vSeed;

uniform float uTime;
uniform float uOpacity;
uniform vec3  uInkColor;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
  // vUv.x = along edge (0..1), vUv.y = across (0..1, with 0.5 = center)
  float along = vUv.x;
  float across = vUv.y - 0.5;

  // Soft inky edge across the ribbon, with painterly noise edge.
  float edge = vnoise2(vec2(along * 8.0, vSeed * 17.0 + uTime * 0.05));
  float halfWidth = 0.40 + (edge - 0.5) * 0.18;
  float a = 1.0 - smoothstep(halfWidth - 0.18, halfWidth, abs(across));

  // Endpoint fade so links don't visually overshoot the node centers.
  float endFade = smoothstep(0.0, 0.06, along) * smoothstep(0.0, 0.06, 1.0 - along);
  a *= endFade;

  // Bristle along the stroke (lengthwise), to suggest dry brush.
  float bristle = vnoise2(vec2(along * 24.0 + vSeed * 9.0, across * 8.0));
  float ink = mix(0.7, 1.0, bristle);

  if (a <= 0.001) discard;

  vec3 col = uInkColor * ink;
  gl_FragColor = vec4(col, a * uOpacity);
}
