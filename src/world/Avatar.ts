import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { params } from '../state/params';

interface CustomUniforms {
  uRimStrength: { value: number };
  uRimPower: { value: number };
  uRimTint: { value: THREE.Color };
  uToonBands: { value: number };
  uToonSoftness: { value: number };
  uPaperGrain: { value: number };
  uTime: { value: number };
}

export class Avatar {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  /** Cleo's facing yaw in world space (radians). */
  yaw = 0;

  private root: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: THREE.AnimationAction[] = [];
  private customMaterials: { mat: THREE.MeshStandardMaterial; uniforms: CustomUniforms }[] = [];
  private envMap: THREE.CubeTexture | null = null;

  constructor() {
    this.group.name = 'Avatar';
  }

  setEnvMap(envMap: THREE.CubeTexture): void {
    this.envMap = envMap;
    for (const { mat } of this.customMaterials) {
      mat.envMap = envMap;
      mat.needsUpdate = true;
    }
  }

  async load(url: string): Promise<void> {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const gltf = await loader.loadAsync(url);
    this.root = gltf.scene;
    this.root.name = 'CleoRoot';

    // Bounding box -> normalize Cleo's footprint to roughly 2 units tall, foot at y=0.
    const box = new THREE.Box3().setFromObject(this.root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetHeight = 2.0;
    const scale = size.y > 0 ? targetHeight / size.y : 1.0;
    this.root.scale.setScalar(scale);
    const minY = box.min.y * scale;
    this.root.position.y = -minY;

    // Wrap in an extra group so we can rotate Cleo without disturbing the foot offset.
    const inner = new THREE.Group();
    inner.add(this.root);
    this.group.add(inner);

    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const m = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const list = Array.isArray(m) ? m : [m];
      const wrapped: THREE.Material[] = [];
      for (const orig of list) {
        wrapped.push(this.wrapPainterly(orig));
      }
      mesh.material = Array.isArray(m) ? wrapped : wrapped[0]!;
    });

    // Animation
    if (gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.root);
      const preferred = gltf.animations.find((c) => /fly|idle|hover/i.test(c.name)) ?? gltf.animations[0]!;
      const action = this.mixer.clipAction(preferred);
      action.play();
      this.actions.push(action);
    }
  }

  private wrapPainterly(orig: THREE.Material): THREE.Material {
    // We want IBL + toon banding + rim + paper grain. MeshStandardMaterial supports IBL;
    // we inject the rest via onBeforeCompile so we keep skinning, morphs, normal maps, etc.
    const mat = orig.clone() as THREE.MeshStandardMaterial;
    if (!(mat as any).isMeshStandardMaterial) {
      // Fall back to a fresh MeshStandardMaterial built from whatever we can salvage.
      const fallback = new THREE.MeshStandardMaterial({
        color: (orig as any).color ?? new THREE.Color(0xffffff),
        map: (orig as any).map ?? null,
      });
      return this.wrapPainterly(fallback);
    }
    if (this.envMap) mat.envMap = this.envMap;
    mat.envMapIntensity = params.env.intensity;
    mat.roughness = Math.min(1.0, (mat.roughness ?? 0.7) + 0.15);
    mat.metalness = Math.max(0.0, (mat.metalness ?? 0.0) * 0.5);

    const customUniforms: CustomUniforms = {
      uRimStrength: { value: params.env.rimStrength },
      uRimPower: { value: params.env.rimPower },
      uRimTint: { value: params.env.rimTint.clone() },
      uToonBands: { value: params.env.toonBands },
      uToonSoftness: { value: params.env.toonSoftness },
      uPaperGrain: { value: params.env.paperGrain },
      uTime: { value: 0 },
    };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRimStrength = customUniforms.uRimStrength;
      shader.uniforms.uRimPower = customUniforms.uRimPower;
      shader.uniforms.uRimTint = customUniforms.uRimTint;
      shader.uniforms.uToonBands = customUniforms.uToonBands;
      shader.uniforms.uToonSoftness = customUniforms.uToonSoftness;
      shader.uniforms.uPaperGrain = customUniforms.uPaperGrain;
      shader.uniforms.uTime = customUniforms.uTime;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPosForPaint;
varying vec3 vWorldNormalForPaint;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vWorldPosForPaint = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWorldNormalForPaint = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform float uRimStrength;
uniform float uRimPower;
uniform vec3  uRimTint;
uniform float uToonBands;
uniform float uToonSoftness;
uniform float uPaperGrain;
uniform float uTime;
varying vec3 vWorldPosForPaint;
varying vec3 vWorldNormalForPaint;

float paintHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}`,
      );

      // Quantize the diffuse light into N bands for a toon-painted look.
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
        `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
{
  float lum = dot(totalDiffuse, vec3(0.299, 0.587, 0.114));
  float bands = max(1.0, uToonBands);
  float qLum = floor(lum * bands) / bands;
  qLum += smoothstep(0.0, uToonSoftness, fract(lum * bands)) / bands;
  totalDiffuse *= qLum / max(lum, 0.0001);
}`,
      );

      // Inject rim + paper grain at the very end of the fragment.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <colorspace_fragment>',
        `// painterly rim
{
  vec3 V = normalize(cameraPosition - vWorldPosForPaint);
  float fres = pow(1.0 - clamp(dot(normalize(vWorldNormalForPaint), V), 0.0, 1.0), uRimPower);
  gl_FragColor.rgb += uRimTint * fres * uRimStrength;
}
// paper grain
{
  float g = paintHash(vWorldPosForPaint * 80.0 + vec3(uTime * 0.05));
  gl_FragColor.rgb *= mix(1.0 - uPaperGrain, 1.0 + uPaperGrain, g);
}
#include <colorspace_fragment>`,
      );
    };

    this.customMaterials.push({ mat, uniforms: customUniforms });
    return mat;
  }

  update(dt: number, time: number): void {
    if (this.mixer) this.mixer.update(dt);

    // Bob and bank.
    const inner = this.group.children[0] as THREE.Group | undefined;
    if (inner) {
      const speed = this.velocity.length();
      const bob = Math.sin(time * 1.6) * params.avatar.bobAmp;
      // Lateral velocity in avatar-local coords (rotated by yaw).
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      const localX = this.velocity.x * cos - this.velocity.z * sin;
      const localY = this.velocity.y;
      const bank = -localX * 0.06 * params.avatar.bankAmount;
      const pitch = -localY * 0.04;
      inner.rotation.set(pitch, this.yaw, bank);
      inner.position.y = bob;
      void speed;
    }

    for (const { mat, uniforms } of this.customMaterials) {
      uniforms.uTime.value = time;
      uniforms.uRimStrength.value = params.env.rimStrength;
      uniforms.uRimPower.value = params.env.rimPower;
      (uniforms.uRimTint.value as THREE.Color).copy(params.env.rimTint);
      uniforms.uToonBands.value = params.env.toonBands;
      uniforms.uToonSoftness.value = params.env.toonSoftness;
      uniforms.uPaperGrain.value = params.env.paperGrain;
      mat.envMapIntensity = params.env.intensity;
    }
  }

  /** Sets the avatar's world position and yaw. */
  setPose(position: THREE.Vector3, yaw: number): void {
    this.group.position.copy(position);
    this.yaw = yaw;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose?.());
      else mat?.dispose?.();
    });
  }
}
