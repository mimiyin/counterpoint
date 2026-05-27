let movers = {}

const COLS = 7;
const ROWS = 10;
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
    push();
    fill('green');
    ellipse(x, y, 50, 50);
    pop();
    calc_accel(mover.a);
  }
  
}

function calc_accel(accels) {
  let x = 0;
  let w = width/accels.length;
  for(let a = 1; a < accels.length; a++) {
    let a0 = accels[a-1];
    let a1 = accels[a];
    let d = dist(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2]);
    fill(0, 255, 0, 100);
    rect(x, 0, w, d*10);
    x+=w;
  }
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