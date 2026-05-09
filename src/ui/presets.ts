import * as THREE from 'three';
import { params, DEFAULT_PARAMS } from '../state/params';

export type PresetName = 'Default' | 'Cinematic' | 'Inkwash' | 'Pastel' | 'Neon Bruise' | string;

const STORAGE_KEY = 'galaxy:presets:v1';

interface PresetMap {
  [name: string]: SerialisedSnapshot;
}

interface SerialisedSnapshot {
  galaxy: SerialisedGalaxy;
  env: SerialisedEnv;
  nodes: SerialisedNodes;
  links: SerialisedLinks;
  forces: typeof params.forces;
  avatar: typeof params.avatar;
  movement: typeof params.movement;
  camera: typeof params.camera;
  post: SerialisedPost;
  debug: typeof params.debug;
}

interface SerialisedGalaxy {
  paletteA: string; paletteB: string; paletteC: string; paletteD: string;
  contrast: number; density: number; octaves: number; swirl: number; drift: number;
  coreOffsetX: number; coreOffsetY: number;
  starCount: number; starSize: number; starTwinkle: number;
  brushCount: number; brushScale: number; brushOpacity: number;
}
interface SerialisedEnv {
  intensity: number; rimStrength: number; rimPower: number; rimTint: string;
  toonBands: number; toonSoftness: number; paperGrain: number;
}
interface SerialisedNodes {
  baseSize: number; sizeExp: number; glowBase: number; glowGain: number; hoverScale: number;
  palette: { sources: string; entities: string; concepts: string; syntheses: string; other: string };
}
interface SerialisedLinks {
  width: number; opacity: number; inkColor: string; wobbleAmp: number; wobbleSpeed: number;
}
interface SerialisedPost {
  kuwahara: typeof params.post.kuwahara;
  outline: { enabled: boolean; thickness: number; threshold: number; inkColor: string; strength: number };
  bloom: typeof params.post.bloom;
  chromatic: typeof params.post.chromatic;
  grain: typeof params.post.grain;
  compose: typeof params.post.compose;
}

function hex(c: THREE.Color): string {
  return '#' + c.getHexString();
}

export function snapshot(): SerialisedSnapshot {
  const g = params.galaxy;
  const e = params.env;
  const n = params.nodes;
  const l = params.links;
  const p = params.post;
  return {
    galaxy: {
      paletteA: hex(g.paletteA), paletteB: hex(g.paletteB), paletteC: hex(g.paletteC), paletteD: hex(g.paletteD),
      contrast: g.contrast, density: g.density, octaves: g.octaves, swirl: g.swirl, drift: g.drift,
      coreOffsetX: g.coreOffset.x, coreOffsetY: g.coreOffset.y,
      starCount: g.starCount, starSize: g.starSize, starTwinkle: g.starTwinkle,
      brushCount: g.brushCount, brushScale: g.brushScale, brushOpacity: g.brushOpacity,
    },
    env: {
      intensity: e.intensity, rimStrength: e.rimStrength, rimPower: e.rimPower,
      rimTint: hex(e.rimTint), toonBands: e.toonBands, toonSoftness: e.toonSoftness, paperGrain: e.paperGrain,
    },
    nodes: {
      baseSize: n.baseSize, sizeExp: n.sizeExp, glowBase: n.glowBase, glowGain: n.glowGain, hoverScale: n.hoverScale,
      palette: {
        sources: hex(n.palette.sources), entities: hex(n.palette.entities),
        concepts: hex(n.palette.concepts), syntheses: hex(n.palette.syntheses), other: hex(n.palette.other),
      },
    },
    links: {
      width: l.width, opacity: l.opacity, inkColor: hex(l.inkColor),
      wobbleAmp: l.wobbleAmp, wobbleSpeed: l.wobbleSpeed,
    },
    forces: { ...params.forces },
    avatar: { ...params.avatar },
    movement: { ...params.movement },
    camera: { ...params.camera },
    post: {
      kuwahara: { ...p.kuwahara },
      outline: {
        enabled: p.outline.enabled, thickness: p.outline.thickness, threshold: p.outline.threshold,
        inkColor: hex(p.outline.inkColor), strength: p.outline.strength,
      },
      bloom: { ...p.bloom },
      chromatic: { ...p.chromatic },
      grain: { ...p.grain },
      compose: { ...p.compose },
    },
    debug: { ...params.debug },
  };
}

export function restore(name: PresetName): void {
  const all = readAll();
  const snap = all[name];
  if (!snap) return;
  applySnapshot(snap);
}

export function applySnapshot(snap: SerialisedSnapshot): void {
  const g = params.galaxy, sg = snap.galaxy;
  g.paletteA.set(sg.paletteA); g.paletteB.set(sg.paletteB); g.paletteC.set(sg.paletteC); g.paletteD.set(sg.paletteD);
  g.contrast = sg.contrast; g.density = sg.density; g.octaves = sg.octaves; g.swirl = sg.swirl; g.drift = sg.drift;
  g.coreOffset.set(sg.coreOffsetX, sg.coreOffsetY);
  g.starCount = sg.starCount; g.starSize = sg.starSize; g.starTwinkle = sg.starTwinkle;
  g.brushCount = sg.brushCount; g.brushScale = sg.brushScale; g.brushOpacity = sg.brushOpacity;

  const e = params.env, se = snap.env;
  e.intensity = se.intensity; e.rimStrength = se.rimStrength; e.rimPower = se.rimPower;
  e.rimTint.set(se.rimTint); e.toonBands = se.toonBands; e.toonSoftness = se.toonSoftness; e.paperGrain = se.paperGrain;

  const n = params.nodes, sn = snap.nodes;
  n.baseSize = sn.baseSize; n.sizeExp = sn.sizeExp; n.glowBase = sn.glowBase; n.glowGain = sn.glowGain; n.hoverScale = sn.hoverScale;
  n.palette.sources.set(sn.palette.sources); n.palette.entities.set(sn.palette.entities);
  n.palette.concepts.set(sn.palette.concepts); n.palette.syntheses.set(sn.palette.syntheses);
  n.palette.other.set(sn.palette.other);

  const l = params.links, sl = snap.links;
  l.width = sl.width; l.opacity = sl.opacity; l.inkColor.set(sl.inkColor);
  l.wobbleAmp = sl.wobbleAmp; l.wobbleSpeed = sl.wobbleSpeed;

  Object.assign(params.forces, snap.forces);
  Object.assign(params.avatar, snap.avatar);
  Object.assign(params.movement, snap.movement);
  Object.assign(params.camera, snap.camera);

  const p = params.post, sp = snap.post;
  Object.assign(p.kuwahara, sp.kuwahara);
  p.outline.enabled = sp.outline.enabled; p.outline.thickness = sp.outline.thickness;
  p.outline.threshold = sp.outline.threshold; p.outline.inkColor.set(sp.outline.inkColor); p.outline.strength = sp.outline.strength;
  Object.assign(p.bloom, sp.bloom);
  Object.assign(p.chromatic, sp.chromatic);
  Object.assign(p.grain, sp.grain);
  Object.assign(p.compose, sp.compose);

  Object.assign(params.debug, snap.debug);
}

export function exportJson(): string {
  return JSON.stringify(snapshot(), null, 2);
}

export function importJson(text: string): void {
  const snap = JSON.parse(text) as SerialisedSnapshot;
  applySnapshot(snap);
}

export function listPresets(): string[] {
  const all = readAll();
  return Object.keys(all);
}

export function savePreset(name: string, snap: SerialisedSnapshot): void {
  const all = readAll();
  all[name] = snap;
  writeAll(all);
}

export function deletePreset(name: string): void {
  if (BUILTIN_PRESETS[name]) return;
  const all = readAll();
  delete all[name];
  writeAll(all);
}

function readAll(): PresetMap {
  let user: PresetMap = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) user = JSON.parse(raw) as PresetMap;
  } catch {
    user = {};
  }
  return { ...BUILTIN_PRESETS, ...user };
}

function writeAll(all: PresetMap): void {
  const user: PresetMap = {};
  for (const k of Object.keys(all)) {
    if (!BUILTIN_PRESETS[k]) user[k] = all[k]!;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

// Built-in presets are derived from a defaults snapshot at module init.
// They stay constant across reloads.
function defaultsSnapshot(): SerialisedSnapshot {
  // Snapshot starts from current params; we briefly swap params with DEFAULT_PARAMS-equivalent
  // structure. Since DEFAULT_PARAMS is the params object itself, just snapshot live state at boot.
  return snapshot();
}

const BUILT: SerialisedSnapshot = defaultsSnapshot();
const BUILTIN_PRESETS: PresetMap = {
  Default: BUILT,
  Cinematic: cinematic(BUILT),
  Inkwash: inkwash(BUILT),
  Pastel: pastel(BUILT),
  'Neon Bruise': neonBruise(BUILT),
};

function clone(s: SerialisedSnapshot): SerialisedSnapshot {
  return JSON.parse(JSON.stringify(s)) as SerialisedSnapshot;
}

function cinematic(base: SerialisedSnapshot): SerialisedSnapshot {
  const s = clone(base);
  s.galaxy.contrast = 2.0; s.galaxy.density = 0.7; s.galaxy.swirl = 1.1; s.galaxy.drift = 0.05;
  s.post.bloom.strength = 0.9; s.post.bloom.threshold = 0.55;
  s.post.chromatic.amount = 0.005; s.post.chromatic.falloff = 0.85;
  s.post.compose.contrast = 1.18; s.post.compose.sat = 1.08;
  s.post.compose.vignette = 0.55; s.post.compose.vignetteSoftness = 0.5;
  s.post.kuwahara.radius = 4;
  return s;
}

function inkwash(base: SerialisedSnapshot): SerialisedSnapshot {
  const s = clone(base);
  s.galaxy.paletteA = '#0a0e1a'; s.galaxy.paletteB = '#1f2440'; s.galaxy.paletteC = '#5a6b88'; s.galaxy.paletteD = '#cdd2dc';
  s.galaxy.contrast = 1.4; s.galaxy.density = 0.6; s.galaxy.swirl = 0.8;
  s.links.inkColor = '#0e0e18';
  s.post.outline.strength = 0.95; s.post.outline.threshold = 0.008;
  s.post.outline.inkColor = '#0a0a14';
  s.post.bloom.strength = 0.4;
  s.post.compose.sat = 0.6; s.post.compose.contrast = 1.12;
  s.post.grain.intensity = 0.16; s.post.grain.paper = true;
  return s;
}

function pastel(base: SerialisedSnapshot): SerialisedSnapshot {
  const s = clone(base);
  s.galaxy.paletteA = '#243049'; s.galaxy.paletteB = '#9c80c2'; s.galaxy.paletteC = '#7ec3c4'; s.galaxy.paletteD = '#fbe7c2';
  s.galaxy.contrast = 1.4; s.galaxy.density = 0.55; s.galaxy.swirl = 0.7;
  s.nodes.palette.concepts = '#cfb8ff';
  s.nodes.palette.entities = '#a5e6cd';
  s.nodes.palette.sources = '#ffd9a3';
  s.nodes.palette.syntheses = '#ffb7c8';
  s.post.bloom.strength = 0.5;
  s.post.compose.sat = 1.15; s.post.compose.contrast = 0.96;
  s.post.compose.lift = 0.04;
  return s;
}

function neonBruise(base: SerialisedSnapshot): SerialisedSnapshot {
  const s = clone(base);
  s.galaxy.paletteA = '#0a0118'; s.galaxy.paletteB = '#651bd1'; s.galaxy.paletteC = '#e0299b'; s.galaxy.paletteD = '#ffeed1';
  s.galaxy.contrast = 1.9; s.galaxy.density = 0.75; s.galaxy.swirl = 1.3;
  s.env.rimStrength = 1.4; s.env.rimTint = '#ff8aff';
  s.post.bloom.strength = 1.2; s.post.bloom.threshold = 0.5; s.post.bloom.radius = 0.95;
  s.post.chromatic.amount = 0.008; s.post.chromatic.falloff = 0.5;
  s.post.compose.sat = 1.25; s.post.compose.contrast = 1.15; s.post.compose.gain = 1.05;
  return s;
}

void DEFAULT_PARAMS;
