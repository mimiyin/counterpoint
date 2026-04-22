let movers = {};
let pairs = {};
let notes = [];

const RATIOS = [1, 1.125, 1.25, 1.25, 1.25, 1.34, 1.34, 1.5, 1.5, 1.5, 1.5, 1.5, 1.67, 1.67, 1.875, 2, 2, 2];
const BASE = 300;

let diag;


function setup() {
  createCanvas(windowWidth, windowHeight);
  diag = sqrt(sq(width) + sq(height));

  // Set up pozyx
  pozyx();

  // Fake movers
  if (!pozyx_on) init_movers(4);

  // Pair
  pair();
}

function pick(arr) {
  let r = floor(random(arr.length));
  return arr.splice(r, 1);
}

function pair() {
  let ms = [];
  for (let m in movers) {
    ms.push(m);
  }


  let num = ms.length;
  for (let n = 0; n < floor(num/2); n++) {
    let A = pick(ms);
    console.log('after A', ms)
    let B = pick(ms);
    console.log('after B', ms)
    pairs[A + '-' + B] = new Pair(movers[A], movers[B]);
  }
}

function draw() {
  background(0);
  noStroke();

  // Iterate through the pairs
  for(let p in pairs) {
    let pair = pairs[p];
    pair.run();
  }

  // Display movers
  for (let m in movers) {
    let mover = movers[m];
    mover.move();
    mover.display();
  }
}

