import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { params } from '../state/params';

import kuwaharaFrag from '../shaders/post/kuwahara.frag.glsl?raw';
import outlineFrag from '../shaders/post/outline.frag.glsl?raw';
import chromaticFrag from '../shaders/post/chromatic.frag.glsl?raw';
import grainFrag from '../shaders/post/grain.frag.glsl?raw';
import composeFrag from '../shaders/post/compose.frag.glsl?raw';

const baseVertex = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export class Pipeline {
  readonly composer: EffectComposer;
  private renderTarget: THREE.WebGLRenderTarget;
  private renderer: THREE.WebGLRenderer;

  private renderPass: RenderPass;
  private kuwaharaPass: ShaderPass;
  private outlinePass: ShaderPass;
  private bloomPass: UnrealBloomPass;
  private chromaticPass: ShaderPass;
  private grainPass: ShaderPass;
  private composePass: ShaderPass;
  private outputPass: OutputPass;

  private camera: THREE.PerspectiveCamera;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.camera = camera;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(size.x, size.y),
    });

    this.composer = new EffectComposer(renderer, this.renderTarget);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.kuwaharaPass = new ShaderPass({
      vertexShader: baseVertex,
      fragmentShader: kuwaharaFrag,
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(size.x, size.y) },
        uRadius: { value: params.post.kuwahara.radius },
      },
    });
    this.composer.addPass(this.kuwaharaPass);

    this.outlinePass = new ShaderPass({
      vertexShader: baseVertex,
      fragmentShader: outlineFrag,
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: this.renderTarget.depthTexture },
        uResolution: { value: new THREE.Vector2(size.x, size.y) },
        uThickness: { value: params.post.outline.thickness },
        uThreshold: { value: params.post.outline.threshold },
        uInkColor: { value: params.post.outline.inkColor.clone() },
        uInkStrength: { value: params.post.outline.strength },
        uCameraNear: { value: camera.near },
        uCameraFar: { value: camera.far },
      },
    });
    this.composer.addPass(this.outlinePass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      params.post.bloom.strength,
      params.post.bloom.radius,
      params.post.bloom.threshold,
    );
    this.composer.addPass(this.bloomPass);

    this.chromaticPass = new ShaderPass({
      vertexShader: baseVertex,
      fragmentShader: chromaticFrag,
      uniforms: {
        tDiffuse: { value: null },
        uAmount: { value: params.post.chromatic.amount },
        uFalloff: { value: params.post.chromatic.falloff },
      },
    });
    this.composer.addPass(this.chromaticPass);

    this.grainPass = new ShaderPass({
      vertexShader: baseVertex,
      fragmentShader: grainFrag,
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: params.post.grain.intensity },
        uScale: { value: params.post.grain.scale },
        uMode: { value: params.post.grain.paper ? 1 : 0 },
      },
    });
    this.composer.addPass(this.grainPass);

    this.composePass = new ShaderPass({
      vertexShader: baseVertex,
      fragmentShader: composeFrag,
      uniforms: {
        tDiffuse: { value: null },
        uVignetteAmount: { value: params.post.compose.vignette },
        uVignetteSoftness: { value: params.post.compose.vignetteSoftness },
        uHueShift: { value: params.post.compose.hueShift },
        uSat: { value: params.post.compose.sat },
        uContrast: { value: params.post.compose.contrast },
        uLift: { value: params.post.compose.lift },
        uGamma: { value: params.post.compose.gamma },
        uGain: { value: params.post.compose.gain },
      },
    });
    this.composer.addPass(this.composePass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    const dpr = this.renderer.getPixelRatio();
    this.renderTarget.setSize(width * dpr, height * dpr);
    const res = new THREE.Vector2(width * dpr, height * dpr);
    (this.kuwaharaPass.material.uniforms.uResolution!.value as THREE.Vector2).copy(res);
    (this.outlinePass.material.uniforms.uResolution!.value as THREE.Vector2).copy(res);
    this.bloomPass.setSize(width, height);
  }

  syncParams(time: number): void {
    const p = params.post;

    this.kuwaharaPass.enabled = p.kuwahara.enabled;
    this.kuwaharaPass.material.uniforms.uRadius!.value = p.kuwahara.radius;

    this.outlinePass.enabled = p.outline.enabled;
    this.outlinePass.material.uniforms.uThickness!.value = p.outline.thickness;
    this.outlinePass.material.uniforms.uThreshold!.value = p.outline.threshold;
    (this.outlinePass.material.uniforms.uInkColor!.value as THREE.Color).copy(p.outline.inkColor);
    this.outlinePass.material.uniforms.uInkStrength!.value = p.outline.strength;
    this.outlinePass.material.uniforms.uCameraNear!.value = this.camera.near;
    this.outlinePass.material.uniforms.uCameraFar!.value = this.camera.far;

    this.bloomPass.enabled = p.bloom.enabled;
    this.bloomPass.threshold = p.bloom.threshold;
    this.bloomPass.strength = p.bloom.strength;
    this.bloomPass.radius = p.bloom.radius;

    this.chromaticPass.enabled = p.chromatic.enabled;
    this.chromaticPass.material.uniforms.uAmount!.value = p.chromatic.amount;
    this.chromaticPass.material.uniforms.uFalloff!.value = p.chromatic.falloff;

    this.grainPass.enabled = p.grain.enabled;
    this.grainPass.material.uniforms.uTime!.value = time;
    this.grainPass.material.uniforms.uIntensity!.value = p.grain.intensity;
    this.grainPass.material.uniforms.uScale!.value = p.grain.scale;
    this.grainPass.material.uniforms.uMode!.value = p.grain.paper ? 1 : 0;

    this.composePass.enabled = p.compose.enabled;
    this.composePass.material.uniforms.uVignetteAmount!.value = p.compose.vignette;
    this.composePass.material.uniforms.uVignetteSoftness!.value = p.compose.vignetteSoftness;
    this.composePass.material.uniforms.uHueShift!.value = p.compose.hueShift;
    this.composePass.material.uniforms.uSat!.value = p.compose.sat;
    this.composePass.material.uniforms.uContrast!.value = p.compose.contrast;
    this.composePass.material.uniforms.uLift!.value = p.compose.lift;
    this.composePass.material.uniforms.uGamma!.value = p.compose.gamma;
    this.composePass.material.uniforms.uGain!.value = p.compose.gain;
  }

  render(time: number): void {
    this.syncParams(time);
    this.composer.render();
  }

  dispose(): void {
    this.renderTarget.dispose();
    this.composer.dispose();
  }
}
