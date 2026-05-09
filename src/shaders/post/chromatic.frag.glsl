precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform float uAmount;
uniform float uFalloff;

void main() {
  vec2 c = vec2(0.5);
  vec2 d = vUv - c;
  float r2 = dot(d, d);
  float amt = uAmount * mix(1.0, smoothstep(0.0, 1.0, r2 * 4.0), uFalloff);

  vec2 dir = normalize(d + 1e-6);
  float rR = texture2D(tDiffuse, vUv - dir * amt * 1.0).r;
  float rG = texture2D(tDiffuse, vUv).g;
  float rB = texture2D(tDiffuse, vUv + dir * amt * 1.0).b;
  float a  = texture2D(tDiffuse, vUv).a;
  gl_FragColor = vec4(rR, rG, rB, a);
}
