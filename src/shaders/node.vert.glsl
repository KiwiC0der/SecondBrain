attribute vec3 iPosition;
attribute vec3 iColor;
attribute float iSize;
attribute float iGlow;
attribute float iSeed;

uniform float uTime;

varying vec2  vUv;
varying vec3  vColor;
varying float vGlow;
varying float vSeed;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  vColor = iColor;
  vGlow = iGlow;
  vSeed = iSeed;

  vec3 right = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 up    = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

  // Subtle per-node breathe so the painting feels alive (not too fast).
  float breathe = 1.0 + 0.06 * sin(uTime * (0.7 + iSeed * 1.3) + iSeed * 11.0);
  float s = iSize * breathe;

  vec3 worldPos = iPosition + (right * position.x + up * position.y) * s;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
