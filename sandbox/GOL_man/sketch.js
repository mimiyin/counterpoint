// KEYS
// a auto mode
// d debug
// m move

// Press 'f' to turn flash on/off
// FLASH SETTINGS
const FPS = 60;
const FLASH_INTERVAL = FPS * 10; // Will flash every 10s
const FLASH_HOLD = FPS * 0.5; // For 1/2 a second
const FLASH_BG = 128;

// Press 'f' to turn flash on/off
let flash = false;

////////////////////////
const COLS = 5;
const ROWS = 7;
const COL_W = window.innerWidth / COLS;
const ROW_H = window.innerHeight / ROWS;
let cells = [];

// Auto mode
const MAX_ON = 3;
const AUTO_INT_DUR = 1000 * 10;
let auto_on_th = 0.999;
let auto_off_th = 0.9;

let auto = false;
let auto_int;

// Movers
const NUM_MOVERS = 10;
let move = false;
let movers = [];
let debug = false;

// Staging
let stage = false;
let shush = false;
let center;
let bell;
let shhh;

function preload() {
  bell = loadSound('bell.wav');
  shhh = loadSound('noise.wav');
}

function setup() {
  noStroke();
  createCanvas(windowWidth, windowHeight);
  background(0);
  init_board();
  init_movers();
}

function draw() {
  background(0);

  for (let cell of cells) {
    cell.run();
  }

  if (move) {
    for (let mover of movers) mover.run();
  }

  if (flash) {
    let f = frameCount % FLASH_INTERVAL;
    if (f > 0 && f < FLASH_HOLD) background(FLASH_BG);
  }

  // Play noise
  if(stage) {
    if(frameCount % 120 == 1) {
      shush = !shush;      
      if(shush) shhh.play();      
    }
  }
  //if(!shush) shhh.stop();

}

function mousePressed() {
  for (let cell of cells) {
    cell.toggle(false);
  }
}

class Cell {
  constructor(c, r) {
    this.c = c;
    this.r = r;
    this.x = c * COL_W;
    this.y = r * ROW_H;
    this.a = 0;
    this.aspeed = 1;
    this.on = false;
  }
  hover() {
    return mouseX > this.x && mouseX < this.x + COL_W && mouseY > this.y && mouseY < this.y + ROW_H
  }
  run() {
    this.fade();
    this.display();
  }

  toggle(force) {
    if (force || this.hover()) {
      this.on = !this.on;
      if(this.on) bell.play();
      this.a = constrain(this.a, 0, 255);
    }
  }

  fade() {
    if (this.on) this.a += this.aspeed;
    else this.a -= this.aspeed;
  }

  display() {
    noStroke();
    fill(255, this.a);
    rect(this.x, this.y, COL_W, ROW_H);
  }
}

class Mover {
  constructor(x, y, xspeed, yspeed) {
    this.x = x;
    this.y = y;
    this.xspeed = xspeed;
    this.yspeed = yspeed;
  }

  run() {
    this.update();
    this.display();
  }

  update() {
    this.x += this.xspeed;
    this.y += this.yspeed;
    if (this.x < 0 || this.x > width) this.xspeed *= -1;
    if (this.y < 0 || this.y > height) this.yspeed *= -1;
  }

  display() {
    strokeWeight(3);
    stroke(debug ? 'red' : 'black');
    point(this.x, this.y);
  }
}

// Make movers
function init_movers() {
  for (let m = 0; m < NUM_MOVERS; m++) {
    let x = random(1) > 0.5 ? 0 : width;
    let y = random(height);
    let xspeed = random(-0.1, 0.1);
    let yspeed = random(-0.1, 0.1);
    movers[m] = new Mover(x, y, xspeed, yspeed);
  }
}

// Fill board randomly
function init_board() {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      cells.push(new Cell(c, r));
    }
  }

  // Assign center cell
  let c = (floor(COLS/2) * ROWS) + floor(ROWS/2);
  center = cells[c];
}

function keyPressed() {
  switch (key) {
    case 'f':
      flash = !flash;
      console.log('flash on?', flash);
      break;
    case 'a':
      auto = !auto;
      toggle_auto();
      break;
    case 'c':
      stage = !stage;
      shush = stage;
      center.toggle(true);
      break;
    case 'm':
      move = !move;
      console.log("MOVE", move);
      break;
    case 'd':
      debug = !debug;
      break;
  }


}

function toggle_auto() {
  if (auto) {
    auto_int = setInterval(() => {
      for (let cell of cells) {
        let rand = random(1);
        //console.log('r', rand, auto_on_th, auto_off_th);
        if (cell.on) {
          // Turn it off
          if (rand > auto_off_th) {
            console.log('ON', rand, auto_off_th);
            cell.toggle(true);
          }
        }
        // Otherwise, turn it on
        else if (rand > auto_on_th) {
          console.log('OFF', rand, auto_off_th);
          cell.toggle(true);
        }
        // Recalibrate after each cell
        calibrate();
      }
    }, AUTO_INT_DUR);
    console.log("AUTO ON!");
  }
  else {
    clearInterval(auto_int);
    console.log("AUTO OFF!");
  }
}

function calibrate() {
  // How many cells are on?
  let ons = 0;
  for (let cell of cells) {
    if (cell.on) ons++;
  }
  // Calibrate auto_on_th
  auto_on_th = map(ons, 0, MAX_ON, 0.95, 1);
  auto_off_th = map(ons, 0, MAX_ON, 0.9, 0.8);

  console.log("COUNT", ons, auto_on_th, auto_off_th);

}
