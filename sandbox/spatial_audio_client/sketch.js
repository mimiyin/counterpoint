import { io } from '/socket.io/socket.io.esm.min.js';
import { startResonance, updateRoom, placeListenerOnFloor, turnListener } from './resonance.js';
import { BellMode } from './modes/bell.js';
import { BoundaryMode } from './modes/boundary.js';

// What the phone plays: uncomment one
const MODE = 'bell';
// const MODE = 'boundary';
const MODES = { bell: BellMode, boundary: BoundaryMode };
const mode = new MODES[MODE]();

const MAX_TILT_DEGREES = 70;

let started = false;
let warnings = [];
let latestScene = null;

let phoneHeadingDegrees = null;
let forwardHeadingDegrees = 0;
let tiltedTooFar = false;


function preload() {
  mode.preload();
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  startResonance();
  mode.setup();

  const socket = io();
  socket.on('spatial_audio_scene', applyScene);
}

function draw() {
  if (started) mode.update();
  render();
}

function mouseClicked() {
  if (started) {
    setCurrentHeadingAsForward();
    return;
  }

  // Treat the page as media playback, so the iPhone's silent switch does not mute it
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  userStartAudio();
  startMotionSensor();
  keepScreenOn();
  started = true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function applyScene(s) {
  latestScene = s;
  updateRoom(s.floor);
  if (s.listener) placeListenerOnFloor(s.listener);
  mode.onScene(s);
}

function onOrientation(e) {
  if (e.alpha === null) return;
  phoneHeadingDegrees = -e.alpha;
  tiltedTooFar = Math.abs(e.beta) > MAX_TILT_DEGREES;
  turnListener(turnDegrees());
}

function setCurrentHeadingAsForward() {
  if (phoneHeadingDegrees !== null) forwardHeadingDegrees = phoneHeadingDegrees;
}

// How far the phone is turned from forward, -180 to 180 degrees, right is positive.
// The raw difference can be anything (350 and -350 both mean turned 10 degrees), so it is folded into -180 to 180:
//   % 360   within one turn, but JavaScript keeps the sign, so -359 to 359
//   + 540   that is + 360 to make it positive, and + 180 to cancel the - 180 at the end
//   % 360   0 to 359
//   - 180   -180 to 179
// e.g. 350 -> 350 -> 890 -> 170 -> -10 (turned left 10)
function turnDegrees() {
  return ((phoneHeadingDegrees - forwardHeadingDegrees) % 360 + 540) % 360 - 180;
}

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

function render() {
  background(started ? 255 : 0);
  fill(started ? 0 : 255);
  textAlign(CENTER, CENTER);
  textSize(width / 15);

  if (!started) {
    text('Tap to start', width / 2, height / 2);
    return;
  }

  text(latestScene ? mode.status() : 'Waiting for the controller', width / 2, height / 2);

  textSize(width / 25);
  if (phoneHeadingDegrees !== null) {
    text('Turned ' + Math.round(turnDegrees()) + '°\nFace the front and tap to set forward', width / 2, height / 2 + width / 6);
    if (tiltedTooFar) text('Hold the phone flatter, screen up', width / 2, height / 2 + width / 3);
  }
  text(warnings.join('\n'), width / 2, height * 0.8);
}

// p5 looks for these on window, and a module does not put them there
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.mouseClicked = mouseClicked;
window.windowResized = windowResized;
