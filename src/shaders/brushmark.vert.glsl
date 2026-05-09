attribute vec3 iAnchor;
attribute float iSeed;
attribute float iScale;

uniform float uScale;

varying vec2 vUv;
varying float vSeed;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  vSeed = iSeed;

  // Billboard with a per-instance roll so brushes have varied orientations.
  float a = iSeed * 6.2831853;
  vec2 rot = vec2(position.x * cos(a) - position.y * sin(a),
                  position.x * sin(a) + position.y * cos(a));

  vec3 right = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 up    = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

  float s = uScale * iScale;
  vec3 worldPos = iAnchor + (right * rot.x + up * rot.y) * s;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
