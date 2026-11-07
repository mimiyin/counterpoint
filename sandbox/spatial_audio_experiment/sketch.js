import { TrackerStore, connectSocket, connectFake, keyboardRoomTracker, createRoomTransformer, createRoomTransformerFromConfig, identityTransformer } from '../tracker/index.js';

const COLS = 7;
const ROWS = 10;
const DIAM = 100;
let w, h; // cell dimensions

const SAMPLE_SIZE = 15;
const VIVE_CONFIG = '../config/grid_vive_calibration_2026-10-28_15-30-05.json';

let config;
let store;

const PULSE_MS = 1500;
let bell;
let pulseTimer = null;

// Spatial audio with Resonance Audio, for headphones. Resonance works in metres:
// x to the right, y up, -z forward. The listener always faces forward, the top of the canvas.
const FLOOR_WIDTH_M = 7; // real width of the projected floor, in metres
let metresPerPixel;

const ROOM_HEIGHT_M = 3;
const EAR_HEIGHT_M = 1.6;
const ROOM_MATERIALS = {
  left: 'plaster-smooth', right: 'plaster-smooth',
  front: 'plaster-smooth', back: 'plaster-smooth',
  down: 'polished-concrete-or-tile', up: 'acoustic-ceiling-tiles',
};
let scene, bellSource;
let bellPos = null; // canvas pixels, where the bell was last clicked

function preload() {
  // config = loadJSON(VIVE_CONFIG);
  bell = loadSound('../GOL_man/bell.wav');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;

  // store = new TrackerStore(createRoomTransformerFromConfig(config));
  // connectSocket(store);

  // A fake tracker moved with the W A S D keys, starting at tracker (0, 0)
  // With identityTransformer, tracker units are canvas pixels, so the speed is pixels per second
  store = new TrackerStore(identityTransformer);
  connectFake(store, keyboardRoomTracker(400));

  // Audio setup
  bell.playMode('restart');
  bell.setVolume(0.5);

  // Resonance shares p5's audio context, and the bell plays through a Resonance source instead of straight out
  metresPerPixel = FLOOR_WIDTH_M / width;
  scene = new ResonanceAudio(getAudioContext());
  scene.output.connect(getAudioContext().destination);
  scene.setListenerOrientation(0, 0, -1, 0, 1, 0); // facing forward, head up
  scene.setRoomProperties(
    { width: width * metresPerPixel, height: ROOM_HEIGHT_M, depth: height * metresPerPixel },
    ROOM_MATERIALS
  );

  bellSource = scene.createSource();
  bell.disconnect();
  bell.connect(bellSource.input);
}

function draw() {
  updateListener();
  render();
}

function updateListener() {
  const tracker = getTracker();
  const pos = tracker ? tracker.getPosByAvg(SAMPLE_SIZE) : null;
  if (!pos) return;

  const p = toRoom(pos.x, pos.z);
  scene.setListenerPosition(p.x, p.y, p.z);
}

// Canvas pixels to Resonance metres. Resonance puts the centre of the room at (0, 0, 0),
// so the canvas centre becomes x = 0, z = 0, and ear height is measured up from the floor.
// Canvas x is Resonance x, canvas down (tracker z) is Resonance +z, which is behind the listener.
function toRoom(x, z) {
  return {
    x: (x - width / 2) * metresPerPixel,
    y: EAR_HEIGHT_M - ROOM_HEIGHT_M / 2,
    z: (z - height / 2) * metresPerPixel,
  };
}

function getTracker() {
  const tracker = Object.values(store.getTrackers())[0];
  return tracker && !tracker.isStale() ? tracker : null;
}

function render() {
  background(255);

  display_grid();
  display_tracker();
  display_bell();
}

function display_bell() {
  if (!bellPos) return;

  push();
  noStroke();
  fill(pulseTimer ? 'orange' : 'gray');
  circle(bellPos.x, bellPos.y, DIAM / 2);
  pop();
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

// The bell is placed where the mouse is pressed, and strikes there while it is held
function mousePressed() {
  userStartAudio();
  bellPos = { x: mouseX, y: mouseY };
  const p = toRoom(mouseX, mouseY);
  bellSource.setPosition(p.x, p.y, p.z);
  pulse();
  clearInterval(pulseTimer);
  pulseTimer = setInterval(pulse, PULSE_MS);
}

function mouseReleased() {
  clearInterval(pulseTimer);
  pulseTimer = null;
}

function pulse() {
  bell.play();
}

// p5 looks for these on window, and a module does not put them there
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
