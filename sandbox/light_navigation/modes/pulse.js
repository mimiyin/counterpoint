import { Mode } from './mode.js';

// Pulse mode: the white screen shrinks to the center until it disappears, then expands back to full screen
// It simulates back and forth motion.

const PULSE_SECONDS = 8;

export class PulseMode extends Mode {
  draw() {
    background(0);
    let s = (cos(TWO_PI * (millis() / 1000) / PULSE_SECONDS) + 1) / 2;  // 1 -> 0 -> 1
    fill(255);
    rect(width / 2, height / 2, width * s, height * s);
  }
}
