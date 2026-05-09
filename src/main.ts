import * as THREE from 'three';
import { loadGraph, subscribeGraphUpdates } from './data/graphLoader';
import { World } from './world/World';
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
camera.position.set(0, 12, 38);
camera.lookAt(0, 0, 0);

const world = new World(renderer);

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
let cameraAngle = 0;

function loop(): void {
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;

  // Temporary M2 auto-orbit; replaced by yaw-based 3rd-person rig in M3.
  cameraAngle += dt * 0.07;
  const r = 32 + Math.sin(time * 0.13) * 4;
  const focus = world.graph.centerOfMass();
  camera.position.set(
    focus.x + Math.cos(cameraAngle) * r,
    focus.y + 8 + Math.sin(cameraAngle * 0.7) * 3,
    focus.z + Math.sin(cameraAngle) * r,
  );
  camera.lookAt(focus);
  // Park Cleo near the focus, tangent to the orbit so she's nicely framed.
  world.avatar.setPose(
    new THREE.Vector3(focus.x, focus.y - 1, focus.z),
    cameraAngle + Math.PI * 0.5,
  );

  world.update(dt, time);
  renderer.render(world.scene, camera);
  requestAnimationFrame(loop);
}

(async () => {
  try {
    const { graph, source } = await loadGraph();
    world.setGraphData(graph);
    console.info(`[galaxy] loaded ${graph.nodes.length} nodes / ${graph.links.length} links from ${source.url}${source.isSample ? ' (sample)' : ''}`);

    // Bake env cube before loading Cleo so her materials grab it.
    world.bakeEnv(renderer);

    // Cleo loads in parallel; if she fails we still want the galaxy visible.
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
