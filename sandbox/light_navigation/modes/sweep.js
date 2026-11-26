import { Mode } from './mode.js';

// Sweep mode: the white screen slides off and back on, easing in and out.
// 'horizontal': slides right until it's gone, then slides back left to full screen.
// 'vertical': slides down until it's gone, then slides back up to full screen.

const SWEEP_SECONDS = 4;

export class SweepMode extends Mode {
  constructor(direction) {
    super();
    this.direction = direction;
  }

  draw() {
    background(0);
    let p = (1 - cos(TWO_PI * (millis() / 1000) / SWEEP_SECONDS)) / 2;  // 0 -> 1 -> 0
    fill(255);
    if (this.direction === 'horizontal') {
      rect(width / 2 + p * width, height / 2, width, height);
    } else {
      rect(width / 2, height / 2 + p * height, width, height);
    }
  }
}
