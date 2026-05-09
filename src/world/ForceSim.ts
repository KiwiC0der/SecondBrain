import * as THREE from 'three';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force-3d';
import type { Graph } from './Graph';
import { params } from '../state/params';

interface SimNode extends SimulationNodeDatum {
  id: string;
  graphIndex: number;
  baseSize: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  weight: number;
}

export class ForceSim {
  private simulation: Simulation<SimNode, SimLink> | null = null;
  private nodes: SimNode[] = [];
  private links: SimLink[] = [];
  private graph: Graph;
  private avatarPos = new THREE.Vector3();

  constructor(graph: Graph) {
    this.graph = graph;
  }

  rebuild(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    const runtimes = this.graph.nodeRuntimes;
    this.nodes = runtimes.map((r, i) => ({
      id: r.id,
      graphIndex: i,
      x: r.position.x,
      y: r.position.y,
      z: r.position.z,
      vx: 0, vy: 0, vz: 0,
      baseSize: r.baseSize,
    }));
    const idToNode = new Map(this.nodes.map((n) => [n.id, n]));
    this.links = this.graph.linkRuntimes.map((l) => {
      const a = runtimes[l.source]!;
      const b = runtimes[l.target]!;
      return {
        source: idToNode.get(a.id)!,
        target: idToNode.get(b.id)!,
        weight: l.weight,
      };
    });

    const sim = forceSimulation<SimNode, SimLink>(this.nodes, 3)
      .alpha(0.65)
      .alphaDecay(0.012)
      .velocityDecay(0.32)
      .force(
        'link',
        forceLink<SimNode, SimLink>(this.links)
          .id((d) => d.id)
          .distance(params.forces.linkDistance)
          .strength(params.forces.linkStrength),
      )
      .force('charge', forceManyBody<SimNode>().strength(params.forces.charge).distanceMax(80))
      .force('center', forceCenter<SimNode>(0, 0, 0).strength(params.forces.centerStrength))
      .force(
        'collide',
        forceCollide<SimNode>((n) => n.baseSize + params.forces.collidePadding).iterations(2),
      )
      .force('proximity', this.proximityForce.bind(this));

    sim.stop();
    this.simulation = sim;
  }

  private proximityForce(_alpha: number): void {
    if (!this.simulation) return;
    const nodes = this.nodes;
    const ax = this.avatarPos.x;
    const ay = this.avatarPos.y;
    const az = this.avatarPos.z;
    const attractR = params.forces.attractRadius;
    const repelR = params.forces.repelRadius;
    const attractK = params.forces.attractStrength;
    const repelK = params.forces.repelStrength;

    // Nearest within attractR.
    let nearest: SimNode | null = null;
    let nearestDist2 = Infinity;
    for (const n of nodes) {
      const dx = ax - (n.x ?? 0);
      const dy = ay - (n.y ?? 0);
      const dz = az - (n.z ?? 0);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < nearestDist2) {
        nearestDist2 = d2;
        nearest = n;
      }
    }

    // Apply attract to nearest, repel to others within repelR.
    for (const n of nodes) {
      const dx = ax - (n.x ?? 0);
      const dy = ay - (n.y ?? 0);
      const dz = az - (n.z ?? 0);
      const d2 = dx * dx + dy * dy + dz * dz;
      const d = Math.sqrt(d2) || 0.0001;

      if (n === nearest && d < attractR) {
        const t = 1 - d / attractR; // 1 nearby, 0 at edge
        const a = attractK * t;
        n.vx = (n.vx ?? 0) + (dx / d) * a;
        n.vy = (n.vy ?? 0) + (dy / d) * a;
        n.vz = (n.vz ?? 0) + (dz / d) * a;
      } else if (d < repelR) {
        const a = repelK / Math.max(0.5, d2);
        n.vx = (n.vx ?? 0) - (dx / d) * a;
        n.vy = (n.vy ?? 0) - (dy / d) * a;
        n.vz = (n.vz ?? 0) - (dz / d) * a;
      }
    }
  }

  setAvatarPosition(p: THREE.Vector3): void {
    this.avatarPos.copy(p);
  }

  /** Re-apply the current params to the underlying force objects. */
  syncParams(): void {
    if (!this.simulation) return;
    const link = this.simulation.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>> | undefined;
    if (link) link.distance(params.forces.linkDistance).strength(params.forces.linkStrength);
    const charge = this.simulation.force('charge') as ReturnType<typeof forceManyBody<SimNode>> | undefined;
    if (charge) charge.strength(params.forces.charge);
    const center = this.simulation.force('center') as ReturnType<typeof forceCenter<SimNode>> | undefined;
    if (center) center.strength(params.forces.centerStrength);
  }

  /** Tick once and write positions back to the graph runtime nodes. */
  update(dt: number): void {
    if (!this.simulation) return;
    // Keep alpha low and steady so the sim continually settles + reacts.
    const sim = this.simulation;
    const a = sim.alpha();
    if (a < 0.04) sim.alpha(0.05);
    sim.alphaTarget(0.02);
    // Subtle scaling of the per-frame energy relative to dt for frame-rate stability.
    const ticks = Math.max(1, Math.min(4, Math.round(dt / (1 / 90))));
    for (let i = 0; i < ticks; i++) sim.tick();

    const runtimes = this.graph.nodeRuntimes;
    for (const n of this.nodes) {
      const target = runtimes[n.graphIndex];
      if (!target) continue;
      target.position.set(n.x ?? 0, n.y ?? 0, n.z ?? 0);
    }
  }

  stop(): void {
    this.simulation?.stop();
  }
}
