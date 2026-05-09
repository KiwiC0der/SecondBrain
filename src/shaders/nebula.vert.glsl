varying vec3 vWorldDir;

void main() {
  // Place vertex at a far-ish radius so depth ordering is unambiguous;
  // use the position direction (normalized) as the sampling direction.
  vWorldDir = normalize(position);
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPos;
}
