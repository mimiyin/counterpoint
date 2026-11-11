import { Mode } from './mode.js';
import { createSpatialSource, placeSourceOnFloor } from '../resonance.js';

// Bell mode: the bell placed by the controller, in spatial audio

const PULSE_MS = 1500;

export class BellMode extends Mode {
  constructor() {
    super();
    this.bell = null;
    this.bellSource = null;
    this.pulseTimer = null;
  }

  preload() {
    this.bell = loadSound('../GOL_man/bell.wav');
  }

  setup() {
    this.bell.playMode('restart');
    this.bell.setVolume(0.5);

    this.bellSource = createSpatialSource(this.bell);
  }

  onScene(s) {
    const sourceData = s.sources.find((src) => src.id === 'bell');
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
