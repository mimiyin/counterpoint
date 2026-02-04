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

let go = true;

// Generating all the possibilities
let choreos = [];
let results = [];
const LIMIT = 3;
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

console.log(choreos);

function preload() {
  sounds.a = loadSound('a.wav');
  sounds.b = loadSound('b.wav');
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

function replay(){
  A.reset();
  B.reset();
}

function draw() {
  background(0);
  if (go) {
    A.run();
    B.run();
  }

  fill('white');
  textSize(24);
  text("Press [spacebar] to replay current pattern. [ENTER] to randomly select new pattern.", 100, 100);
}

class Mover {
  constructor(name, y, pace, sound, choreo) {
    this.name = name;
    this.y = y;
    this.pace = pace;
    this.sound = sound;
    this.choreo = choreo;

    this.w = STEP_W / 4;
    this.h = height / 10;

    this.reset();
  }

  reset() {
    this.go = true;
    this.c = 0;
    this.s = 0;
  }

  run() {

    if (this.go && frameCount % this.pace == 0) {
      let next = this.choreo[this.c];
      if(next) this.step();

      console.log(this.name, this.choreo[this.c] == 1 ? 'STEPS!' : 'waits.');
      this.c++;

      // Stop when we're done
      if (this.c >= this.choreo.length) this.go = false;
    }
    this.display();
  }

  step() {
    this.s++;
    this.sound.play();
  }

  display() {
    fill(255);
    rect(this.s * STEP_W, this.y, this.w, this.h)
  }
}

function keyPressed() {
  if (keyCode == '32') replay();
  else if(keyCode == RETURN) reset();
}
