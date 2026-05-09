import * as THREE from 'three';
import nebulaVert from '../shaders/nebula.vert.glsl?raw';
import nebulaFrag from '../shaders/nebula.frag.glsl?raw';
import starsVert from '../shaders/stars.vert.glsl?raw';
import starsFrag from '../shaders/stars.frag.glsl?raw';
import brushVert from '../shaders/brushmark.vert.glsl?raw';
import brushFrag from '../shaders/brushmark.frag.glsl?raw';
import { params } from '../state/params';

const NEBULA_RADIUS = 1500;
const STAR_INNER = 600;
const STAR_OUTER = 1100;
const BRUSH_RADIUS = 450;

export class Galaxy {
  readonly group = new THREE.Group();

  private nebulaMat: THREE.ShaderMaterial;
  private starsMat: THREE.ShaderMaterial;
  private brushMat: THREE.ShaderMaterial;

  private starsMesh: THREE.Mesh | null = null;
  private brushMesh: THREE.Mesh | null = null;

  private currentStarCount = 0;
  private currentBrushCount = 0;

  constructor() {
    this.group.name = 'Galaxy';

    // --- Nebula sky-sphere ---
    this.nebulaMat = new THREE.ShaderMaterial({
      vertexShader: nebulaVert,
      fragmentShader: nebulaFrag,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      transparent: false,
      uniforms: {
        uTime: { value: 0 },
        uPaletteA: { value: params.galaxy.paletteA.clone() },
        uPaletteB: { value: params.galaxy.paletteB.clone() },
        uPaletteC: { value: params.galaxy.paletteC.clone() },
        uPaletteD: { value: params.galaxy.paletteD.clone() },
        uContrast: { value: params.galaxy.contrast },
        uDensity: { value: params.galaxy.density },
        uSwirl: { value: params.galaxy.swirl },
        uDrift: { value: params.galaxy.drift },
        uCoreOffset: { value: params.galaxy.coreOffset.clone() },
        uOctaves: { value: params.galaxy.octaves },
      },
    });
    const nebulaGeo = new THREE.SphereGeometry(NEBULA_RADIUS, 64, 32);
    const nebula = new THREE.Mesh(nebulaGeo, this.nebulaMat);
    nebula.frustumCulled = false;
    nebula.renderOrder = -1000;
    this.group.add(nebula);

    // --- Star material (built; mesh lazily built/rebuilt by rebuildStars) ---
    this.starsMat = new THREE.ShaderMaterial({
      vertexShader: starsVert,
      fragmentShader: starsFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: params.galaxy.starSize },
        uTwinkle: { value: params.galaxy.starTwinkle },
      },
    });

    // --- Brush mark material ---
    this.brushMat = new THREE.ShaderMaterial({
      vertexShader: brushVert,
      fragmentShader: brushFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: params.galaxy.brushScale * 120.0 },
        uOpacity: { value: params.galaxy.brushOpacity },
        uPaletteA: { value: params.galaxy.paletteA.clone() },
        uPaletteB: { value: params.galaxy.paletteB.clone() },
        uPaletteC: { value: params.galaxy.paletteC.clone() },
        uPaletteD: { value: params.galaxy.paletteD.clone() },
      },
    });

    this.rebuildStars();
    this.rebuildBrushes();
  }

  /** Cube target uses this material; expose for env baking. */
  get nebulaMaterial(): THREE.ShaderMaterial {
    return this.nebulaMat;
  }

  private rebuildStars(): void {
    const count = Math.max(0, params.galaxy.starCount | 0);
    if (this.starsMesh) {
      this.group.remove(this.starsMesh);
      this.starsMesh.geometry.dispose();
      this.starsMesh = null;
    }
    if (count === 0) {
      this.currentStarCount = 0;
      return;
    }

    const quad = new THREE.PlaneGeometry(1, 1, 1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.setIndex(quad.getIndex());

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    let rng = 1234567;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 0xffffffff;
    };
    for (let i = 0; i < count; i++) {
      // Sample on a thick spherical shell.
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const r = STAR_INNER + (STAR_OUTER - STAR_INNER) * Math.pow(rand(), 0.7);
      const sinT = Math.sqrt(1 - u * u);
      positions[i * 3 + 0] = r * sinT * Math.cos(phi);
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * sinT * Math.sin(phi);
      seeds[i] = rand();
      sizes[i] = 0.6 + rand() * rand() * 4.5;
    }
    geo.setAttribute('iPosition', new THREE.InstancedBufferAttribute(positions, 3));
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(sizes, 1));
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), STAR_OUTER * 1.05);

    this.starsMesh = new THREE.Mesh(geo, this.starsMat);
    this.starsMesh.frustumCulled = false;
    this.starsMesh.renderOrder = -800;
    this.group.add(this.starsMesh);
    this.currentStarCount = count;
  }

  private rebuildBrushes(): void {
    const count = Math.max(0, params.galaxy.brushCount | 0);
    if (this.brushMesh) {
      this.group.remove(this.brushMesh);
      this.brushMesh.geometry.dispose();
      this.brushMesh = null;
    }
    if (count === 0) {
      this.currentBrushCount = 0;
      return;
    }

    const quad = new THREE.PlaneGeometry(1, 1, 1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.setIndex(quad.getIndex());

    const anchors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const scales = new Float32Array(count);
    let rng = 7654321;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 0xffffffff;
    };
    for (let i = 0; i < count; i++) {
      // Place anchors on an inner sphere; bias toward two galactic-core anchors.
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const sinT = Math.sqrt(1 - u * u);
      const r = BRUSH_RADIUS * (0.85 + rand() * 0.3);
      anchors[i * 3 + 0] = r * sinT * Math.cos(phi);
      anchors[i * 3 + 1] = r * u * 0.55;
      anchors[i * 3 + 2] = r * sinT * Math.sin(phi);
      seeds[i] = rand();
      scales[i] = 0.6 + rand() * 1.4;
    }
    geo.setAttribute('iAnchor', new THREE.InstancedBufferAttribute(anchors, 3));
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(scales, 1));
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), BRUSH_RADIUS * 1.5);

    this.brushMesh = new THREE.Mesh(geo, this.brushMat);
    this.brushMesh.frustumCulled = false;
    this.brushMesh.renderOrder = -600;
    this.group.add(this.brushMesh);
    this.currentBrushCount = count;
  }

  /** Push current params -> shader uniforms. Cheap, call every frame. */
  syncUniforms(time: number): void {
    const g = params.galaxy;
    const u = this.nebulaMat.uniforms;
    u.uTime!.value = time;
    (u.uPaletteA!.value as THREE.Color).copy(g.paletteA);
    (u.uPaletteB!.value as THREE.Color).copy(g.paletteB);
    (u.uPaletteC!.value as THREE.Color).copy(g.paletteC);
    (u.uPaletteD!.value as THREE.Color).copy(g.paletteD);
    u.uContrast!.value = g.contrast;
    u.uDensity!.value = g.density;
    u.uSwirl!.value = g.swirl;
    u.uDrift!.value = g.drift;
    (u.uCoreOffset!.value as THREE.Vector2).copy(g.coreOffset);
    u.uOctaves!.value = g.octaves;

    const sU = this.starsMat.uniforms;
    sU.uTime!.value = time;
    sU.uSize!.value = g.starSize;
    sU.uTwinkle!.value = g.starTwinkle;

    const bU = this.brushMat.uniforms;
    bU.uTime!.value = time;
    bU.uScale!.value = g.brushScale * 120.0;
    bU.uOpacity!.value = g.brushOpacity;
    (bU.uPaletteA!.value as THREE.Color).copy(g.paletteA);
    (bU.uPaletteB!.value as THREE.Color).copy(g.paletteB);
    (bU.uPaletteC!.value as THREE.Color).copy(g.paletteC);
    (bU.uPaletteD!.value as THREE.Color).copy(g.paletteD);

    if (g.starCount !== this.currentStarCount) this.rebuildStars();
    if (g.brushCount !== this.currentBrushCount) this.rebuildBrushes();
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
    });
    this.nebulaMat.dispose();
    this.starsMat.dispose();
    this.brushMat.dispose();
  }
}
