import * as THREE from 'three';
import nodeVert from '../shaders/node.vert.glsl?raw';
import nodeFrag from '../shaders/node.frag.glsl?raw';
import linkVert from '../shaders/link.vert.glsl?raw';
import linkFrag from '../shaders/link.frag.glsl?raw';
import type { Graph as GraphData, GraphNode, Category } from '../data/types';
import { params } from '../state/params';

interface NodeRuntime {
  id: string;
  index: number;
  data: GraphNode;
  position: THREE.Vector3;
  baseSize: number;
  color: THREE.Color;
}

export class Graph {
  readonly group = new THREE.Group();

  private nodeMesh: THREE.Mesh | null = null;
  private linkMesh: THREE.Mesh | null = null;

  private nodeMat: THREE.ShaderMaterial;
  private linkMat: THREE.ShaderMaterial;

  private quadGeo: THREE.PlaneGeometry;

  private nodes: NodeRuntime[] = [];
  private links: { source: number; target: number; weight: number }[] = [];

  // Buffers we update each frame.
  private nodePositions = new Float32Array(0);
  private nodeColors = new Float32Array(0);
  private nodeSizes = new Float32Array(0);
  private nodeGlows = new Float32Array(0);
  private nodeSeeds = new Float32Array(0);

  private linkStarts = new Float32Array(0);
  private linkEnds = new Float32Array(0);
  private linkSeeds = new Float32Array(0);
  private linkWidths = new Float32Array(0);

  private nodePosAttr: THREE.InstancedBufferAttribute | null = null;
  private nodeColorAttr: THREE.InstancedBufferAttribute | null = null;
  private nodeSizeAttr: THREE.InstancedBufferAttribute | null = null;
  private nodeGlowAttr: THREE.InstancedBufferAttribute | null = null;
  private linkStartAttr: THREE.InstancedBufferAttribute | null = null;
  private linkEndAttr: THREE.InstancedBufferAttribute | null = null;

  constructor() {
    this.group.name = 'Graph';
    this.quadGeo = new THREE.PlaneGeometry(1, 1, 1, 1);

    this.nodeMat = new THREE.ShaderMaterial({
      vertexShader: nodeVert,
      fragmentShader: nodeFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uHoveredIndex: { value: -1 },
        uHoverScale: { value: params.nodes.hoverScale },
      },
    });

    this.linkMat = new THREE.ShaderMaterial({
      vertexShader: linkVert,
      fragmentShader: linkFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: params.links.opacity },
        uInkColor: { value: params.links.inkColor.clone() },
        uWobbleAmp: { value: params.links.wobbleAmp },
        uWobbleSpeed: { value: params.links.wobbleSpeed },
      },
    });
  }

  setData(data: GraphData): void {
    const idToIdx = new Map<string, number>();
    this.nodes = data.nodes.map((n, i) => {
      idToIdx.set(n.id, i);
      const cat = (n.category ?? 'other') as Category;
      const color = (params.nodes.palette[cat] ?? params.nodes.palette.other).clone();
      const sizeT = (n.degree + 1) / Math.max(1, ...data.nodes.map((m) => m.degree + 1));
      const baseSize = params.nodes.baseSize + 2.5 * Math.pow(sizeT, params.nodes.sizeExp);
      return {
        id: n.id,
        index: i,
        data: n,
        position: seedPosition(n),
        baseSize,
        color,
      };
    });

    this.links = data.links
      .map((l) => {
        const s = idToIdx.get(l.source);
        const t = idToIdx.get(l.target);
        if (s == null || t == null) return null;
        return { source: s, target: t, weight: l.weight };
      })
      .filter((x): x is { source: number; target: number; weight: number } => x !== null);

    this.rebuildNodeMesh();
    this.rebuildLinkMesh();
  }

  /** Read-only access for force sim / proximity etc. */
  get nodeRuntimes(): readonly NodeRuntime[] {
    return this.nodes;
  }

  get linkRuntimes(): readonly { source: number; target: number; weight: number }[] {
    return this.links;
  }

  private rebuildNodeMesh(): void {
    if (this.nodeMesh) {
      this.group.remove(this.nodeMesh);
      this.nodeMesh.geometry.dispose();
      this.nodeMesh = null;
    }
    const count = this.nodes.length;
    if (count === 0) return;

    this.nodePositions = new Float32Array(count * 3);
    this.nodeColors = new Float32Array(count * 3);
    this.nodeSizes = new Float32Array(count);
    this.nodeGlows = new Float32Array(count);
    this.nodeSeeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const n = this.nodes[i]!;
      this.nodePositions[i * 3 + 0] = n.position.x;
      this.nodePositions[i * 3 + 1] = n.position.y;
      this.nodePositions[i * 3 + 2] = n.position.z;
      this.nodeColors[i * 3 + 0] = n.color.r;
      this.nodeColors[i * 3 + 1] = n.color.g;
      this.nodeColors[i * 3 + 2] = n.color.b;
      this.nodeSizes[i] = n.baseSize;
      this.nodeGlows[i] = params.nodes.glowBase + params.nodes.glowGain * (n.data.degree / Math.max(1, this.maxDegree()));
      this.nodeSeeds[i] = pseudoSeed(n.id);
    }

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', this.quadGeo.getAttribute('position'));
    geo.setAttribute('uv', this.quadGeo.getAttribute('uv'));
    geo.setIndex(this.quadGeo.getIndex());
    this.nodePosAttr = new THREE.InstancedBufferAttribute(this.nodePositions, 3).setUsage(THREE.DynamicDrawUsage);
    this.nodeColorAttr = new THREE.InstancedBufferAttribute(this.nodeColors, 3);
    this.nodeSizeAttr = new THREE.InstancedBufferAttribute(this.nodeSizes, 1).setUsage(THREE.DynamicDrawUsage);
    this.nodeGlowAttr = new THREE.InstancedBufferAttribute(this.nodeGlows, 1);
    geo.setAttribute('iPosition', this.nodePosAttr);
    geo.setAttribute('iColor', this.nodeColorAttr);
    geo.setAttribute('iSize', this.nodeSizeAttr);
    geo.setAttribute('iGlow', this.nodeGlowAttr);
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(this.nodeSeeds, 1));
    const indices = new Float32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    geo.setAttribute('iIndex', new THREE.InstancedBufferAttribute(indices, 1));
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200);

    this.nodeMesh = new THREE.Mesh(geo, this.nodeMat);
    this.nodeMesh.frustumCulled = false;
    this.nodeMesh.renderOrder = 100;
    this.group.add(this.nodeMesh);
  }

  private rebuildLinkMesh(): void {
    if (this.linkMesh) {
      this.group.remove(this.linkMesh);
      this.linkMesh.geometry.dispose();
      this.linkMesh = null;
    }
    const count = this.links.length;
    if (count === 0) return;

    this.linkStarts = new Float32Array(count * 3);
    this.linkEnds = new Float32Array(count * 3);
    this.linkSeeds = new Float32Array(count);
    this.linkWidths = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const l = this.links[i]!;
      const a = this.nodes[l.source]!;
      const b = this.nodes[l.target]!;
      this.linkStarts[i * 3 + 0] = a.position.x;
      this.linkStarts[i * 3 + 1] = a.position.y;
      this.linkStarts[i * 3 + 2] = a.position.z;
      this.linkEnds[i * 3 + 0] = b.position.x;
      this.linkEnds[i * 3 + 1] = b.position.y;
      this.linkEnds[i * 3 + 2] = b.position.z;
      this.linkSeeds[i] = pseudoSeed(`${a.id}->${b.id}`);
      this.linkWidths[i] = params.links.width * 4.0;
    }

    // Ribbon geometry: a 1x1 quad with subdivisions along x for smooth wobble.
    const ribbon = new THREE.PlaneGeometry(1, 1, 24, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', ribbon.getAttribute('position'));
    geo.setAttribute('uv', ribbon.getAttribute('uv'));
    geo.setIndex(ribbon.getIndex());
    ribbon.dispose();
    this.linkStartAttr = new THREE.InstancedBufferAttribute(this.linkStarts, 3).setUsage(THREE.DynamicDrawUsage);
    this.linkEndAttr = new THREE.InstancedBufferAttribute(this.linkEnds, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iStart', this.linkStartAttr);
    geo.setAttribute('iEnd', this.linkEndAttr);
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(this.linkSeeds, 1));
    geo.setAttribute('iWidth', new THREE.InstancedBufferAttribute(this.linkWidths, 1));
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200);

    this.linkMesh = new THREE.Mesh(geo, this.linkMat);
    this.linkMesh.frustumCulled = false;
    this.linkMesh.renderOrder = 50;
    this.group.add(this.linkMesh);
  }

  /** Push current node positions into the GPU buffers (called every frame). */
  syncBuffers(): void {
    const c = this.nodes.length;
    for (let i = 0; i < c; i++) {
      const n = this.nodes[i]!;
      this.nodePositions[i * 3 + 0] = n.position.x;
      this.nodePositions[i * 3 + 1] = n.position.y;
      this.nodePositions[i * 3 + 2] = n.position.z;
      this.nodeSizes[i] = n.baseSize;
    }
    if (this.nodePosAttr) this.nodePosAttr.needsUpdate = true;
    if (this.nodeSizeAttr) this.nodeSizeAttr.needsUpdate = true;

    const lc = this.links.length;
    for (let i = 0; i < lc; i++) {
      const l = this.links[i]!;
      const a = this.nodes[l.source]!;
      const b = this.nodes[l.target]!;
      this.linkStarts[i * 3 + 0] = a.position.x;
      this.linkStarts[i * 3 + 1] = a.position.y;
      this.linkStarts[i * 3 + 2] = a.position.z;
      this.linkEnds[i * 3 + 0] = b.position.x;
      this.linkEnds[i * 3 + 1] = b.position.y;
      this.linkEnds[i * 3 + 2] = b.position.z;
    }
    if (this.linkStartAttr) this.linkStartAttr.needsUpdate = true;
    if (this.linkEndAttr) this.linkEndAttr.needsUpdate = true;
  }

  syncUniforms(time: number): void {
    this.nodeMat.uniforms.uTime!.value = time;
    this.nodeMat.uniforms.uHoverScale!.value = params.nodes.hoverScale;
    this.linkMat.uniforms.uTime!.value = time;
    this.linkMat.uniforms.uOpacity!.value = params.links.opacity;
    (this.linkMat.uniforms.uInkColor!.value as THREE.Color).copy(params.links.inkColor);
    this.linkMat.uniforms.uWobbleAmp!.value = params.links.wobbleAmp;
    this.linkMat.uniforms.uWobbleSpeed!.value = params.links.wobbleSpeed;
  }

  setHoveredIndex(index: number): void {
    this.nodeMat.uniforms.uHoveredIndex!.value = index;
  }

  /** Center of mass, useful for camera framing on first load. */
  centerOfMass(): THREE.Vector3 {
    const c = new THREE.Vector3();
    if (this.nodes.length === 0) return c;
    for (const n of this.nodes) c.add(n.position);
    return c.multiplyScalar(1 / this.nodes.length);
  }

  private maxDegree(): number {
    let m = 0;
    for (const n of this.nodes) if (n.data.degree > m) m = n.data.degree;
    return m;
  }

  dispose(): void {
    this.nodeMat.dispose();
    this.linkMat.dispose();
    this.quadGeo.dispose();
    if (this.nodeMesh) {
      this.nodeMesh.geometry.dispose();
      this.group.remove(this.nodeMesh);
    }
    if (this.linkMesh) {
      this.linkMesh.geometry.dispose();
      this.group.remove(this.linkMesh);
    }
  }
}

function pseudoSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

function seedPosition(n: GraphNode): THREE.Vector3 {
  let h = 2166136261;
  for (let i = 0; i < n.id.length; i++) h = Math.imul(h ^ n.id.charCodeAt(i), 16777619);
  // 3D fibonacci-ish distribution scaled by degree (denser nodes nearer the center).
  const r = 22 + ((h >>> 0) % 1000) / 35;
  const theta = ((h >>> 8) % 1000) / 1000 * Math.PI * 2;
  const phi = (((h >>> 16) % 1000) / 1000) * Math.PI - Math.PI / 2;
  return new THREE.Vector3(
    r * Math.cos(phi) * Math.cos(theta),
    r * Math.sin(phi) * 0.6,
    r * Math.cos(phi) * Math.sin(theta),
  );
}
