import * as THREE from 'three';

/**
 * The single, mutable source of truth for every tunable parameter in the app.
 * Subsystems read from here every frame; the M4 Tweakpane toolbar writes to here.
 */
export interface Params {
  galaxy: {
    paletteA: THREE.Color;
    paletteB: THREE.Color;
    paletteC: THREE.Color;
    paletteD: THREE.Color;
    contrast: number;
    density: number;
    octaves: number;
    swirl: number;
    drift: number;
    coreOffset: THREE.Vector2;
    starCount: number;
    starSize: number;
    starTwinkle: number;
    brushCount: number;
    brushScale: number;
    brushOpacity: number;
  };
  env: {
    intensity: number;
    rimStrength: number;
    rimPower: number;
    rimTint: THREE.Color;
    toonBands: number;
    toonSoftness: number;
    paperGrain: number;
  };
  nodes: {
    baseSize: number;
    sizeExp: number;
    glowBase: number;
    glowGain: number;
    hoverScale: number;
    palette: {
      sources: THREE.Color;
      entities: THREE.Color;
      concepts: THREE.Color;
      syntheses: THREE.Color;
      other: THREE.Color;
    };
  };
  links: {
    width: number;
    opacity: number;
    inkColor: THREE.Color;
    wobbleAmp: number;
    wobbleSpeed: number;
  };
  forces: {
    linkDistance: number;
    linkStrength: number;
    charge: number;
    centerStrength: number;
    collidePadding: number;
    attractRadius: number;
    attractStrength: number;
    repelRadius: number;
    repelStrength: number;
  };
  avatar: {
    scale: number;
    followDistance: number;
    followHeight: number;
    followLerp: number;
    bobAmp: number;
    bankAmount: number;
  };
  movement: {
    maxSpeed: number;
    accel: number;
    friction: number;
    yawSensitivity: number;
    pitchSensitivity: number;
    pitchMin: number;
    pitchMax: number;
    boostMultiplier: number;
  };
  camera: {
    fov: number;
    near: number;
    far: number;
  };
  post: {
    kuwahara: { enabled: boolean; radius: number; passes: number };
    outline:  { enabled: boolean; thickness: number; threshold: number; inkColor: THREE.Color; strength: number };
    bloom:    { enabled: boolean; threshold: number; strength: number; radius: number };
    chromatic:{ enabled: boolean; amount: number; falloff: number };
    grain:    { enabled: boolean; intensity: number; scale: number; paper: boolean };
    compose:  {
      enabled: boolean;
      vignette: number;
      vignetteSoftness: number;
      hueShift: number;
      sat: number;
      contrast: number;
      lift: number;
      gamma: number;
      gain: number;
    };
  };
  debug: {
    showFps: boolean;
    showStats: boolean;
    freeFly: boolean;
  };
}

export const DEFAULT_PARAMS: Params = {
  galaxy: {
    paletteA: new THREE.Color('#1a1438'),
    paletteB: new THREE.Color('#5a2cb0'),
    paletteC: new THREE.Color('#26b3a3'),
    paletteD: new THREE.Color('#f6c79c'),
    contrast: 1.7,
    density: 0.55,
    octaves: 4,
    swirl: 0.85,
    drift: 0.04,
    coreOffset: new THREE.Vector2(0.3, -0.15),
    starCount: 4500,
    starSize: 0.9,
    starTwinkle: 0.6,
    brushCount: 14,
    brushScale: 1.2,
    brushOpacity: 0.55,
  },
  env: {
    intensity: 1.0,
    rimStrength: 0.85,
    rimPower: 2.5,
    rimTint: new THREE.Color('#c8a4ff'),
    toonBands: 3,
    toonSoftness: 0.25,
    paperGrain: 0.18,
  },
  nodes: {
    baseSize: 0.9,
    sizeExp: 0.55,
    glowBase: 0.8,
    glowGain: 1.3,
    hoverScale: 1.35,
    palette: {
      sources: new THREE.Color('#ffd28b'),
      entities: new THREE.Color('#8be0c0'),
      concepts: new THREE.Color('#b8a6ff'),
      syntheses: new THREE.Color('#ff9ab1'),
      other: new THREE.Color('#c0c4cc'),
    },
  },
  links: {
    width: 0.06,
    opacity: 0.55,
    inkColor: new THREE.Color('#9aa0c8'),
    wobbleAmp: 0.18,
    wobbleSpeed: 0.6,
  },
  forces: {
    linkDistance: 8,
    linkStrength: 0.25,
    charge: -28,
    centerStrength: 0.04,
    collidePadding: 0.6,
    attractRadius: 14,
    attractStrength: 0.16,
    repelRadius: 9,
    repelStrength: 28,
  },
  avatar: {
    scale: 1.0,
    followDistance: 7.5,
    followHeight: 2.2,
    followLerp: 0.12,
    bobAmp: 0.06,
    bankAmount: 0.35,
  },
  movement: {
    maxSpeed: 14,
    accel: 18,
    friction: 5.5,
    yawSensitivity: 0.0028,
    pitchSensitivity: 0.0024,
    pitchMin: -1.05,
    pitchMax: 1.05,
    boostMultiplier: 2.4,
  },
  camera: {
    fov: 60,
    near: 0.1,
    far: 5000,
  },
  post: {
    kuwahara: { enabled: true, radius: 3, passes: 1 },
    outline: {
      enabled: true,
      thickness: 1.0,
      threshold: 0.012,
      inkColor: new THREE.Color('#1a1838'),
      strength: 0.55,
    },
    bloom: { enabled: true, threshold: 0.62, strength: 0.62, radius: 0.8 },
    chromatic: { enabled: true, amount: 0.0035, falloff: 0.65 },
    grain: { enabled: true, intensity: 0.085, scale: 1700, paper: false },
    compose: {
      enabled: true,
      vignette: 0.35,
      vignetteSoftness: 0.42,
      hueShift: 0.0,
      sat: 1.05,
      contrast: 1.06,
      lift: 0.0,
      gamma: 1.0,
      gain: 1.0,
    },
  },
  debug: {
    showFps: true,
    showStats: false,
    freeFly: false,
  },
};

export const params: Params = DEFAULT_PARAMS;
