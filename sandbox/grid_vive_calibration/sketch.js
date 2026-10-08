import { TrackerStore, connectFake, fakeRoomTracker, identityTransformer, createRoomTransformer } from '../tracker/index.js';

const COLS = 7;
const ROWS = 10;
const DIAM = 100;
let w, h;

const SAMPLES = 60;
const CAPTURE_MS = 1500; 

const STEPS = {
  origin: {
    prompt: 'Place the tracker on the top left corner, then press ENTER',
    target: () => ({ x: 0, y: 0 }),
    next: 'xPoint',
  },
  xPoint: {
    prompt: 'Place the tracker on the top right corner, then press ENTER',
    target: () => ({ x: windowWidth, y: 0 }),
    next: 'zPoint',
  },
  zPoint: {
    prompt: 'Place the tracker on the bottom left corner, then press ENTER',
    target: () => ({ x: 0, y: windowHeight }),
    next: 'check',
  },
  check: {
    prompt: 'Place the tracker on the bottom right corner, then press ENTER',
    target: () => ({ x: windowWidth, y: windowHeight }),
    next: 'free',
  },
  free: {
    prompt: null,
    target: null,
    next: null,
  },
};


const state = {
  step: 'origin',
  phase: 'waiting', // waiting， collecting， failed， done
  startedAt: 0,     // millis() when ENTER was pressed
  captures: {},     // averaged raw reading per step: origin, xPoint, zPoint
  message: '',
};

const store = new TrackerStore(identityTransformer);

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;

  connectFake(store, fakeRoomTracker(fakeTrackerPos));
}

// Generate a fake tracker position based on the current step
function fakeTrackerPos() {
  const step = STEPS[state.step];
  if (step.target) return step.target();

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
  if (state.phase != 'collecting') {
    return;
  }

  if (millis() - state.startedAt >= CAPTURE_MS) {
    finishCapture();
  }
}

function finishCapture() {
  const tracker = getTracker();
  const pos = tracker && !tracker.isStale() ? tracker.getPosByAvg(SAMPLES, true, true) : null;

  if (!pos) {
    state.phase = 'failed';
    state.message = 'No tracker data.';
    return;
  }

  // TODO: Validate the capture
  // maybe check deviation and range?

  console.log(state.step, { ...pos, samples: SAMPLES });
  state.captures[state.step] = { x: pos.x, y: pos.y, z: pos.z };

  if (state.step == 'zPoint') {
    const { origin, xPoint, zPoint } = state.captures;
    store.setTransformer(createRoomTransformer(origin, xPoint, zPoint, width, height));
  }

  const next = STEPS[state.step].next;
  if (next) {
    goTo(next);
  }

  if (state.step == 'free') {
    const { origin, xPoint, zPoint } = state.captures;
    console.log('Calibration config', {
      origin: roundPos(origin),
      xPoint: roundPos(xPoint),
      zPoint: roundPos(zPoint),
      xDistance: width,
      zDistance: height,
    });
  }
}

function roundPos(pos) {
  return { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) };
}

function getTracker() {
  return store.getTrackers()['fake1'];
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

  const step = STEPS[state.step];
  if (step.target) {
    display_target(step.target());
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
  if (!tracker || !tracker.current || tracker.isStale()) return;

  push();
  fill('red');
  noStroke();

  const pos = tracker.getPosByAvg(15, false, false);
  if (pos) {
    const cell = getCell(pos.x, pos.z);
    fill('red');
    rect(cell.x, cell.y, w, h);
    stroke(255);
    noFill();
    ellipse(pos.x, pos.z, DIAM);
  }
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
      return STEPS[state.step].prompt;
    case 'collecting':
      return 'Capturing ' + captureProgress() + '%\nKeep the tracker still';
    case 'failed':
      return state.message + '\nPress ENTER to try again';
    case 'done':
      return state.message;
  }
}

function captureProgress() {
  return Math.min(100, Math.round((millis() - state.startedAt) / CAPTURE_MS * 100));
}

// Where the tracker should be placed. The colour follows the phase.
function display_target(target) {
  const colors = { waiting: 'grey', collecting: 'orange', failed: 'red', done: 'green' };

  const c = color(colors[state.phase]);
  c.setAlpha(128);

  push();
  fill(c);
  noStroke();
  circle(target.x, target.y, DIAM / 2);
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
  if (!STEPS[state.step].target) return;

  if (keyCode == ENTER && (state.phase == 'waiting' || state.phase == 'failed')) {
    state.startedAt = millis();
    state.phase = 'collecting';
  }
}

// p5 looks for these on window, and a module does not put them there
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
