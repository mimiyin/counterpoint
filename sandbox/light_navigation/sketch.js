import { PulseMode } from './modes/pulse.js';
import { SweepMode } from './modes/sweep.js';
import { TwinPulseMode } from './modes/twin_pulse.js';
import { DirectionMode } from './modes/direction.js';
import { keepScreenOn } from '../utils/wake_lock.js';

const modes = [
  // new PulseMode(),
  // new SweepMode('horizontal'),
  // new SweepMode('vertical'),
  // new TwinPulseMode(),
  new DirectionMode(),
];

let current = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
  noStroke();
  rectMode(CENTER);
  keepScreenOn();
}

function draw() {
  modes[current].draw();
}

function mousePressed() {
  // Random mode, never the one already showing, so every tap visibly changes something
  current = (current + 1 + floor(random(modes.length - 1))) % modes.length;
  modes[current].start();
  keepScreenOn();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// p5 global mode looks for these on window; module scripts don't put them there
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.windowResized = windowResized;
