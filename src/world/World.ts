import * as THREE from 'three';
import { Galaxy } from './Galaxy';
import { Env } from './Env';
import { Graph } from './Graph';
import { Avatar } from './Avatar';
import { ForceSim } from './ForceSim';
import { params } from '../state/params';
import type { Graph as GraphData } from '../data/types';

export class World {
  readonly scene = new THREE.Scene();
  readonly galaxy: Galaxy;
  readonly env: Env;
  readonly graph: Graph;
  readonly avatar: Avatar;
  readonly forces: ForceSim;

  private keyLight: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;

  constructor(renderer: THREE.WebGLRenderer) {
    this.galaxy = new Galaxy();
    this.env = new Env(renderer, this.galaxy.nebulaMaterial, 128);
    this.graph = new Graph();
    this.avatar = new Avatar();
    this.forces = new ForceSim(this.graph);

    this.scene.add(this.galaxy.group);
    this.scene.add(this.graph.group);
    this.scene.add(this.avatar.group);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    this.keyLight.position.set(35, 50, 25);
    this.scene.add(this.ambient);
    this.scene.add(this.keyLight);
  }

  /** Bake the env cube from the nebula and assign it to scene + Cleo. */
  bakeEnv(renderer: THREE.WebGLRenderer): void {
    this.env.bake(renderer);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = params.env.intensity;
    this.avatar.setEnvMap(this.env.texture);
  }

  setGraphData(data: GraphData): void {
    this.graph.setData(data);
    this.forces.rebuild();
  }

  async loadAvatar(url: string): Promise<void> {
    await this.avatar.load(url);
    if (this.scene.environment) this.avatar.setEnvMap(this.scene.environment as THREE.CubeTexture);
  }

  update(dt: number, time: number): void {
    this.galaxy.syncUniforms(time);
    this.forces.setAvatarPosition(this.avatar.group.position);
    this.forces.syncParams();
    this.forces.update(dt);
    this.graph.syncBuffers();
    this.graph.syncUniforms(time);
    this.avatar.update(dt, time);
    this.scene.environmentIntensity = params.env.intensity;
  }

  dispose(): void {
    this.galaxy.dispose();
    this.env.dispose();
    this.graph.dispose();
    this.avatar.dispose();
    this.forces.stop();
  }
}
