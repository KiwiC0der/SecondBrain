attribute vec3 iPosition;
attribute float iSeed;
attribute float iSize;

uniform float uTime;
uniform float uSize;
uniform float uTwinkle;

varying vec2  vUv;
varying float vSeed;
varying float vTwinkle;

void main() {
  // position is the per-vertex quad corner in [-1, 1]
  vUv = position.xy * 0.5 + 0.5;
  vSeed = iSeed;

  // Twinkle term in [1 - uTwinkle, 1]
  vTwinkle = 1.0 - uTwinkle * (0.5 - 0.5 * cos(uTime * (1.5 + iSeed * 4.0) + iSeed * 17.0));

  // Billboard: use camera basis from view matrix (rows are camera right/up/-forward in world)
  vec3 right = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 up    = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

  float s = uSize * iSize;
  vec3 worldPos = iPosition + (right * position.x + up * position.y) * s;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
