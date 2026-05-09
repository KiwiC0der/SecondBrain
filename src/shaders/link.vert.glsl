attribute vec3 iStart;
attribute vec3 iEnd;
attribute float iSeed;
attribute float iWidth;

uniform float uTime;
uniform float uWobbleAmp;
uniform float uWobbleSpeed;

varying vec2 vUv;
varying float vSeed;

float hash11(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  // position.x in [-0.5, 0.5] = along edge (u), position.y in [-0.5, 0.5] = across (v)
  float u = position.x + 0.5;          // 0..1
  float v = position.y;                // -0.5..0.5
  vUv = vec2(u, v + 0.5);
  vSeed = iSeed;

  vec3 mid = mix(iStart, iEnd, u);

  // Wobble: gentle world-space displacement perpendicular to view, sin-curve along edge.
  vec3 dir = normalize(iEnd - iStart);
  vec3 viewDir = normalize(cameraPosition - mid);
  vec3 side = normalize(cross(dir, viewDir));

  float lateralWobble = sin(u * 6.2831853 * (1.0 + 0.5 * hash11(iSeed)) + uTime * uWobbleSpeed + iSeed * 23.0);
  // Stronger in the middle, faded at endpoints so we don't tear off the nodes.
  float endpointFade = sin(u * 3.14159);
  vec3 wobbleOffset = side * (lateralWobble * uWobbleAmp * endpointFade);

  vec3 worldPos = mid + side * (v * iWidth) + wobbleOffset;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
