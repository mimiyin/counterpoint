import { TrackerStore, connectSocket, connectFake, keyboardRoomTracker, createRoomTransformer, createRoomTransformerFromConfig, identityTransformer } from '../tracker/index.js';

const COLS = 7;
const ROWS = 10;
const DIAM = 100;
let w, h; // cell dimensions

const SAMPLE_SIZE = 15;
const VIVE_CONFIG = '../config/grid_vive_calibration_2026-10-28_15-30-05.json';

let config;
let store;

function preload() {
  // config = loadJSON(VIVE_CONFIG);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;

  // store = new TrackerStore(createRoomTransformerFromConfig(config));
  // connectSocket(store);

  // A fake tracker moved with the arrow keys, starting at tracker (0, 0)
  // With identityTransformer, tracker units are canvas pixels, so the speed is pixels per second
  store = new TrackerStore(identityTransformer);
  connectFake(store, keyboardRoomTracker(400));
  
}

function draw() {
  render();
}

function getTracker() {
  const tracker = Object.values(store.getTrackers())[0];
  return tracker && !tracker.isStale() ? tracker : null;
}

function render() {
  background(255);

  display_grid();
  display_tracker();
}

function display_grid() {
  push();
  noStroke();

  for (let c = 0; c < COLS; c++) {
    let x = c * w;
    for (let r = 0; r < ROWS; r++) {
      let y = r * h;
      fill((c + r) % 2 == 0 ? 255 : 0);
      rect(x, y, w, h);
    }
  }

  pop();
}

function display_tracker() {
  const tracker = getTracker();
  if (!tracker) return;

  const pos = tracker.getPosByAvg(SAMPLE_SIZE);
  if (!pos) return;

  const cell = getCell(pos.x, pos.z);

  push();
  noStroke();
  fill('red');
  rect(cell.x, cell.y, w, h);
  stroke(255);
  noFill();
  ellipse(pos.x, pos.z, DIAM);
  pop();
}

function getCell(x, y) {
  let cx = floor(x / w) * w;
  let cy = floor(y / h) * h;
  return { x: cx, y: cy }
}

function keyPressed() {
}

// p5 looks for these on window, and a module does not put them there
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
