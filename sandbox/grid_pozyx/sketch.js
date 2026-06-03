let movers = {};

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
  if (!pozyx_on) init_movers(10);
}

function draw() {

  // Look for new tag data
  let m = 0;
  for (let id in tags) {
    movers[m] = tags[id];
    m++;
  }

  //console.log('M',m);

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
    if (mover.acc) {
      let acc = mover.acc;
      draw_msg(acc.msg, x, y);
      translate(0, height / 2);
      draw_avg(acc.cum_accs);
      draw_dev(av, acc.cum_accs);
      draw_cum(acc.cum_accs);
    }
  }
}

function draw_avg(avg) {
  let w = width / XYZ;
  for (let a in avg) {
    let h = avg[a] / 2;
    rect(a * w, 0, w / 2, h);
  }
}

function draw_dev(dev) {
  let w = width / XYZ;
  for (let d in dev) {
    let h = dev[d] / 2;
    noStroke();
    fill('orange');
    rect(d * w + w / 2, 0, w / 2, h);
  }
}

function draw_hist(cum) {
  let len = all.length * XYZ;
  let acc_w = width / len;
  let acc_y = height / 2;
  for (let a in cum) {
    let acc = cum[a];
    for (let xyz in acc) {
      let acc_h = xyz[xy];
      let acc_x = ((a * XYZ) + int(xyz)) * acc_w;
      stroke(0, 255, 0, 128);
      strokeWeight(acc_w / 2);
      line(acc_x, 0, acc_x, acc_h);
    }
  }

}

function display_msg(msg, x, y) {
  const LEN = accs.length * XYZ;
  push();
  translate(x, y);
  fill('green');
  ellipse(0, 0, calc_acc(accs) / 2);
  textSize(64);
  textAlign(CENTER);
  fill('blue');
  stroke('white');
  text(msg, 0, -1000);
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
