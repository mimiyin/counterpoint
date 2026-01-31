let a = 0;
let aspeed = 1;
let adir = 1;
let follow = true;
let approaching = false;
let _approaching = false;
let _d = 0;

let dirs = [];
let avg_dir = 0;

let d = 0;
let ds = [];
let avg_d = 0;

let stopped = true;
let _stopped = false;
let _started = false;
let _turned = false;
let _changed = false;

let manual = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  cx = width / 2;
  cy = height / 2;
  sz = width / 5;
  frameRate(30);
  background(0);

  rectMode(CENTER);
}

function draw() {
  background(0);
  a += aspeed * adir;
  a = constrain(a, 0, 255);
  if (a <= 0 || a >= 255) adir *= -1;

  fill(255, a);
  noStroke();
  rect(cx, cy, sz);

  noFill();
  stroke(255);
  rect(cx, cy, sz * 2);
  rect(cx, cy, sz * 4);

  let d = dist(mouseX, mouseY, pmouseX, pmouseY);
  // Update
  ds.push(d);
  if (ds.length > 10) ds.shift();

  // New now average
  let d_sum = 0;
  for (let d of ds) d_sum += d;
  avg_d = d_sum / ds.length;

  stopped = avg_d == 0;

  if (stopped) {
    if (_stopped) {
      _stopped_ = false;
    } else {
      _stopped = true;
      _stopped_ = true;
    }
  } else if (_stopped) {
    _started = true;
    _stopped = false;
  } else {
    _started = false;
  }

  if (approaching != _approaching) {
    _turned = true;
    _approaching = approaching;
  } else {
    _turned = false;
  }

  _changed = _stopped_ || _started || _turned;

  //console.log('stopped?', stopped, '_started?', _started, '_stopped?', _stopped);

  if(_changed) console.log("changed", _changed, frameCount);

  if (_changed) {
    // Go into manual mode, 20% of the time
    manual = random(1) > 0.9; // Need to debounce _changed
    //console.log("manual", manual);
    if (manual) {
      t += 0.01;
      let th = map(noise(t), 0, 1, 0.8, 0.95);
      //if (random(1) > 0.5) {
      aspeed = 60;
      //console.log("interrupt", aspeed);
      //}
    }
    fill('red');
    noStroke();
    rect(mouseX, mouseY, 20, 20);
  }
  
}

let t = 0;
function mouseMoved() {
  if (stopped || manual) return;

  let d = dist(mouseX, mouseY, cx, cy);
  let dir = _d - d;

  dirs.push(dir);
  if (dirs.length > 30) dirs.shift();
  let sum = 0;
  for (let dir of dirs) sum += dir;
  avg_dir = sum / dirs.length;

  approaching = avg_dir >= 0;

  aspeed = 500 / (d - sz / 2);
  //console.log('move', aspeed);

  _d = d;
}
