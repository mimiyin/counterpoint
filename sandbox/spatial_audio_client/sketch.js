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

let heading = null;
let forwardHeading = 0;
let warnings = [];

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

// The phone is held screen-up, so the direction it faces is where its top edge points.
// alpha is that direction, counterclockwise; tilting the phone (beta) or rolling it (gamma) does not change it,
// until the phone is nearly upright and the top edge points at the ceiling.
const MAX_TILT = 70; // degrees; tilted further than this, the heading is unreliable
let tiltedTooFar = false;

function onOrientation(e) {
  if (e.alpha === null) return;
  heading = -e.alpha; // clockwise, so turning right is positive
  tiltedTooFar = Math.abs(e.beta) > MAX_TILT;

  // Resonance forward is -z. Turning right should swing it towards +x, but Resonance turns the sound
  // the opposite way (on a phone, turning left moved a front sound to the left ear), so x is negated.
  const turn = (heading - forwardHeading) * Math.PI / 180;
  scene.setListenerOrientation(-Math.sin(turn), 0, -Math.cos(turn), 0, 1, 0);
}

// iOS asks for permission to use the motion sensor, and only from a tap
async function startMotionSensor() {
  if (!window.isSecureContext) {
    warnings.push('Motion sensor needs HTTPS');
    return;
  }

  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const answer = await DeviceOrientationEvent.requestPermission();
      if (answer !== 'granted') throw new Error('permission ' + answer);
    }

    window.addEventListener('deviceorientation', onOrientation);
  } catch (error) {
    warnings.push('Motion sensor: ' + error.message);
  }
}

async function keepScreenOn() {
  if (!('wakeLock' in navigator)) {
    warnings.push(window.isSecureContext ? 'Screen may sleep: no wake lock in this browser' : 'Screen may sleep: needs HTTPS');
    return;
  }

  try {
    await navigator.wakeLock.request('screen');
  } catch (error) {
    warnings.push('Screen may sleep: ' + error.message);
  }
}

document.addEventListener('visibilitychange', () => {
  if (started && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
});

function draw() {
  background(started ? 255 : 0);
  fill(started ? 0 : 255);
  textAlign(CENTER, CENTER);
  textSize(width / 15);

  if (!started) {
    text('Tap to start', width / 2, height / 2);
    return;
  }

  text(!latest ? 'Waiting for the controller' : pulseTimer ? 'Bell playing' : 'Listening', width / 2, height / 2);

  textSize(width / 25);
  if (heading !== null) {
    // How far the phone is turned from forward, -180 to 180 degrees, right is positive
    const turn = ((heading - forwardHeading) % 360 + 540) % 360 - 180;
    text('Turned ' + Math.round(turn) + '°\nFace the front and tap to set forward', width / 2, height / 2 + width / 6);
    if (tiltedTooFar) text('Hold the phone flatter, screen up', width / 2, height / 2 + width / 3);
  }
  text(warnings.join('\n'), width / 2, height * 0.8);
}

// The first tap starts sound, the motion sensor and the wake lock, which phones only allow from a tap.
// Later taps set the direction the phone faces now as forward.
// It runs on the browser's click event: iPhones only show the motion sensor prompt from a real tap like that.
function mouseClicked() {
  if (started) {
    if (heading !== null) forwardHeading = heading;
    return;
  }

  userStartAudio();
  startMotionSensor();
  keepScreenOn();
  started = true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// p5 looks for these on window, and a module does not put them there
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.mouseClicked = mouseClicked;
window.windowResized = windowResized;
