let movers = {}
let cells = [];

const COLS = 10;
const ROWS = 12;
let w, h;

let chains = {};
let word = 'hello';

function process(lines) {
  lines.forEach((line) => {
    let words = line.split(' ');
    let first = words[0];
    let second = words[1];
    if (!(first in chains)) chains[first] = [];
    chains[first].push(second)
  });

  console.log(chains);
}
function preload() {
  loadStrings('text.txt', process);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;

  // Set up pozyx
  pozyx();

  for (let r = 0; r < ROWS; r++) {
    cells[r] = [];
    for (let c = 0; c < COLS; c++) {
      cells[r][c] = new Cell(c * w, r * h);
    }
  }

  // Create fake data
  if (!pozyx_on) init_movers();
}

function draw() {
  background(0);
  noStroke();

  // Draw cells
  // Reset them all to empty
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let cell = cells[r][c];
      cell.display();
    }
  }

  // Check movers
  // Occupy cells
  // Count + speak
  // Draw movers
  for (let m in movers) {
    let mover = movers[m];
    mover.move();
    mover.count(0);
    let cell = locate(mover.x, mover.y);
    cell.occupy();
    if (mover.still()) {
      cell.speak(word);
      let n = floor(random(chains[word].length)) || 0;
      word = chains[word][n];
      console.log("next word", word);
      mover.silence();
    }
    mover.display();
  }

  // Recheck cells
  // Cue up cells that are empty
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let cell = cells[r][c];
      // if cell is empty
      //if(cell.isEmpty) cell.cue(true);
    }
  }

}

function locate(x, y) {
  let r = floor(y / h);
  let c = floor(x / w);
  return cells[r][c];
}
