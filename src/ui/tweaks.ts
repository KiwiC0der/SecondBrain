import { Pane, type FolderApi } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as THREE from 'three';
import { params } from '../state/params';
import { snapshot, restore, listPresets, savePreset, deletePreset, exportJson, importJson, type PresetName } from './presets';

const STORAGE_KEY = 'galaxy:tweaks:v1';

interface TweakOptions {
  onForceRebuild: () => void;
  fpsRef: { value: number };
}

export class Tweaks {
  readonly pane: Pane;
  private opts: TweakOptions;
  private presetState = { name: 'Default' as PresetName | string, custom: 'My Look' };
  private fpsBlade: { refresh(): void } | null = null;
  private hidden = false;

  constructor(opts: TweakOptions) {
    this.opts = opts;
    this.pane = new Pane({ title: 'Galaxy', expanded: true, container: document.body });
    this.pane.registerPlugin(EssentialsPlugin);
    Object.assign((this.pane.element.parentElement as HTMLElement).style, {
      position: 'fixed',
      top: '14px',
      right: '14px',
      width: '320px',
      zIndex: '50',
    });

    this.buildPresets(this.pane);
    this.buildGalaxy(this.pane.addFolder({ title: 'Galaxy', expanded: false }));
    this.buildEnv(this.pane.addFolder({ title: 'Cleo lighting', expanded: false }));
    this.buildNodes(this.pane.addFolder({ title: 'Nodes', expanded: false }));
    this.buildLinks(this.pane.addFolder({ title: 'Links', expanded: false }));
    this.buildForces(this.pane.addFolder({ title: 'Forces', expanded: false }));
    this.buildAvatar(this.pane.addFolder({ title: 'Avatar', expanded: false }));
    this.buildMovement(this.pane.addFolder({ title: 'Movement', expanded: false }));
    this.buildCamera(this.pane.addFolder({ title: 'Camera', expanded: false }));
    this.buildPost(this.pane.addFolder({ title: 'Painterly post', expanded: false }));
    this.buildDebug(this.pane.addFolder({ title: 'Debug', expanded: false }));

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' && !e.repeat) {
        this.toggle();
      }
    });

    this.loadFromLocalStorage();
    // Persist on every change.
    this.pane.on('change', () => this.saveToLocalStorage());
  }

  toggle(): void {
    this.hidden = !this.hidden;
    (this.pane.element.parentElement as HTMLElement).style.display = this.hidden ? 'none' : '';
  }

  private bindColor(folder: FolderApi, label: string, color: THREE.Color): void {
    const proxy = { c: '#' + color.getHexString() };
    folder
      .addBinding(proxy, 'c', { label })
      .on('change', (e) => {
        if (typeof e.value === 'string') {
          color.set(e.value);
        }
      });
  }

  private buildPresets(folder: FolderApi | Pane): void {
    const presetFolder = (folder as Pane).addFolder({ title: 'Presets', expanded: false });
    const refreshList = (): void => {
      const names = listPresets();
      // Recreate the list binding when the preset set changes.
      while (presetFolder.children.length > 0) presetFolder.remove(presetFolder.children[0]!);
      presetFolder
        .addBinding(this.presetState, 'name', {
          label: 'load',
          options: Object.fromEntries(names.map((n) => [n, n])),
        })
        .on('change', (e) => {
          if (typeof e.value === 'string') {
            restore(e.value);
            this.pane.refresh();
          }
        });
      presetFolder.addBinding(this.presetState, 'custom', { label: 'name' });
      presetFolder
        .addButton({ title: 'save preset' })
        .on('click', () => {
          const name = (this.presetState.custom || 'unnamed').trim() || 'unnamed';
          savePreset(name, snapshot());
          this.presetState.name = name;
          refreshList();
        });
      presetFolder
        .addButton({ title: 'delete' })
        .on('click', () => {
          if (typeof this.presetState.name === 'string') {
            deletePreset(this.presetState.name);
            refreshList();
          }
        });
      presetFolder.addButton({ title: 'export JSON' }).on('click', () => {
        const blob = new Blob([exportJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'galaxy-look.json';
        a.click();
        URL.revokeObjectURL(url);
      });
      presetFolder.addButton({ title: 'import JSON' }).on('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          importJson(text);
          this.pane.refresh();
        };
        input.click();
      });
    };
    refreshList();
  }

  private buildGalaxy(f: FolderApi): void {
    const g = params.galaxy;
    this.bindColor(f, 'paletteA', g.paletteA);
    this.bindColor(f, 'paletteB', g.paletteB);
    this.bindColor(f, 'paletteC', g.paletteC);
    this.bindColor(f, 'paletteD', g.paletteD);
    f.addBinding(g, 'contrast',  { min: 0.4, max: 3.0, step: 0.01 });
    f.addBinding(g, 'density',   { min: 0.0, max: 1.5, step: 0.01 });
    f.addBinding(g, 'octaves',   { min: 1, max: 8, step: 1 });
    f.addBinding(g, 'swirl',     { min: 0.0, max: 2.5, step: 0.01 });
    f.addBinding(g, 'drift',     { min: 0.0, max: 0.4, step: 0.001 });
    f.addBinding(g, 'starCount', { min: 0, max: 12000, step: 50 });
    f.addBinding(g, 'starSize',  { min: 0.1, max: 4.0, step: 0.05 });
    f.addBinding(g, 'starTwinkle', { min: 0.0, max: 1.5, step: 0.02 });
    f.addBinding(g, 'brushCount',  { min: 0, max: 60, step: 1 });
    f.addBinding(g, 'brushScale',  { min: 0.2, max: 4.0, step: 0.05 });
    f.addBinding(g, 'brushOpacity',{ min: 0.0, max: 1.0, step: 0.01 });
  }

  private buildEnv(f: FolderApi): void {
    const e = params.env;
    f.addBinding(e, 'intensity',   { min: 0.0, max: 3.0, step: 0.01 });
    f.addBinding(e, 'rimStrength', { min: 0.0, max: 3.0, step: 0.02 });
    f.addBinding(e, 'rimPower',    { min: 0.5, max: 8.0, step: 0.05 });
    this.bindColor(f, 'rimTint', e.rimTint);
    f.addBinding(e, 'toonBands',   { min: 1, max: 6, step: 1 });
    f.addBinding(e, 'toonSoftness',{ min: 0.0, max: 1.0, step: 0.01 });
    f.addBinding(e, 'paperGrain',  { min: 0.0, max: 0.6, step: 0.005 });
  }

  private buildNodes(f: FolderApi): void {
    const n = params.nodes;
    f.addBinding(n, 'baseSize',   { min: 0.2, max: 4.0, step: 0.02 });
    f.addBinding(n, 'sizeExp',    { min: 0.1, max: 1.5, step: 0.01 });
    f.addBinding(n, 'glowBase',   { min: 0.1, max: 3.0, step: 0.01 });
    f.addBinding(n, 'glowGain',   { min: 0.0, max: 4.0, step: 0.02 });
    f.addBinding(n, 'hoverScale', { min: 1.0, max: 2.5, step: 0.01 });
    this.bindColor(f, 'sources',   n.palette.sources);
    this.bindColor(f, 'entities',  n.palette.entities);
    this.bindColor(f, 'concepts',  n.palette.concepts);
    this.bindColor(f, 'syntheses', n.palette.syntheses);
    this.bindColor(f, 'other',     n.palette.other);
  }

  private buildLinks(f: FolderApi): void {
    const l = params.links;
    f.addBinding(l, 'width',        { min: 0.005, max: 0.4, step: 0.005 });
    f.addBinding(l, 'opacity',      { min: 0.0, max: 1.0, step: 0.01 });
    this.bindColor(f, 'inkColor', l.inkColor);
    f.addBinding(l, 'wobbleAmp',    { min: 0.0, max: 0.8, step: 0.01 });
    f.addBinding(l, 'wobbleSpeed',  { min: 0.0, max: 4.0, step: 0.02 });
  }

  private buildForces(f: FolderApi): void {
    const fr = params.forces;
    f.addBinding(fr, 'linkDistance',     { min: 1, max: 30, step: 0.1 });
    f.addBinding(fr, 'linkStrength',     { min: 0.0, max: 1.5, step: 0.01 });
    f.addBinding(fr, 'charge',           { min: -200, max: 0, step: 1 });
    f.addBinding(fr, 'centerStrength',   { min: 0.0, max: 0.4, step: 0.005 });
    f.addBinding(fr, 'collidePadding',   { min: 0.0, max: 4.0, step: 0.05 });
    f.addBinding(fr, 'attractRadius',    { min: 0.0, max: 50.0, step: 0.2 });
    f.addBinding(fr, 'attractStrength',  { min: 0.0, max: 1.5, step: 0.01 });
    f.addBinding(fr, 'repelRadius',      { min: 0.0, max: 30.0, step: 0.2 });
    f.addBinding(fr, 'repelStrength',    { min: 0.0, max: 200, step: 1 });
    f.addButton({ title: 'rebuild simulation' }).on('click', () => this.opts.onForceRebuild());
  }

  private buildAvatar(f: FolderApi): void {
    const a = params.avatar;
    f.addBinding(a, 'scale',          { min: 0.1, max: 4.0, step: 0.02 });
    f.addBinding(a, 'followDistance', { min: 1.5, max: 30.0, step: 0.1 });
    f.addBinding(a, 'followHeight',   { min: -2.0, max: 12.0, step: 0.05 });
    f.addBinding(a, 'followLerp',     { min: 0.02, max: 1.0, step: 0.01 });
    f.addBinding(a, 'bobAmp',         { min: 0.0, max: 0.5, step: 0.01 });
    f.addBinding(a, 'bankAmount',     { min: 0.0, max: 2.0, step: 0.02 });
  }

  private buildMovement(f: FolderApi): void {
    const m = params.movement;
    f.addBinding(m, 'maxSpeed',         { min: 1, max: 60, step: 0.5 });
    f.addBinding(m, 'accel',            { min: 1, max: 60, step: 0.5 });
    f.addBinding(m, 'friction',         { min: 0, max: 30, step: 0.1 });
    f.addBinding(m, 'yawSensitivity',   { min: 0.0005, max: 0.012, step: 0.0001 });
    f.addBinding(m, 'pitchSensitivity', { min: 0.0005, max: 0.012, step: 0.0001 });
    f.addBinding(m, 'pitchMin',         { min: -1.5, max: 0, step: 0.02 });
    f.addBinding(m, 'pitchMax',         { min: 0, max: 1.5, step: 0.02 });
    f.addBinding(m, 'boostMultiplier',  { min: 1, max: 8, step: 0.05 });
  }

  private buildCamera(f: FolderApi): void {
    const c = params.camera;
    f.addBinding(c, 'fov',  { min: 25, max: 110, step: 1 });
    f.addBinding(c, 'near', { min: 0.01, max: 5, step: 0.01 });
    f.addBinding(c, 'far',  { min: 100, max: 20000, step: 50 });
  }

  private buildPost(f: FolderApi): void {
    const p = params.post;
    const k = f.addFolder({ title: 'Kuwahara', expanded: false });
    k.addBinding(p.kuwahara, 'enabled');
    k.addBinding(p.kuwahara, 'radius', { min: 1, max: 8, step: 1 });
    k.addBinding(p.kuwahara, 'passes', { min: 1, max: 3, step: 1 });

    const o = f.addFolder({ title: 'Outline (ink)', expanded: false });
    o.addBinding(p.outline, 'enabled');
    o.addBinding(p.outline, 'thickness', { min: 0.5, max: 4.0, step: 0.05 });
    o.addBinding(p.outline, 'threshold', { min: 0.001, max: 0.06, step: 0.001 });
    this.bindColor(o, 'inkColor', p.outline.inkColor);
    o.addBinding(p.outline, 'strength', { min: 0.0, max: 1.5, step: 0.02 });

    const b = f.addFolder({ title: 'Bloom', expanded: false });
    b.addBinding(p.bloom, 'enabled');
    b.addBinding(p.bloom, 'threshold', { min: 0.0, max: 1.5, step: 0.01 });
    b.addBinding(p.bloom, 'strength',  { min: 0.0, max: 3.0, step: 0.02 });
    b.addBinding(p.bloom, 'radius',    { min: 0.0, max: 1.5, step: 0.02 });

    const c = f.addFolder({ title: 'Chromatic ab.', expanded: false });
    c.addBinding(p.chromatic, 'enabled');
    c.addBinding(p.chromatic, 'amount',  { min: 0.0, max: 0.02, step: 0.0001 });
    c.addBinding(p.chromatic, 'falloff', { min: 0.0, max: 1.0, step: 0.01 });

    const g = f.addFolder({ title: 'Grain', expanded: false });
    g.addBinding(p.grain, 'enabled');
    g.addBinding(p.grain, 'intensity', { min: 0.0, max: 0.4, step: 0.005 });
    g.addBinding(p.grain, 'scale',     { min: 100, max: 4000, step: 50 });
    g.addBinding(p.grain, 'paper');

    const cm = f.addFolder({ title: 'Vignette + grade', expanded: false });
    cm.addBinding(p.compose, 'enabled');
    cm.addBinding(p.compose, 'vignette',         { min: 0.0, max: 1.0, step: 0.01 });
    cm.addBinding(p.compose, 'vignetteSoftness', { min: 0.0, max: 0.8, step: 0.01 });
    cm.addBinding(p.compose, 'hueShift',         { min: -0.5, max: 0.5, step: 0.005 });
    cm.addBinding(p.compose, 'sat',              { min: 0.0, max: 2.0, step: 0.01 });
    cm.addBinding(p.compose, 'contrast',         { min: 0.4, max: 1.8, step: 0.01 });
    cm.addBinding(p.compose, 'lift',             { min: -0.2, max: 0.3, step: 0.005 });
    cm.addBinding(p.compose, 'gamma',            { min: 0.4, max: 2.0, step: 0.01 });
    cm.addBinding(p.compose, 'gain',             { min: 0.4, max: 2.0, step: 0.01 });
  }

  private buildDebug(f: FolderApi): void {
    const d = params.debug;
    f.addBinding(d, 'showFps');
    f.addBinding(d, 'showStats');
    f.addBinding(d, 'freeFly');
    const fps = { value: 0 };
    this.fpsBlade = f.addBinding(fps, 'value', { readonly: true, label: 'fps' }) as unknown as { refresh(): void };
    setInterval(() => {
      fps.value = Math.round(this.opts.fpsRef.value);
      this.fpsBlade?.refresh();
    }, 250);
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, exportJson());
    } catch {
      // ignore quota
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text) importJson(text);
      this.pane.refresh();
    } catch {
      // ignore
    }
  }
}
