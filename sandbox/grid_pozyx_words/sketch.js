let movers = {}
let cells = [];

const COLS = 10;
const ROWS = 12;
let w, h;
let m_idx = 0;

let corpus = {
  subjs: ['i', 'you'],
  verbs_mod: ['will', 'wont'],
  verbs: ['think', 'do', 'see', 'smell'],
  objs: ['you', 'us', 'them', 'this', 'that', 'all', 'never', 'need']
}

let sounds = {}

function preload() {
  for (let cat in corpus) {
    let words = corpus[cat];
    for (let word of words) {
      if (!(cat in sounds)) sounds[cat] = [];
      sounds[cat].push(loadSound('words/' + word + '.wav'));
    }
  }
}
function setup() {
  console.log(sounds);
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;

  // Set up pozyx
  pozyx();

  for (let r = 0; r < ROWS; r++) {
    cells[r] = [];
    for (let c = 0; c < COLS; c++) {
      let sound;
      if (r < 3) sound = random(sounds.subjs)
      else if (r < 6) sound = random(sounds.verbs_mod);
      else if (r < 9) sound = random(sounds.verbs);
      else sound = random(sounds.objs)
      cells[r][c] = new Cell(c * w, r * h, sound);
    }
  }

  console.log(cells);

  if (!pozyx_on) init_movers();
}

function draw() {
  background(0);
  noStroke();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let cell = cells[r][c];
      //console.log(cell);
      cell.display();
    }
  }

  for (let m in movers) {
    let mover = movers[m];
    mover.move();
    mover.count(0);
    let cell = locate(mover.x, mover.y);
    if (mover.speak()) {
      cell.play();
      cell.flash();
      mover.silence();
    }
    mover.display();
  }

}

function locate(x, y) {
  let r = floor(y / h);
  let c = floor(x / w);
  return cells[r][c];
}

function keyPressed() {

  if (!isNaN(key)) {
    m_idx = key;
    return;
  }
  switch (keyCode) {
    case LEFT_ARROW:
      movers[m_idx].x -= w;
      break;
    case RIGHT_ARROW:
      movers[m_idx].x += w;
      break;
    case DOWN_ARROW:
      movers[m_idx].y += h;
      break;
    case UP_ARROW:
      movers[m_idx].y -= h;
      break;
  }
}
