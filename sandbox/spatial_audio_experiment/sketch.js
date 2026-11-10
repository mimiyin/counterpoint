import { TrackerStore, connectSocket, connectFake, keyboardRoomTracker, createRoomTransformer, createRoomTransformerFromConfig, metresPerPixelFromConfig, identityTransformer } from '../tracker/index.js';
import { io } from '/socket.io/socket.io.esm.min.js';

const COLS = 7;
const ROWS = 10;
const DIAM = 100;
let w, h; // cell dimensions

const SAMPLE_SIZE = 15;
const VIVE_CONFIG = '../config/grid_vive_calibration_2026-10-28_15-30-05.json';

let config;
let store;

// The controller places the sounds and sends the scene; the participant's phone (spatial_audio_client) plays it.
// Positions are sent in floor metres from the top-left corner of the canvas: x across, z down.
const FLOOR_WIDTH_M = 7; // real width of the projected floor, in metres; only used without a calibration config
let metresPerPixel;

let bellPos = null; // canvas pixels, where the bell was last clicked
let bellPlaying = false;
let listenerPos = null; // canvas pixels, from the tracker

// The whole spatial audio scene is sent to the server this often, for the participant's phone
const SEND_MS = 1000 / 30;
let socket;

function preload() {
  // config = loadJSON(VIVE_CONFIG);
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

  // From the calibration when there is one, assuming the tracker reports metres
  metresPerPixel = config ? metresPerPixelFromConfig(config) : FLOOR_WIDTH_M / width;

  socket = io();
  setInterval(sendSpatialAudioScene, SEND_MS);
}

// The current state only: where the listener and the sounds are, and which sounds are playing
function sendSpatialAudioScene() {
  socket.emit('spatial_audio_scene', {
    ts: Date.now() / 1000,
    floor: { width: width * metresPerPixel, depth: height * metresPerPixel },
    listener: listenerPos ? toFloor(listenerPos.x, listenerPos.y) : null,
    sources: bellPos ? [{ id: 'bell', sound: 'bell', ...toFloor(bellPos.x, bellPos.y), playing: bellPlaying }] : [],
  });
}

// Canvas pixels to floor metres
function toFloor(x, y) {
  return { x: x * metresPerPixel, z: y * metresPerPixel };
}

function draw() {
  updateListener();
  render();
}

function updateListener() {
  const tracker = getTracker();
  const pos = tracker ? tracker.getPosByAvg(SAMPLE_SIZE) : null;
  if (!pos) return;

  listenerPos = { x: pos.x, y: pos.z };
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
  fill(bellPlaying ? 'orange' : 'gray');
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

function mousePressed() {
  bellPos = { x: mouseX, y: mouseY };
  bellPlaying = true;
}

function mouseReleased() {
  bellPlaying = false;
}

// p5 looks for these on window, and a module does not put them there
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
