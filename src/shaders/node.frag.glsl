precision highp float;

varying vec2  vUv;
varying vec3  vColor;
varying float vGlow;
varying float vSeed;
varying float vHover;

uniform float uTime;

float hash11(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);

  // Inner bright core.
  float core = smoothstep(0.0, 0.04, 0.32 - r);
  // Wide soft halo with a slight painterly edge.
  float halo = smoothstep(0.5, 0.05, r);
  halo = pow(halo, 1.6);

  // Painterly speckle on the halo so it doesn't look like a clean radial gradient.
  float a = atan(p.y, p.x);
  float speckle = 0.5 + 0.5 * sin(a * (6.0 + hash11(vSeed) * 6.0) + uTime * 0.6 + vSeed * 31.0);
  halo *= mix(0.6, 1.0, speckle);

  float alpha = clamp(core + halo * 0.65, 0.0, 1.0);
  if (alpha < 0.01) discard;

  vec3 col = vColor * (1.4 * vGlow);
  // Whiten the very center.
  col = mix(col, vec3(1.0), core * 0.7);
  // Hover lift: brighten and add a faint white halo ring.
  col = mix(col, col * 1.4 + vec3(0.15), vHover);
  alpha = mix(alpha, min(1.0, alpha + 0.18), vHover);

  gl_FragColor = vec4(col, alpha);
}
