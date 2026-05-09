import * as THREE from 'three';
import { loadGraph, subscribeGraphUpdates } from './data/graphLoader';
import { World } from './world/World';
import { Controls } from './world/Controls';
import { Picker } from './world/Picker';
import { Hud } from './ui/hud';
import { params } from './state/params';

const appEl = document.getElementById('app') as HTMLElement;
const bootEl = document.getElementById('boot') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
    if (node) {
      void hud.openCard(node);
    }
    return;
  }
  // Don't lock if user clicked over the card or the card is open.
  if (hud.isCardOpen) return;
  if (e.target !== renderer.domElement) return;
  controls.requestLock();
});

hud.setOnNeighborClick((id) => {
  const idx = world.graph.nodeRuntimes.findIndex((n) => n.id === id);
  if (idx < 0) return;
  const target = world.graph.nodeRuntimes[idx]?.data;
  if (target) void hud.openCard(target);
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && hud.isCardOpen) hud.closeCard();
});

function onResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = params.camera.fov;
  camera.near = params.camera.near;
  camera.far = params.camera.far;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();

function loop(): void {
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;

  controls.update(dt);
  world.update(dt, time);
  picker.update();

  renderer.render(world.scene, camera);
  requestAnimationFrame(loop);
}

(async () => {
  try {
    const { graph, source } = await loadGraph();
    world.setGraphData(graph);
    console.info(`[galaxy] loaded ${graph.nodes.length} nodes / ${graph.links.length} links from ${source.url}${source.isSample ? ' (sample)' : ''}`);

    world.bakeEnv(renderer);

    // Place Cleo at the graph's center of mass for a nice opening shot.
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
