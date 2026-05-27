let movers = {};
let pairs = {};
let moversToPair = [];
let notes = [];

const RATIOS = [1, 1.125, 1.25, 1.25, 1.25, 1.34, 1.34, 1.5, 1.5, 1.5, 1.5, 1.5, 1.67, 1.67, 1.875, 2, 2, 2];
const BASE = 300;
const NUM_MOVERS = 2;

let diag;
let bass;
let bass_int;
let d = 1;

// Range of tempo
const TEMPO_MIN = 250;
const TEMPO_MAX = 2000;

function setup() {
  createCanvas(windowWidth, windowHeight);
  diag = sqrt(sq(width) + sq(height));

  // Set up pozyx
  pozyx();

  // Set up bass mover
  bass = loadSound('drums/0.mp3');
  bass_int = setInterval(() => {
    bass.play();
  }, 3000);

  // Fake movers
  if (!pozyx_on) init_movers(NUM_MOVERS);

}

function pick(arr) {
  let r = floor(random(arr.length));
  return arr.splice(r, 1);
}

function pair() {

  // Enough to pair?
  let count = moversToPair.length;
  if(count < 2) return;

  // Pair everyone
  for (let m = 0; m < count-1; m+=2) {
    let A = moversToPair[m];
    let B = moversToPair[m+1];
    let C;
    if(A && B) {
      let sound = loadSound('drums/' + d + '.mp3', ()=>{
        pairs[A.id + '-' + B.id] = new Pair(A, B, sound);
      });
      d++;
      if(d > 4) d = 1;
    }
    // If there is a trio left
    if(count - m == 3) {
      C = moversToPair[m+2];
      pairs[A.id + '-' + C.id] = new Pair(A, C);
    }

    // Remove paired movers
    moversToPair.splice(m, C ? 3 : 2);
  }
}

function draw() {
  background(0);
  noStroke();

  // Look for new tag data
  for(let id in tags) {
    let pos = tags[id];
    if(id in movers) movers[id].update(pos.x, pos.y)
    else {
      movers[id] = new Mover(id, pos.x, pos.y);
      moversToPair.push(movers[id]);
      pair();
    }
  }

  // Iterate through the pairs
  for(let p in pairs) {
    let pair = pairs[p];
    pair.run();
  }

  // Display movers
  for (let m in movers) {
    let mover = movers[m];
    mover.run();
  }
}

function keyPressed() {
  init_movers(1);
}
