import { Mode } from './mode.js';

// Twin pulse mode: the screen is split into top and bottom halves, each with a white rectangle.
// Each rectangle shrinks to its center and grows back like the pulse mode, at its own period.

const TOP_SECONDS = 8;
const BOTTOM_SECONDS = 5;
// Rectangle height at full size, as a fraction of the screen height. Below 1/2 leaves black between the rectangles.
const RECT_FRACTION = 2 / 5;

export class TwinPulseMode extends Mode {
  draw() {
    background(0);
    fill(255);
    let t = millis() / 1000;
    let w = width;
    let h = height * RECT_FRACTION;
    let top = this.scale(t, TOP_SECONDS);
    let bottom = this.scale(t, BOTTOM_SECONDS);
    rect(width / 2, height / 4, w * top, h * top);
    rect(width / 2, height * 3 / 4, w * bottom, h * bottom);
  }

  // 1 -> 0 -> 1 over one period
  scale(t, seconds) {
    return (cos(TWO_PI * t / seconds) + 1) / 2;
  }
}
