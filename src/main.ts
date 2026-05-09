import * as THREE from 'three';
import { loadGraph, subscribeGraphUpdates } from './data/graphLoader';
import type { Graph, GraphNode } from './data/types';

const appEl = document.getElementById('app') as HTMLElement;
const bootEl = document.getElementById('boot') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06070b);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 30, 90);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(40, 60, 40);
scene.add(key);

const CATEGORY_COLOR: Record<string, number> = {
  concepts: 0xb8a6ff,
  sources: 0xffd28b,
  entities: 0x8be0c0,
  syntheses: 0xff9ab1,
  other: 0xc0c4cc,
};

interface NodeMeshes {
  group: THREE.Group;
  nodes: Map<string, THREE.Mesh>;
}

function buildNodes(graph: Graph): NodeMeshes {
  const group = new THREE.Group();
  const nodes = new Map<string, THREE.Mesh>();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const maxDegree = Math.max(1, ...graph.nodes.map((n) => n.degree));

  for (const n of graph.nodes) {
    const sizeT = (n.degree + 1) / (maxDegree + 1);
    const radius = 0.6 + 1.6 * Math.pow(sizeT, 0.65);
    const color = new THREE.Color(CATEGORY_COLOR[n.category] ?? CATEGORY_COLOR.other);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4 + 0.8 * sizeT,
      roughness: 0.6,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(radius);
    mesh.userData['nodeId'] = n.id;
    mesh.position.copy(seedPosition(n));
    group.add(mesh);
    nodes.set(n.id, mesh);
  }
  return { group, nodes };
}

function seedPosition(n: GraphNode): THREE.Vector3 {
  // Deterministic-ish seed so nodes don't move every load.
  let h = 2166136261;
  for (let i = 0; i < n.id.length; i++) h = Math.imul(h ^ n.id.charCodeAt(i), 16777619);
  const r = 30 + ((h >>> 0) % 1000) / 50;
  const theta = ((h >>> 8) % 1000) / 1000 * Math.PI * 2;
  const phi = (((h >>> 16) % 1000) / 1000) * Math.PI - Math.PI / 2;
  return new THREE.Vector3(
    r * Math.cos(phi) * Math.cos(theta),
    r * Math.sin(phi) * 0.4,
    r * Math.cos(phi) * Math.sin(theta),
  );
}

function buildLinks(graph: Graph, nodes: Map<string, THREE.Mesh>): THREE.LineSegments {
  const positions: number[] = [];
  for (const link of graph.links) {
    const a = nodes.get(link.source);
    const b = nodes.get(link.target);
    if (!a || !b) continue;
    positions.push(a.position.x, a.position.y, a.position.z, b.position.x, b.position.y, b.position.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x6675a8, transparent: true, opacity: 0.45 });
  return new THREE.LineSegments(geo, mat);
}

let world: THREE.Group | null = null;

function applyGraph(graph: Graph): void {
  if (world) {
    scene.remove(world);
    world.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose?.());
      else mat?.dispose?.();
    });
  }
  const built = buildNodes(graph);
  const links = buildLinks(graph, built.nodes);
  world = new THREE.Group();
  world.add(built.group);
  world.add(links);
  scene.add(world);
}

const clock = new THREE.Clock();
let cameraAngle = 0;

function loop(): void {
  const dt = clock.getDelta();
  cameraAngle += dt * 0.05;
  const r = 100;
  camera.position.x = Math.cos(cameraAngle) * r;
  camera.position.z = Math.sin(cameraAngle) * r;
  camera.position.y = 35 + Math.sin(cameraAngle * 0.7) * 10;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function onResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

(async () => {
  try {
    const { graph, source } = await loadGraph();
    applyGraph(graph);
    console.info(`[galaxy] loaded ${graph.nodes.length} nodes / ${graph.links.length} links from ${source.url}${source.isSample ? ' (sample)' : ''}`);
    bootEl.classList.add('gone');
    requestAnimationFrame(loop);

    subscribeGraphUpdates((g) => {
      console.info(`[galaxy] live graph update: ${g.nodes.length} nodes / ${g.links.length} links`);
      applyGraph(g);
    });
  } catch (err) {
    bootEl.textContent = `failed to load graph: ${(err as Error).message}`;
    console.error(err);
  }
})();
