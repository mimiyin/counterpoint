// Sound source: https://freesound.org/people/ERH/sounds/43312/

let target = {};
let movers = {};

// DIATONIC SCALE: MAJOR
const RATIOS = [1, 1.125, 1.25, 1.34, 1.5, 1.67, 1.875, 2];
const BASE = 220;

// Activate audio context
let started = false;
let ping;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  target.x = width/2;
  target.y = 0;
  if (!pozyx_on) init_movers(1);
  //pozyx();
  ping = await loadSound('ping.m4a');
}

// Create oscillator
function createOsc() {
  let osc = new p5.Oscillator();
  osc.setType('sine');
  osc.freq(BASE);
  osc.amp(0);
  osc.start();
  return osc;
}

// Create mover with soundfile and oscillator
function createMover(id, pos) {
  let osc = createOsc();
  let mover = new Mover(id, pos.x, pos.y, osc);
  load(mover);
  return mover;
}

// Load sound file asynchronously
async function load(mover) {
  let sample = await loadSound('ping.m4a');
  mover.load(sample);
}

function draw() {
  background(0);

  // Populate movers with tag data
  for (let id in tags) {
    let pos = tags[id];
    if (id in movers) movers[id].update(pos.x, pos.y);
    else movers[id] = createMover(id, pos);
  }

  for (let m in movers) {
    let mover = movers[m];
    //mover.play(target);
    mover.amp(target);
    //mover.sing(target);
    mover.display();
  }

  // Control target with mouse
  target.x = mouseX;
  target.y = mouseY;

  // Display target
  fill('red');
  ellipse(target.x, target.y, 50, 50);
}

function keyPressed() {

  // Activate audio context
  if(!started) {
    ping.play();
    started = true;
  }

  // Manually move movers
  switch (key) {
    case LEFT_ARROW:
      tags['tracker-1'].x -= 10;
      break;
    case RIGHT_ARROW:
      tags['tracker-1'].x += 10;
      break;
    case DOWN_ARROW:
      tags['tracker-1'].y += 10;
      break;
    case UP_ARROW:
      tags['tracker-1'].y -= 10;
      break;

    case 'a':
      let _a = wrap(movers['tracker-1'].a - 0.1);
      movers['tracker-1'].a = _a;
      break;
    case 'd':
      let a_ = wrap(movers['tracker-1'].a + 0.1);
      movers['tracker-1'].a = a_;
      break;
  }
}

function wrap(a) {
  let d2PI = abs(abs(a)-PI);
  if(a > PI) a = -PI + d2PI;
  else if(a < -PI) a = PI - d2PI;
  return a;
}