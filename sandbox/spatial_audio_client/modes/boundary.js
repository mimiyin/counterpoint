import { Mode } from './mode.js';

// Boundary mode, like a parking sensor: silent far from the edge of the floor,
// faster beeps when closer, one steady tone at the edge
// It's not spatial

const BOUNDARY_WARN_M = 1.5;
const BOUNDARY_STEADY_M = 0.2;
const BEEP_FREQ = 880;
const BEEP_VOLUME = 0.3;
const BEEP_MS = 60;
const BEEP_GAP_MAX_MS = 600;
const BEEP_GAP_MIN_MS = 60;

const BEEP_ATTACK_MS = 5;
const BEEP_RELEASE_MS = 10;
const STEADY_FADE_MS = 20;

export class BoundaryMode extends Mode {
  constructor() {
    super();
    this.beep = null;
    this.nextBeepAt = 0;
    this.latestScene = null;
    this.boundaryDistance = null;
  }

  setup() {
    this.beep = new p5.Oscillator('sine');
    this.beep.freq(BEEP_FREQ);
    this.beep.amp(0);
    this.beep.start();
  }

  onScene(s) {
    this.latestScene = s;
  }

  update() {
    this.boundaryDistance = distanceToBoundary(this.latestScene);
    const d = this.boundaryDistance;

    // p5's amp() takes seconds
    if (d === null || d > BOUNDARY_WARN_M) {
      this.beep.amp(0, STEADY_FADE_MS / 1000);
    } else if (d <= BOUNDARY_STEADY_M) {
      this.beep.amp(BEEP_VOLUME, STEADY_FADE_MS / 1000);
    } else if (millis() >= this.nextBeepAt) {
      this.beep.amp(BEEP_VOLUME, BEEP_ATTACK_MS / 1000);
      this.beep.amp(0, BEEP_RELEASE_MS / 1000, BEEP_MS / 1000);
      const gap = map(d, BOUNDARY_STEADY_M, BOUNDARY_WARN_M, BEEP_GAP_MIN_MS, BEEP_GAP_MAX_MS);
      this.nextBeepAt = millis() + BEEP_MS + gap;
    }
  }

  status() {
    return this.boundaryDistance === null ? 'Waiting for the position' : 'Nearest edge: ' + this.boundaryDistance.toFixed(1) + ' m';
  }
}

function distanceToBoundary(scene) {
  if (!scene || !scene.listener) return null;

  const { x, z } = scene.listener;
  const left = x, right = scene.floor.width - x;
  const front = z, back = scene.floor.depth - z;
  return Math.max(0, Math.min(left, right, front, back));
}
