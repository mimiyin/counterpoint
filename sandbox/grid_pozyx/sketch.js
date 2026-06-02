let movers = {}
let all_accs = [];

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
    viz_accs(mover.msg, mover.accs, x, y);
    if (mover.accs) {
      all_accs.push(...mover.accs);
      let diff = all_accs.length-50;
      if (diff > 0) all_accs.splice(0, diff);
    }
    translate(0, height/2);
    let av = avg(all_accs);
    dev(av, all_accs);
    hist(all_accs);

  }
  
  

}

function dev(avg, all) {
   let w =  width/XYZ;
  let dev = [0, 0, 0];
  for(let acc of all) {
    for(let a in acc) {
      dev[a] += abs(acc[a] - avg[a]);
    }
  }
  for(let d in dev) {
    noStroke();
    fill('orange');
    rect(d * w + w/2, 0, w/2, dev[d]/2);
  }
}

function avg(all) {
  let w =  width/XYZ;
  let avg = [0, 0, 0];
  for(let acc of all) {
    for(let a in acc) {
      avg[a] += acc[a];
    }
  }
  for(let a in avg) {
    avg[a] /= all.length;
    noStroke();
    fill('purple');
    rect(a * w, 0, w/2, avg[a]);
  }
  return avg;
}

function hist(all) {
  let len = all.length * XYZ;
  let acc_w = width / len;
  let acc_y = height / 2;

  
  for (let acc in all) {
    let xyz = all_accs[acc];
    for (let xy in xyz) {
      let acc_h = xyz[xy];
      let acc_x = ((acc * XYZ) + int(xy)) * acc_w;
      stroke(0, 255, 0, 128);
      strokeWeight(acc_w/2);
      line(acc_x, 0, acc_x, acc_h);
    }
  }

}

function viz_accs(msg, accs, x, y) {

 
  const LEN = accs.length * XYZ;
  push();
  translate(x, y);
  fill('green');
  ellipse(0, 0, calc_acc(accs) / 2);
  textSize(64);
  textAlign(CENTER);
  fill('blue');
  stroke('white');
  // let d2a = round(d, 0, 2) + ': ' + round(sum, 0, 2);
  // if(d > 0 && sum < 500) d2a = "HA!";
  text(msg, 0, -1000);
  // for(let ac = 0; ac < accs.length; ac++) {
  //   let acc = accs[ac];
  //   for(let a = 0; a < XYZ; a++) {
  //     let xy = acc[a];
  //     let r = map(abs(xy), 0, 200, 0, DIAM);
  //     // + or - accel?
  //     fill(xy > 0 ? 'green' : 'blue');
  //     ellipse(0, 0, r);
  //   }
  // }
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
