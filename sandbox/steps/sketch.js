const NUM_STEPS = 10;
let STEP_W;
let paces = {
  'vs': 60 * 5,
  's': 24 * 5,
  'm': 12 * 5,
  'f': 6 * 5,
}

// Populate with every combination and permutation
// let choreo = {
//   'A': [1, 1, 1, 0, 0, 0],
//   'B': [0, 0, 0, 1, 1, 1]
// }

let A, B;
let sounds = {};

let go = false;

// Generating all the possibilities
let choreos = [];
let results = [];
const LIMIT = 6;
generate([], 0);

// All possible pairings of all possible choreographies
for(let i = 0; i < results.length; i++) {
  let resultA = results[i];
  let choreosI = [];
  for(let j = 0; j < results.length; j++) {
    let resultB = results[j];
    let choreo = {'A' : resultA, 'B' : resultB }
    choreosI.push(choreo);
  }
  choreos.push(choreosI);
}
// Recursively populate all possible choreographies
function generate(arr, idx) {
  if (idx == LIMIT) {
    results.push(arr);
    return;
  }
  let arr0 = arr.slice(0);
  arr0[idx] = 0;
  generate(arr0, idx + 1);
  let arr1 = arr.slice(0);
  arr1[idx] = 1;
  generate(arr1, idx + 1);
}

function preload() {
  sounds.a = loadSound('a.mp3');
  sounds.b = loadSound('a.mp3');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  STEP_W = width / NUM_STEPS;
  reset();
}

function reset() {
  let choreo = random(random(choreos));
  console.log(choreo);
  A = new Mover('A', height / 3, paces.m, sounds.a, choreo.A);
  B = new Mover('B', 2 * height / 3, paces.m, sounds.b, choreo.B);
}

function draw() {
  background(0);
  if (go) {
    A.run();
    B.run();
  }
}

class Mover {
  constructor(name, y, pace, sound, choreo) {
    this.name = name;
    this.y = y;
    this.pace = pace;
    this.sound = sound;
    this.choreo = choreo;

    this.go = true;
    this.c = 0;
    this.s = 0;
    this.w = STEP_W / 4;
    this.h = height / 10;
  }

  run() {

    if (this.go && frameCount % this.pace == 0) {
      this.step();
    }
    this.display();
  }

  step() {
    console.log(this.name, this.choreo[this.c] == 1 ? 'STEPS!' : 'waits.');

    this.s += this.choreo[this.c];
    this.sound.play();

    this.c++;
    if (this.c >= this.choreo.length) this.go = false;
  }

  display() {
    fill(255);
    rect(this.s * STEP_W, this.y, this.w, this.h)
  }
}

function keyPressed() {
  if (keyCode == '32') go = !go;
  console.log("GO", go);

  reset();
}
