precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uRadius;

vec3 sampleC(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }

void main() {
  vec2 px = 1.0 / uResolution;
  float r = max(1.0, uRadius);

  vec3 mean[4];
  vec3 sq[4];
  float n[4];
  for (int i = 0; i < 4; i++) { mean[i] = vec3(0.0); sq[i] = vec3(0.0); n[i] = 0.0; }

  // 4 quadrant Kuwahara
  for (int j = -8; j <= 8; j++) {
    if (float(j) > r) continue;
    if (float(j) < -r) continue;
    for (int i = -8; i <= 8; i++) {
      if (float(i) > r) continue;
      if (float(i) < -r) continue;
      vec2 off = vec2(float(i), float(j));
      vec3 c = sampleC(vUv + off * px);
      // 0: -x -y    1: +x -y    2: -x +y    3: +x +y
      if (i <= 0 && j <= 0) { mean[0] += c; sq[0] += c * c; n[0] += 1.0; }
      if (i >= 0 && j <= 0) { mean[1] += c; sq[1] += c * c; n[1] += 1.0; }
      if (i <= 0 && j >= 0) { mean[2] += c; sq[2] += c * c; n[2] += 1.0; }
      if (i >= 0 && j >= 0) { mean[3] += c; sq[3] += c * c; n[3] += 1.0; }
    }
  }

  vec3 bestMean = vec3(0.0);
  float bestVar = 1.0e9;
  for (int k = 0; k < 4; k++) {
    vec3 m = mean[k] / max(1.0, n[k]);
    vec3 v = sq[k] / max(1.0, n[k]) - m * m;
    float vsum = v.r + v.g + v.b;
    if (vsum < bestVar) { bestVar = vsum; bestMean = m; }
  }

  gl_FragColor = vec4(bestMean, 1.0);
}
