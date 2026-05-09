declare module 'd3-force-3d' {
  // Minimal shims for the API surface we use. d3-force-3d ships no .d.ts.

  export interface SimulationNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface SimulationLinkDatum<N extends SimulationNodeDatum> {
    source: string | N;
    target: string | N;
    index?: number;
  }

  export interface Force<N extends SimulationNodeDatum, L> {
    (alpha: number): void;
    initialize?(nodes: N[], random?: () => number): void;
  }

  export interface Simulation<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N>> {
    nodes(): N[];
    nodes(nodes: N[]): this;
    alpha(): number;
    alpha(alpha: number): this;
    alphaTarget(): number;
    alphaTarget(target: number): this;
    alphaDecay(): number;
    alphaDecay(decay: number): this;
    velocityDecay(): number;
    velocityDecay(decay: number): this;
    numDimensions(): number;
    numDimensions(n: number): this;
    force(name: string): Force<N, L> | undefined;
    force(name: string, force: Force<N, L> | null): this;
    tick(iterations?: number): this;
    stop(): this;
    restart(): this;
    on(typenames: string, listener: ((this: Simulation<N, L>) => void) | null): this;
  }

  export function forceSimulation<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N> = SimulationLinkDatum<N>>(
    nodes?: N[],
    numDimensions?: number,
  ): Simulation<N, L>;

  export interface ForceLink<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N>> extends Force<N, L> {
    links(): L[];
    links(links: L[]): this;
    id(): (node: N) => string;
    id(accessor: (node: N) => string): this;
    distance(): (link: L, i: number, links: L[]) => number;
    distance(d: number | ((link: L, i: number, links: L[]) => number)): this;
    strength(): (link: L, i: number, links: L[]) => number;
    strength(s: number | ((link: L, i: number, links: L[]) => number)): this;
    iterations(n: number): this;
  }
  export function forceLink<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N>>(links?: L[]): ForceLink<N, L>;

  export interface ForceManyBody<N extends SimulationNodeDatum> extends Force<N, never> {
    strength(): (node: N, i: number, nodes: N[]) => number;
    strength(s: number | ((node: N, i: number, nodes: N[]) => number)): this;
    distanceMin(d: number): this;
    distanceMax(d: number): this;
    theta(t: number): this;
  }
  export function forceManyBody<N extends SimulationNodeDatum>(): ForceManyBody<N>;

  export interface ForceCenter<N extends SimulationNodeDatum> extends Force<N, never> {
    x(x: number): this;
    y(y: number): this;
    z(z: number): this;
    strength(s: number): this;
  }
  export function forceCenter<N extends SimulationNodeDatum>(x?: number, y?: number, z?: number): ForceCenter<N>;

  export interface ForceCollide<N extends SimulationNodeDatum> extends Force<N, never> {
    radius(r: number | ((node: N, i: number, nodes: N[]) => number)): this;
    iterations(n: number): this;
    strength(s: number): this;
  }
  export function forceCollide<N extends SimulationNodeDatum>(radius?: number | ((n: N, i: number, nodes: N[]) => number)): ForceCollide<N>;
}
