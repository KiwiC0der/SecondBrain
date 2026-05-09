precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uThickness;
uniform float uThreshold;
uniform vec3 uInkColor;
uniform float uInkStrength;
uniform float uCameraNear;
uniform float uCameraFar;

float perspectiveDepthToViewZ(float z, float n, float f) {
  return (n * f) / ((f - n) * z - f);
}
float linearize(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  // d is non-linear (perspective). Convert to linear view-z, then to [0,1].
  float vz = perspectiveDepthToViewZ(d, uCameraNear, uCameraFar);
  return clamp(vz / -uCameraFar, 0.0, 1.0);
}

void main() {
  vec2 px = uThickness / uResolution;
  vec3 col = texture2D(tDiffuse, vUv).rgb;

  // Sobel on linearized depth
  float tl = linearize(vUv + px * vec2(-1, -1));
  float tc = linearize(vUv + px * vec2( 0, -1));
  float tr = linearize(vUv + px * vec2( 1, -1));
  float ml = linearize(vUv + px * vec2(-1,  0));
  float mr = linearize(vUv + px * vec2( 1,  0));
  float bl = linearize(vUv + px * vec2(-1,  1));
  float bc = linearize(vUv + px * vec2( 0,  1));
  float br = linearize(vUv + px * vec2( 1,  1));

  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float g = sqrt(gx * gx + gy * gy);

  float edge = smoothstep(uThreshold, uThreshold * 2.0, g);

  vec3 outCol = mix(col, uInkColor, edge * uInkStrength);
  gl_FragColor = vec4(outCol, 1.0);
}
