import { Mode } from './mode.js';
import { targetOffsetDegrees } from './target_offset.js';

// Steer with volume mode: a steady tone in the ear on the target's side, louder the further the target is to the side.
// Silent when facing the target. Not spatial, the ear is the direction.

const TONE_FREQ = 330;
const TONE_MAX_VOLUME = 0.5;
const TONE_SILENT_BELOW_DEG = 5;
const TONE_FULLEST_AT_DEG = 180;
const VOLUME_RAMP_MS = 50;  // a volume change glides over this long

export class SteerWithVolumeMode extends Mode {
  constructor() {
    super();
    this.tone = null;
    this.latestScene = null;
    this.targetOffsetDegrees = null;
  }

  setup() {
    this.tone = new p5.Oscillator('triangle');
    this.tone.freq(TONE_FREQ);
    this.tone.amp(0);
    this.tone.start();
  }

  onScene(s) {
    this.latestScene = s;
  }

  update(turnDegrees) {
    this.targetOffsetDegrees = targetOffsetDegrees(this.latestScene, turnDegrees);
    const offset = this.targetOffsetDegrees;

    if (offset === null) {
      this.tone.amp(0, VOLUME_RAMP_MS / 1000);
      return;
    }

    const volume = Math.abs(offset) < TONE_SILENT_BELOW_DEG
      ? 0
      : map(Math.abs(offset), TONE_SILENT_BELOW_DEG, TONE_FULLEST_AT_DEG, 0, TONE_MAX_VOLUME, true);
    this.tone.pan(Math.sign(offset));
    this.tone.amp(volume, VOLUME_RAMP_MS / 1000);
  }

  status() {
    const offset = this.targetOffsetDegrees;
    if (offset === null) return 'Waiting for a target';
    if (Math.abs(offset) < TONE_SILENT_BELOW_DEG) return 'Target ahead';
    return offset > 0 ? 'Target on the right' : 'Target on the left';
  }
}
