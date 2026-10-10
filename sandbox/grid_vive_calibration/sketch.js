import { TrackerStore, connectSocket, connectFake, fakeRoomTracker, identityTransformer, createRoomTransformer } from '../tracker/index.js';

const COLS = 7;
const ROWS = 10;
const DIAM = 100;
let w, h; // cell dimensions
let steps; // calibration steps

const SAMPLES = 60;
const CAPTURE_MS = 1500;

// How far the fourth corner may land from its target on each axis and still pass, as a fraction of a cell
const CHECK_TOLERANCE = 0.1;

const state = {
  step: 'origin',
  phase: 'waiting', // waiting, collecting, failed
  startedAt: 0,     // millis() when ENTER was pressed
  captures: {},     // averaged raw reading per step: origin, xPoint, zPoint
  message: '',
  config: null,     // everything the room transformer is built from, set once zPoint is captured
};

const generateSteps = (w_offset = 0, h_offset = 0) => {
  return {
    origin: {
      prompt: 'Place the tracker on the top left corner, then press ENTER',
      target: { x: w_offset, y: h_offset },
      next: 'xPoint',
    },
    xPoint: {
      prompt: 'Place the tracker on the top right corner, then press ENTER',
      target: { x: width - w_offset, y: h_offset },
      next: 'zPoint',
    },
    zPoint: {
      prompt: 'Place the tracker on the bottom left corner, then press ENTER',
      target: { x: w_offset, y: height - h_offset },
      next: 'check',
      onCaptured: applyCalibration,
    },
    check: {
      prompt: 'Place the tracker on the bottom right corner, then press ENTER',
      target: { x: width - w_offset, y: height - h_offset },
      next: 'free',
      onCaptured: checkCalibration,
    },
    free: {
      prompt: null,
      target: null,
      next: null,
    },
  };
};

const store = new TrackerStore(identityTransformer);

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;
  steps = generateSteps(w, h);

  connectFake(store, fakeRoomTracker(fakeTrackerPos));
  // connectSocket(store);
}

// Generate a fake tracker position based on the current step
function fakeTrackerPos() {
  if (isCalibrating()) return steps[state.step].target;

  const t = millis() / 1000;
  return {
    x: width / 2 + Math.cos(t * 0.7) * width * 0.4,
    y: height / 2 + Math.sin(t * 1.1) * height * 0.4,
  };
}

function draw() {
  update();
  render();
}

function update() {
  if (state.phase == 'collecting' && millis() - state.startedAt >= CAPTURE_MS) {
    finishCapture();
  }
}

function finishCapture() {
  const tracker = getTracker();
  const pos = tracker ? tracker.getPosByAvg(SAMPLES, true, true) : null;

  if (!pos) {
    fail('No tracker data.');
    return;
  }

  console.log(state.step, { ...pos, samples: SAMPLES });
  state.captures[state.step] = { x: pos.x, y: pos.y, z: pos.z };

  const step = steps[state.step];
  const problem = step.onCaptured ? step.onCaptured(pos) : null;
  if (problem) {
    fail(problem);
    return;
  }

  if (step.next) {
    goTo(step.next);
  }
}

// All three points are captured: positions from the store become canvas pixels from here on
function applyCalibration() {
  const c = buildConfig();

  // createRoomTransformer throws if the three points cannot define a room, e.g. when they are on one line
  try {
    store.setTransformer(
      createRoomTransformer(c.origin, c.xPoint, c.zPoint, c.xDistance, c.zDistance, c.xOffset, c.zOffset)
    );
  } catch (error) {
    console.error(error);
    return error.message;
  }

  state.config = c;
  return null;
}

// Compares where the calibration puts the fourth corner with where its target is.
function checkCalibration(pos) {
  const target = steps.check.target;
  const landed = store.transform(pos);
  if (!landed) return 'The calibration could not place the fourth corner.';

  // How far off the fourth corner landed on each axis, in canvas pixels
  const dx = landed.x - target.x;
  const dz = landed.z - target.y;
  const limitX = w * CHECK_TOLERANCE;
  const limitZ = h * CHECK_TOLERANCE;
  const ok = Math.abs(dx) <= limitX && Math.abs(dz) <= limitZ;

  console.log('Calibration check', {
    target: target,
    landed: { x: landed.x, z: landed.z },
    error: { x: dx, z: dz },
    limit: { x: limitX, z: limitZ },
    ok: ok,
  });

  if (!ok) {
    return 'Calibration check failed: off by x ' + dx.toFixed(1) + ' px, z ' + dz.toFixed(1) + ' px'
      + ' (limit ' + limitX.toFixed(1) + ', ' + limitZ.toFixed(1) + ')';
  }

  console.log('Calibration config', state.config);
  return null;
}

function buildConfig() {
  const origin = steps.origin.target;
  const xPoint = steps.xPoint.target;
  const zPoint = steps.zPoint.target;

  return {
    origin: state.captures.origin,
    xPoint: state.captures.xPoint,
    zPoint: state.captures.zPoint,
    xDistance: xPoint.x - origin.x,
    zDistance: zPoint.y - origin.y,
    xOffset: origin.x,
    zOffset: origin.y,
  };
}

function getTracker() {
  const tracker = Object.values(store.getTrackers())[0];
  return tracker && !tracker.isStale() ? tracker : null;
}

function isCalibrating() {
  return steps[state.step].target != null;
}

function fail(message) {
  state.phase = 'failed';
  state.message = message;
}

function goTo(step) {
  console.log('Calibration step: ' + state.step + ' -> ' + step);
  state.step = step;
  state.phase = 'waiting';
  state.message = '';
}

function render() {
  background(255);

  display_grid();

  if (isCalibrating()) {
    const target = steps[state.step].target;

    if (state.step == 'check') {
      display_circle(target, 'green');
      display_current();
    } else {
      display_target(target);
    }
    display_prompt(promptText());
  } else {
    display_tracker();
  }
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

  const pos = tracker.getPosByAvg(15);
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

function promptText() {
  switch (state.phase) {
    case 'waiting':
      return steps[state.step].prompt;
    case 'collecting':
      return 'Capturing ' + captureProgress() + '%\nKeep the tracker still';
    case 'failed':
      return state.message + '\nPress ENTER to try again';
  }
}

function captureProgress() {
  return Math.min(100, Math.round((millis() - state.startedAt) / CAPTURE_MS * 100));
}

function display_target(target) {
  const colors = { waiting: 'grey', collecting: 'orange', failed: 'red' };

  display_circle(target, colors[state.phase]);
}

function display_current() {
  const tracker = getTracker();
  if (!tracker || !tracker.current) return;

  display_circle({ x: tracker.current.x, y: tracker.current.z }, 'red');
}

function display_circle(pos, name) {
  const c = color(name);
  c.setAlpha(128);

  push();
  fill(c);
  noStroke();
  circle(pos.x, pos.y, DIAM / 2);
  pop();
}

function display_prompt(msg) {
  const size = width / 40;

  push();
  rectMode(CENTER);
  noStroke();
  fill(0, 0, 255, 220);
  rect(width / 2, height / 2, width * 0.8, size * 5);
  fill(255);
  textSize(size);
  textAlign(CENTER, CENTER);
  text(msg, width / 2, height / 2);
  pop();
}

function keyPressed() {
  if (!isCalibrating()) return;

  if (keyCode == ENTER && (state.phase == 'waiting' || state.phase == 'failed')) {
    state.startedAt = millis();
    state.phase = 'collecting';
  }
}

// p5 looks for these on window, and a module does not put them there
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
