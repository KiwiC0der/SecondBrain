import * as THREE from 'three';
import type { Graph } from './Graph';

interface PickResult {
  index: number;
  distance: number;
  screenX: number;
  screenY: number;
}

/**
 * Screen-space picker for billboard nodes. Projects each node to NDC and finds the
 * closest one within a per-node radius (scaled by node size and inverse distance).
 *
 * O(N) per query; trivially fine for 30-30k nodes.
 */
export class Picker {
  private graph: Graph;
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private mouseNdc = new THREE.Vector2(NaN, NaN);
  private mousePixel = new THREE.Vector2();
  private hovered = -1;
  private subscribers = new Set<(index: number) => void>();

  constructor(graph: Graph, camera: THREE.Camera, domElement: HTMLElement) {
    this.graph = graph;
    this.camera = camera;
    this.domElement = domElement;
    domElement.addEventListener('mousemove', this.onMouseMove);
    domElement.addEventListener('mouseleave', this.onMouseLeave);
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement) {
      this.mouseNdc.set(NaN, NaN);
      return;
    }
    const rect = this.domElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.mousePixel.set(x, y);
    this.mouseNdc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
  };

  private onMouseLeave = (): void => {
    this.mouseNdc.set(NaN, NaN);
  };

  /** Run picking; returns the hovered index (or -1) and notifies subscribers when it changes. */
  update(): number {
    if (Number.isNaN(this.mouseNdc.x)) {
      if (this.hovered !== -1) {
        this.hovered = -1;
        this.notify();
      }
      return -1;
    }

    const result = this.pickAtNdc(this.mouseNdc.x, this.mouseNdc.y);
    const idx = result?.index ?? -1;
    if (idx !== this.hovered) {
      this.hovered = idx;
      this.notify();
    }
    return idx;
  }

  pickAtNdc(ndcX: number, ndcY: number): PickResult | null {
    const nodes = this.graph.nodeRuntimes;
    if (nodes.length === 0) return null;

    const rect = this.domElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const projected = new THREE.Vector3();
    let best: PickResult | null = null;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      projected.copy(n.position).project(this.camera);
      if (projected.z <= -1 || projected.z >= 1) continue;
      const dx = projected.x - ndcX;
      const dy = projected.y - ndcY;
      const dPx = Math.sqrt((dx * 0.5 * w) ** 2 + (dy * 0.5 * h) ** 2);

      // Estimate node screen-space radius: world size projected at the node's depth.
      const distToCam = (this.camera as THREE.PerspectiveCamera).position.distanceTo(n.position);
      const fov = (this.camera as THREE.PerspectiveCamera).fov ?? 60;
      const screenRadius = (n.baseSize * 0.65) / (2 * Math.tan((fov * 0.5 * Math.PI) / 180) * Math.max(0.1, distToCam)) * h;
      const acceptRadius = Math.max(14, screenRadius * 1.6);

      if (dPx <= acceptRadius) {
        if (!best || projected.z < best.distance) {
          best = { index: i, distance: projected.z, screenX: (projected.x * 0.5 + 0.5) * w, screenY: (-projected.y * 0.5 + 0.5) * h };
        }
      }
    }
    return best;
  }

  pickFromMousePixel(): PickResult | null {
    if (Number.isNaN(this.mouseNdc.x)) return null;
    return this.pickAtNdc(this.mouseNdc.x, this.mouseNdc.y);
  }

  get mousePixelPos(): THREE.Vector2 {
    return this.mousePixel;
  }

  get hoveredIndex(): number {
    return this.hovered;
  }

  onChange(fn: (index: number) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify(): void {
    for (const fn of this.subscribers) fn(this.hovered);
  }

  dispose(): void {
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseleave', this.onMouseLeave);
  }
}
