import * as THREE from 'three';

/**
 * Renders a nebula sky-sphere into a cube render target so we can use it as
 * scene.environment / IBL. Updated once on demand (and cheaply, off-frame) so
 * Cleo's reflections + irradiance always match the painterly background.
 */
export class Env {
  readonly target: THREE.WebGLCubeRenderTarget;
  private cubeCamera: THREE.CubeCamera;
  private envScene: THREE.Scene;

  constructor(renderer: THREE.WebGLRenderer, nebulaMaterial: THREE.ShaderMaterial, size = 128) {
    void renderer;
    this.target = new THREE.WebGLCubeRenderTarget(size, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    this.cubeCamera = new THREE.CubeCamera(0.1, 5000, this.target);

    this.envScene = new THREE.Scene();
    // Use a clone of the nebula material that shares uniforms (so palette changes propagate).
    const cloned = new THREE.ShaderMaterial({
      vertexShader: nebulaMaterial.vertexShader,
      fragmentShader: nebulaMaterial.fragmentShader,
      uniforms: nebulaMaterial.uniforms, // share by reference
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), cloned);
    sky.frustumCulled = false;
    this.envScene.add(sky);
  }

  /** Render the env cube (call sparingly — once at start, on big palette changes). */
  bake(renderer: THREE.WebGLRenderer): void {
    this.cubeCamera.update(renderer, this.envScene);
  }

  get texture(): THREE.CubeTexture {
    return this.target.texture;
  }

  dispose(): void {
    this.target.dispose();
    this.envScene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
  }
}
