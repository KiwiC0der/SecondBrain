import * as THREE from 'three';
import { params } from '../state/params';
import type { Avatar } from './Avatar';

const KEY_FORWARD = ['KeyW', 'ArrowUp'];
const KEY_BACK = ['KeyS', 'ArrowDown'];
const KEY_LEFT = ['KeyA', 'ArrowLeft'];
const KEY_RIGHT = ['KeyD', 'ArrowRight'];
const KEY_UP = ['Space'];
const KEY_DOWN = ['ControlLeft', 'ControlRight'];
const KEY_BOOST = ['ShiftLeft', 'ShiftRight'];

/**
 * Stable yaw-based third-person rig.
 *
 * - Avatar is always rendered at screen center.
 * - Mouse X (pointer-locked) rotates a single yaw angle around the avatar; the avatar's facing
 *   tracks that yaw with smooth slerp so direction changes never snap.
 * - Mouse Y pitches the camera around the avatar; the avatar mesh stays upright (only the camera tilts).
 * - WASD planar relative to yaw; Space/Ctrl ascend/descend; Shift boost.
 * - Movement is integrated with damping so direction changes are smooth.
 */
export class Controls {
  yaw = 0;
  pitch = -0.15;

  private position = new THREE.Vector3(0, 0, 0);
  private velocity = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private cameraPos = new THREE.Vector3();
  private avatarYawRendered = 0;

  private keys = new Set<string>();
  private pointerLocked = false;

  private avatar: Avatar;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  private hudHint: HTMLDivElement;

  constructor(avatar: Avatar, camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.avatar = avatar;
    this.camera = camera;
    this.domElement = domElement;

    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.hudHint = document.createElement('div');
    this.hudHint.id = 'galaxy-pointerlock-hint';
    this.hudHint.textContent = 'click to fly - WASD + Space/Ctrl + Shift - ESC to release';
    const styles: Record<string, string> = {
      position: 'fixed',
      bottom: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 14px',
      background: 'rgba(8, 10, 18, 0.55)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#cfd0e6',
      font: '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      letterSpacing: '0.04em',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.08)',
      pointerEvents: 'none',
      transition: 'opacity 0.3s ease',
      zIndex: '5',
    };
    for (const k of Object.keys(styles)) {
      this.hudHint.style.setProperty(k.replace(/([A-Z])/g, '-$1').toLowerCase(), styles[k] ?? '');
    }
    document.body.appendChild(this.hudHint);
  }

  setInitialPose(p: THREE.Vector3, yaw = 0): void {
    this.position.copy(p);
    this.yaw = yaw;
    this.avatarYawRendered = yaw;
    this.snapCamera();
  }

  get worldPosition(): THREE.Vector3 {
    return this.position;
  }

  /** Engage pointer lock; main.ts decides when to call this (after a non-node click). */
  requestLock(): void {
    if (!this.pointerLocked) this.domElement.requestPointerLock?.();
  }

  get isLocked(): boolean {
    return this.pointerLocked;
  }

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.domElement;
    this.hudHint.style.opacity = this.pointerLocked ? '0' : '1';
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.yaw -= e.movementX * params.movement.yawSensitivity;
    this.pitch -= e.movementY * params.movement.pitchSensitivity;
    this.pitch = Math.max(params.movement.pitchMin, Math.min(params.movement.pitchMax, this.pitch));
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
  private onBlur = (): void => {
    this.keys.clear();
  };

  private down(codes: string[]): boolean {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  update(dt: number): void {
    // Build target velocity from input, in world space.
    const fwd = (this.down(KEY_FORWARD) ? 1 : 0) - (this.down(KEY_BACK) ? 1 : 0);
    const strafe = (this.down(KEY_RIGHT) ? 1 : 0) - (this.down(KEY_LEFT) ? 1 : 0);
    const lift = (this.down(KEY_UP) ? 1 : 0) - (this.down(KEY_DOWN) ? 1 : 0);
    const boosted = this.down(KEY_BOOST);

    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    // forward = -Z in world coordinates; rotate by yaw around Y.
    const forwardX = -sin * fwd;
    const forwardZ = -cos * fwd;
    const strafeX = cos * strafe;
    const strafeZ = -sin * strafe;

    const speed = params.movement.maxSpeed * (boosted ? params.movement.boostMultiplier : 1.0);
    const targetVel = new THREE.Vector3(
      (forwardX + strafeX) * speed,
      lift * speed * 0.6,
      (forwardZ + strafeZ) * speed,
    );

    // Critically-damped lerp toward target velocity.
    const accelMix = 1.0 - Math.exp(-params.movement.accel * dt);
    this.velocity.lerp(targetVel, accelMix);

    // If no input, apply explicit friction so we don't drift forever.
    if (fwd === 0 && strafe === 0 && lift === 0) {
      const frictionMix = 1.0 - Math.exp(-params.movement.friction * dt);
      this.velocity.multiplyScalar(1.0 - frictionMix);
    }

    this.position.addScaledVector(this.velocity, dt);

    // Smoothly slerp avatar yaw toward control yaw so the model never snaps.
    const yawLerp = 1.0 - Math.exp(-12.0 * dt);
    this.avatarYawRendered = lerpAngle(this.avatarYawRendered, this.yaw, yawLerp);
    this.avatar.velocity.copy(this.velocity);
    this.avatar.setPose(this.position, this.avatarYawRendered);

    // Camera: behind and above the avatar, looking at the avatar.
    this.computeCameraPose();
    const camLerp = 1.0 - Math.exp(-(1.0 / Math.max(0.001, params.avatar.followLerp)) * dt);
    this.camera.position.lerp(this.cameraPos, camLerp);
    this.camera.lookAt(this.cameraTarget);
  }

  private computeCameraPose(): void {
    const dist = params.avatar.followDistance;
    const height = params.avatar.followHeight;
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    // Place camera on a sphere of radius `dist` around the avatar, with pitch.
    const horiz = Math.cos(this.pitch);
    const vert = Math.sin(this.pitch);
    this.cameraPos.set(
      this.position.x + sin * dist * horiz,
      this.position.y + height + vert * dist,
      this.position.z + cos * dist * horiz,
    );
    this.cameraTarget.copy(this.position).y += 0.4 + height * 0.25;
  }

  private snapCamera(): void {
    this.computeCameraPose();
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  dispose(): void {
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.hudHint.remove();
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
