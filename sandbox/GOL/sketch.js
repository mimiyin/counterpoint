// SPACE = REGENERATE
// D = DISPLAY
// 1,2,3,4 = PRESET DENSITIES
// UP, DOWN = FADING SPEED
// LEFT, RIGHT = JUMP PRESENT DENSITIES
// A = AUTO VS. MANUAL (AUTO MEANS WEIGHTED RANDOM)

// Press 'f' to turn flash on/off
// FLASH SETTINGS
const FPS = 60;
const FLASH_INTERVAL = FPS * 10 // Will flash every 10s
const FLASH_HOLD = FPS * 0.5 // For 1/2 a second
const FLASH_BG = 128

// Press 'f' to turn flash on/off
let flash = false;

// GOL SETTINGS
const INTERVAL_IN_SECONDS = 60 // Time between generations in seconds
let density = 0.1 // Density (0.01 to 0.75)
let visRes = 3; // Visible resolution (number of columns and rows)
let pace = 5; // From 0-255 How fast to fade in / fade out per frame

/////////////////////////////////////////////
let w, h, columns, rows, board, pboard, next;
let auto = true;
let fadeIn = 0;
let fadeOut = 255;
let generateInterval = FPS * INTERVAL_IN_SECONDS; // Time between generations in seconds
let seedWeights = [0, 10, 20, 50, 20]; // DENSITY WEIGHT, IGNORE FIRST '0'
let weights = [];
let densities = [-1, 0.01, 0.05, 0.1, 0.5, 0.75]; // DENSITY PRESET
let di = 5; // CHANGE STARTING DENSITY HERE
let res = visRes + 2;
let debug = false;
let go = true;

console.log("DENSITY: ", density, "INTERVAL: ", generateInterval);

function setup() {
  let tWeight = 0;
  for (i = 0; i < seedWeights.length; i++) {
    tWeight = tWeight + seedWeights[i];
    weights.push(tWeight);
  }

  noStroke();
  createCanvas(windowWidth, windowHeight);
  background(0);
  w = windowWidth / res;
  h = windowHeight / res;
  // Calculate columns and rows
  columns = res + 2;
  rows = res + 2;
  // Wacky way to make a 2D array is JS
  board = new Array(columns);
  for (let i = 0; i < columns; i++) {
    board[i] = new Array(rows);
  }
  // Going to use multiple 2D arrays and swap them
  next = new Array(columns);
  for (i = 0; i < columns; i++) {
    next[i] = new Array(rows);
  }
  init();
  generate();
}

function draw() {
  // background(255);
  push();
  translate(-w, -h);

  if (frameCount % generateInterval == 1) {
    fadeIn = 0;
    fadeOut = 255;
    //pace = 512 / generateInterval;
    //pace = random(300, 600)/generateInterval;
    pboard = board;
    generate();
  }

  // draw new board
  changeCount = 0;
  if (pboard) {
    for (let i = 0; i < columns; i++) {
      for (let j = 0; j < rows; j++) {
        if (pboard[i][j] == board[i][j] && pboard[i][j] == 1) {
          // if both are white
          fill(255);
        } else if (pboard[i][j] != board[i][j] && pboard[i][j] == 1) {
          // if it used to be white
          fill(fadeOut);
          changeCount++;
        } else if (pboard[i][j] != board[i][j] && pboard[i][j] == 0) {
          // if it used to be black
          fill(fadeIn);
          changeCount++;
        } else {
          // if both are black
          fill(0);
        }
        noStroke();
        rect(i * w, j * h, w, h);
      }
    }
    if (auto && changeCount == 0) {
      init();
    }
  } else {
    // first board
    for (let i = 0; i < columns; i++) {
      for (let j = 0; j < rows; j++) {
        if (board[i][j] == 1) {
          fill(fadeIn);
        } else {
          fill(0);
        }
        noStroke();
        rect(i * w, j * h, w, h);
      }
    }
  }
  fadeIn += pace;
  fadeOut -= pace;
  pop();
  if (debug) {
    fill(255, 0, 0);
    textSize(height / 75);
    textAlign(RIGHT, BOTTOM);
    text("auto:" + auto + "\tinterval:" + generateInterval + "\tdensity:" + density, width, height);
    // text("speed:" + generateInterval, w, height + h);
    // text("   density:" + density, w, height + h);
    // text("auto:" + auto,  w, height + h);
    // text("speed:" + generateInterval, w, height + h);
    // text("density:" + density, w, height + h);
  }

  if (flash) {
    let f = frameCount % FLASH_INTERVAL;
    if (f > 0 && f < FLASH_HOLD) background(FLASH_BG);
  }
}

// Fill board randomly
function init() {
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      // Lining the edges with 0s
      if (i == 0 || j == 0 || i == columns - 1 || j == rows - 1)
        board[i][j] = 0;
      // Filling the rest randomly
      else board[i][j] = random(1) <= density ? 1 : 0;
      next[i][j] = 0;
    }
  }
}

// The process of creating the new generation
function generate() {
  console.log("generate");
  // Loop through every spot in our 2D array and check spots neighbors
  for (let x = 1; x < columns - 1; x++) {
    for (let y = 1; y < rows - 1; y++) {
      // Add up all the states in a 3x3 surrounding grid
      let neighbors = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          neighbors += board[x + i][y + j];
        }
      }

      // A little trick to subtract the current cell's state since
      // we added it in the above loop
      neighbors -= board[x][y];
      // Rules of Life
      if (board[x][y] == 1 && neighbors < 2) next[x][y] = 0;
      // Loneliness
      else if (board[x][y] == 1 && neighbors > 3) next[x][y] = 0;
      // Overpopulation
      else if (board[x][y] == 0 && neighbors == 3) next[x][y] = 1;
      // Reproduction
      else next[x][y] = board[x][y]; // Stasis
    }
  }

  // Swap!
  let temp = board;
  board = next;
  next = temp;
}

function keyPressed() {
  // if user presses 1, decrease generate interval by 50 until it reaches 300, if user presses 2, increase generate interval by 50 until it reaches 900

  if(key == '1' || key == '2' || key == '3' || key == '4' || key == '5') density = densities[key];

  switch (keyCode) {
    case RIGHT_ARROW:
      generateInterval += 100;
      break;
    case LEFT_ARROW:
      generateInterval -= 100;
      break;
  }


switch (keyCode) {
  case 32:
    go = !go;
    if (go) loop();
    else noLoop();
    console.log(go ? "Go" : "Pause");
    break;
  case BACKSPACE:
    init();
    break;
  case SHIFT:
    debug = !debug;
    break;
  case ENTER:
    auto = !auto;
    break;
}

switch (key) {
    case 'f':
      flash = !flash;
      console.log('flash on?', flash);
  }

// Half a second to 15 seconds
generateInterval = constrain(generateInterval, 30, 900);

console.log("current generation interval: " + generateInterval);
console.log("current density: " + density);

}
