import { io } from '/socket.io/socket.io.esm.min.js';


const PULSE_MS = 1500;
let bell;
let pulseTimer = null;

// Spatial audio with Resonance Audio, for headphones. Resonance works in metres:
// x to the right, y up, -z forward, with the centre of the room at (0, 0, 0).
// The listener always faces forward, the top of the controller's canvas.
const ROOM_HEIGHT_M = 3;
const EAR_HEIGHT_M = 1.6;
const ROOM_MATERIALS = {
  left: 'plaster-smooth', right: 'plaster-smooth',
  front: 'plaster-smooth', back: 'plaster-smooth',
  down: 'polished-concrete-or-tile', up: 'acoustic-ceiling-tiles',
};

let scene, bellSource;
let floorSize = null; // width and depth of the floor in metres, from the controller

let latest = null;
let started = false;

function preload() {
  bell = loadSound('../GOL_man/bell.wav');
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  bell.playMode('restart');
  bell.setVolume(0.5);

  scene = new ResonanceAudio(getAudioContext());
  scene.output.connect(getAudioContext().destination);
  scene.setListenerOrientation(0, 0, -1, 0, 1, 0); // facing forward, head up

  bellSource = scene.createSource();
  bell.disconnect();
  bell.connect(bellSource.input);

  const socket = io();
  socket.on('spatial_audio_scene', applyScene);
}

function applyScene(s) {
  latest = s;

  // Setting the room rebuilds the reverb, so only do it when the floor size changes
  if (!floorSize || floorSize.width !== s.floor.width || floorSize.depth !== s.floor.depth) {
    floorSize = s.floor;
    scene.setRoomProperties({ width: floorSize.width, height: ROOM_HEIGHT_M, depth: floorSize.depth }, ROOM_MATERIALS);
  }

  if (s.listener) {
    const p = toRoom(s.listener);
    scene.setListenerPosition(p.x, p.y, p.z);
  }

  const source = s.sources.find((src) => src.id === 'bell');
  if (source) {
    const p = toRoom(source);
    bellSource.setPosition(p.x, p.y, p.z);
  }
  setBellPlaying(source ? source.playing : false);
}

// Floor metres (from the top-left corner, z down the canvas) to Resonance metres (from the centre of the room).
// Canvas down is Resonance +z, which is behind the listener.
function toRoom(pos) {
  return {
    x: pos.x - floorSize.width / 2,
    y: EAR_HEIGHT_M - ROOM_HEIGHT_M / 2,
    z: pos.z - floorSize.depth / 2,
  };
}

// Strike once straight away, then every PULSE_MS, until the scene says to stop
function setBellPlaying(playing) {
  if (playing && pulseTimer === null) {
    bell.play();
    pulseTimer = setInterval(() => bell.play(), PULSE_MS);
  } else if (!playing && pulseTimer !== null) {
    clearInterval(pulseTimer);
    pulseTimer = null;
  }
}

function draw() {
  background(started ? 255 : 0);
  fill(started ? 0 : 255);
  textAlign(CENTER, CENTER);
  textSize(width / 15);

  if (!started) {
    text('Tap to start', width / 2, height / 2);
  } else if (!latest) {
    text('Waiting for the controller', width / 2, height / 2);
  } else {
    text(pulseTimer ? 'Bell playing' : 'Listening', width / 2, height / 2);
  }
}

// Phones only allow sound after a tap
function mousePressed() {
  userStartAudio();
  started = true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// p5 looks for these on window, and a module does not put them there
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.windowResized = windowResized;
