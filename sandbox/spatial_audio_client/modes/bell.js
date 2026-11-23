import { Mode } from './mode.js';
import { createFrontBackSource, placeSourceOnFloor } from '../resonance.js';
import { targetOffsetDegrees } from './target_offset.js';

// Bell mode: a bell sounds from the controller's target, in spatial audio

const PULSE_MS = 1500;

export class BellMode extends Mode {
  constructor() {
    super();
    this.bell = null;
    this.bellSource = null;
    this.setFrontness = null;
    this.latestScene = null;
    this.pulseTimer = null;
  }

  preload() {
    this.bell = loadSound('../GOL_man/bell.wav');
  }

  setup() {
    this.bell.playMode('restart');
    this.bell.setVolume(0.5);

    const { source, setFrontness } = createFrontBackSource(this.bell);
    this.bellSource = source;
    this.setFrontness = setFrontness;
  }

  update(turnDegrees) {
    const offset = targetOffsetDegrees(this.latestScene, turnDegrees);
    if (offset !== null) this.setFrontness(Math.cos(offset * Math.PI / 180));  // 1 ahead, 0 at the sides, -1 behind
  }

  onScene(s) {
    this.latestScene = s;
    const sourceData = s.sources.find((src) => src.id === 'target');
    if (sourceData) {
      placeSourceOnFloor(this.bellSource, sourceData);
    }
  
    this.setBellPlaying(sourceData ? sourceData.playing : false);
  }

  status() {
    return this.pulseTimer ? 'Bell playing' : 'Listening';
  }

  setBellPlaying(playing) {
    if (playing && this.pulseTimer === null) {
      this.bell.play();
      this.pulseTimer = setInterval(() => this.bell.play(), PULSE_MS);
    } else if (!playing && this.pulseTimer !== null) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }
}
