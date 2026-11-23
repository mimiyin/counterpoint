import { Mode } from './mode.js';
import { targetOffsetDegrees } from './target_offset.js';

// Steer with rhythm mode: beeps in the ear on the target's side, the further the target is round, the faster the beeps.
// Silent when facing the target, one steady tone when it is directly behind. Not spatial, the ear is the direction.

const BEEP_FREQ = 330;
const BEEP_VOLUME = 0.5;
const BEEP_MS = 100;
const BEEP_GAP_MAX_MS = 1000;
const BEEP_GAP_MIN_MS = 80;

const SILENT_BELOW_DEG = 5;
const STEADY_ABOVE_DEG = 170;

const BEEP_ATTACK_MS = 5;
const BEEP_RELEASE_MS = 10;
const STEADY_FADE_MS = 20;

export class SteerWithRhythmMode extends Mode {
  constructor() {
    super();
    this.beep = null;
    this.nextBeepAt = 0;
    this.latestScene = null;
    this.targetOffsetDegrees = null;
  }

  setup() {
    this.beep = new p5.Oscillator('triangle');
    this.beep.freq(BEEP_FREQ);
    this.beep.amp(0);
    this.beep.start();
  }

  onScene(s) {
    this.latestScene = s;
  }

  update(turnDegrees) {
    this.targetOffsetDegrees = targetOffsetDegrees(this.latestScene, turnDegrees);
    const offset = this.targetOffsetDegrees;

    if (offset === null || Math.abs(offset) < SILENT_BELOW_DEG) {
      this.beep.amp(0, STEADY_FADE_MS / 1000);
      return;
    }

    this.beep.pan(Math.sign(offset));

    const angle = Math.abs(offset);
    if (angle >= STEADY_ABOVE_DEG) {
      this.beep.amp(BEEP_VOLUME, STEADY_FADE_MS / 1000);
    } else if (millis() >= this.nextBeepAt) {
      this.beep.amp(BEEP_VOLUME, BEEP_ATTACK_MS / 1000);
      this.beep.amp(0, BEEP_RELEASE_MS / 1000, BEEP_MS / 1000);
      const gap = map(angle, SILENT_BELOW_DEG, STEADY_ABOVE_DEG, BEEP_GAP_MAX_MS, BEEP_GAP_MIN_MS);
      this.nextBeepAt = millis() + BEEP_MS + gap;
    }
  }

  status() {
    const offset = this.targetOffsetDegrees;
    if (offset === null) return 'Waiting for a target';
    if (Math.abs(offset) < SILENT_BELOW_DEG) return 'Target ahead';
    return offset > 0 ? 'Target on the right' : 'Target on the left';
  }
}
