import { Mode } from './mode.js';
import { targetOffsetDegrees } from './target_offset.js';

// Steer with pan mode: a steady tone panned by how far the target is round, and louder the further round it is.
// Silent when facing the target. All in one ear when it is FULL_PAN_AT_DEG or more to that side.

const TONE_FREQ = 330;
const TONE_MAX_VOLUME = 0.5;
const SILENT_BELOW_DEG = 5;
const FULL_PAN_AT_DEG = 180;
const FULL_VOLUME_AT_DEG = 180;
const VOLUME_RAMP_MS = 50;  // a volume change glides over this long

export class SteerWithPanMode extends Mode {
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

    const volume = Math.abs(offset) < SILENT_BELOW_DEG
      ? 0
      : map(Math.abs(offset), SILENT_BELOW_DEG, FULL_VOLUME_AT_DEG, 0, TONE_MAX_VOLUME, true);
    this.tone.pan(offset / FULL_PAN_AT_DEG);  // -1 to 1 while FULL_PAN_AT_DEG is 180, the largest angle
    this.tone.amp(volume, VOLUME_RAMP_MS / 1000);
  }

  status() {
    const offset = this.targetOffsetDegrees;
    if (offset === null) return 'Waiting for a target';
    return 'Target ' + Math.abs(Math.round(offset)) + '° to the ' + (offset > 0 ? 'right' : 'left');
  }
}
