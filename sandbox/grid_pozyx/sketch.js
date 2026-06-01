let movers = {}

const COLS = 7;
const ROWS = 10;
const DIAM = 100;
let w, h;
let m_idx = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;
  pozyx();
  init_movers(10);
}

function draw() {

  // Look for new tag data
  let m = 0;
  for(let id in tags) {
    movers[m] = tags[id];
    m++;
  }

  console.log('M', m);

  background(255);
  noStroke();

  for (let c = 0; c < COLS; c++) {
    let x = c * w;
    for (let r = 0; r < ROWS; r++) {
      let y = r * h;
      fill((c + r) % 2 == 0 ? 255 : 0);
      rect(x, y, w, h);
    }
  }

  for (let m in movers) {
    let mover = movers[m];
    let x = mover.x;
    let y = mover.y;
    let cell = getCell(x, y);
    fill('red');
    rect(cell.x, cell.y, w, h);
    stroke(255);
    noFill();
    ellipse(x, y, DIAM);
    viz_accs(mover.accs, x, y);
  }
  
}

function viz_accs(accs, x, y) {
  const LEN = accs.length * 2;
  push();
  translate(x, y);
  for(let ac = 0; ac < accs.length; ac++) {
    let acc = accs[ac];
    for(let a = 0; a < XY; a++) {
      let xy = acc[a];
      let r = map(abs(xy), 0, 200, 0, DIAM);
      // + or - accel?
      fill(xy > 0 ? 'green' : 'blue');
      ellipse(0, 0, r);
    }
  }
  pop();
}

function getCell(x, y) {
  let cx = floor(x / w) * w;
  let cy = floor(y / h) * h;
  return { x: cx, y: cy }
}

function keyPressed() {

  if (!isNaN(key)) {
    m_idx = key;
    return;
  }
  switch (keyCode) {
    case ENTER:
      start();
      break;
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