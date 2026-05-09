precision highp float;

varying vec2 vUv;
varying float vSeed;
varying float vTwinkle;

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);

  // Smooth disc.
  float disc = 1.0 - smoothstep(0.05, 0.42, r);

  // Cross glints (rotated by per-star seed for variation).
  float a = vSeed * 6.2831853;
  vec2 q = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
  float horiz = exp(-pow(abs(q.y) * 22.0, 1.5)) * exp(-pow(abs(q.x) * 4.0, 1.4));
  float vert  = exp(-pow(abs(q.x) * 22.0, 1.5)) * exp(-pow(abs(q.y) * 4.0, 1.4));
  float glint = max(horiz, vert) * 0.55;

  float a_total = clamp(disc + glint, 0.0, 1.0);

  // Slight color variance per star (warm-cool axis).
  vec3 warm = vec3(1.0, 0.92, 0.78);
  vec3 cool = vec3(0.78, 0.86, 1.0);
  vec3 col = mix(cool, warm, fract(vSeed * 13.0));
  col *= vTwinkle;

  if (a_total < 0.01) discard;
  gl_FragColor = vec4(col, a_total);
}
