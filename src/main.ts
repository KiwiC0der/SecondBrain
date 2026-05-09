import * as THREE from 'three';
import { loadGraph, subscribeGraphUpdates } from './data/graphLoader';
import { World } from './world/World';
import { Controls } from './world/Controls';
import { Picker } from './world/Picker';
import { Hud } from './ui/hud';
import { Pipeline } from './post/Pipeline';
import { Tweaks } from './ui/tweaks';
import { params } from './state/params';

const appEl = document.getElementById('app') as HTMLElement;
const bootEl = document.getElementById('boot') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
appEl.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  params.camera.fov,
  window.innerWidth / window.innerHeight,
  params.camera.near,
  params.camera.far,
);

const world = new World(renderer);
const controls = new Controls(world.avatar, camera, renderer.domElement);
const picker = new Picker(world.graph, camera, renderer.domElement);
const hud = new Hud();
const pipeline = new Pipeline(renderer, world.scene, camera);

picker.onChange((index) => {
  const node = index >= 0 ? world.graph.nodeRuntimes[index]?.data ?? null : null;
  world.graph.setHoveredIndex(index);
  if (node) {
    const px = picker.mousePixelPos;
    hud.showTooltip(node, px.x, px.y);
  } else {
    hud.showTooltip(null, 0, 0);
  }
});

renderer.domElement.addEventListener('click', (e) => {
  const pick = picker.pickFromMousePixel();
  if (pick) {
    const node = world.graph.nodeRuntimes[pick.index]?.data;
    if (node) void hud.openCard(node);
    return;
  }
  if (hud.isCardOpen) return;
  if (e.target !== renderer.domElement) return;
  controls.requestLock();
});

hud.setOnNeighborClick((id) => {
  const target = world.graph.nodeRuntimes.find((n) => n.id === id)?.data;
  if (target) void hud.openCard(target);
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && hud.isCardOpen) hud.closeCard();
});

const fpsRef = { value: 60 };
let fpsAccum = 0;
let fpsCount = 0;
const fpsBadge = document.createElement('div');
fpsBadge.style.cssText =
  'position:fixed;top:14px;left:14px;padding:4px 10px;background:rgba(8,10,18,0.55);' +
  'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#cfd0e6;' +
  'font:12px ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;' +
  'border:1px solid rgba(255,255,255,0.08);border-radius:999px;z-index:5;' +
  'pointer-events:none;transition:opacity 0.2s ease;';
fpsBadge.textContent = '60 fps';
document.body.appendChild(fpsBadge);

const tweaks = new Tweaks({
  onForceRebuild: () => world.forces.rebuild(),
  fpsRef,
});
void tweaks;

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = params.camera.fov;
  camera.near = params.camera.near;
  camera.far = params.camera.far;
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h);
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();

function loop(): void {
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;

  fpsAccum += dt > 0 ? 1 / dt : 0;
  fpsCount += 1;
  if (fpsCount >= 12) {
    fpsRef.value = fpsAccum / fpsCount;
    fpsAccum = 0;
    fpsCount = 0;
    fpsBadge.textContent = `${Math.round(fpsRef.value)} fps`;
  }
  fpsBadge.style.opacity = params.debug.showFps ? '1' : '0';

  if (camera.fov !== params.camera.fov || camera.near !== params.camera.near || camera.far !== params.camera.far) {
    camera.fov = params.camera.fov;
    camera.near = params.camera.near;
    camera.far = params.camera.far;
    camera.updateProjectionMatrix();
  }

  controls.update(dt);
  world.update(dt, time);
  picker.update();

  pipeline.render(time);
  requestAnimationFrame(loop);
}

(async () => {
  try {
    const { graph, source } = await loadGraph();
    world.setGraphData(graph);
    console.info(
      `[galaxy] loaded ${graph.nodes.length} nodes / ${graph.links.length} links from ${source.url}${source.isSample ? ' (sample)' : ''}`,
    );

    world.bakeEnv(renderer);

    const com = world.graph.centerOfMass();
    controls.setInitialPose(com.clone(), 0);

    void world.loadAvatar('/cleo.glb').catch((err) => {
      console.warn('[galaxy] avatar load failed:', err);
    });

    bootEl.classList.add('gone');
    requestAnimationFrame(loop);

    subscribeGraphUpdates((g) => {
      console.info(`[galaxy] live graph update: ${g.nodes.length} nodes / ${g.links.length} links`);
      world.setGraphData(g);
    });
  } catch (err) {
    bootEl.textContent = `failed to load: ${(err as Error).message}`;
    console.error(err);
  }
})();
