const INPUT_MODE = 'KEYBOARD';
const TRACKED_TAG_ID = 10002043;

const COLS = 10;
const ROWS = 10;

const DIRECTIONS = {
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
};

const POZYX_PROJECTION = {
  xMult: 0.375,
  yMult: 0.375,
  xOffset: 1250,
  yOffset: 0,
};

let w;
let h;
let socket;

let humanMover;
let computerMover;
let lastHumanDir = null;

let gameState = 'idle';
let pendingComputerDir = null;
let computerDelayStart = 0;

const responseTypes = {
  random(computer) {
    let validMoves = computer.movementOptions.filter(dirKey => canMove(computer, dirKey));
    if (validMoves.length === 0) return null;
    return random(validMoves);
  },

  mimic(computer, human, humanDir) {
    if (humanDir && canMove(computer, humanDir)) {
      return humanDir;
    }

    return responseTypes.random(computer, human, humanDir);
  },
};

const strategies = [
  {
    name: 'always-random',
    memoryWindow: 0,
    memory: [],
    decide(computer, human, humanDir) {
      return responseTypes.random(computer, human, humanDir);
    }
  },
  {
    name: 'always-mimic',
    memoryWindow: 0,
    memory: [],
    decide(computer, human, humanDir) {
      return responseTypes.mimic(computer, human, humanDir);
    }
  },
  {
    name: 'elastic-mimic',
    memoryWindow: 10,
    memory: new Array(10).fill('mimic'),
    decide(computer, human, humanDir) {
      let mimicCount = this.memory.filter(responseName => responseName === 'mimic').length;
      let mimicRatio = mimicCount / this.memoryWindow;
      let chosenType = 'mimic';

      if (mimicRatio > 0.5) {
        let randomChance = map(mimicRatio, 0.5, 1.0, 0.5, 0.9);
        if (random() < randomChance) {
          chosenType = 'random';
        }
      }

      let dirKey = responseTypes[chosenType](computer, human, humanDir);

      this.memory.push(chosenType);
      if (this.memory.length > this.memoryWindow) {
        this.memory.shift();
      }

      return dirKey;
    }
  },
];

let currentStrategyIndex = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  updateCellSize();

  humanMover = new Mover(5, 5, color('#2f9e44'), 'ease', ['left', 'right', 'up', 'down']);
  humanMover.moveDuration = 250;

  computerMover = new Mover(5, 6, color('#c92a2a'), 'ease', ['left', 'right', 'up', 'down']);
  computerMover.moveDuration = 350;
  computerMover.responseDelay = 500;

  setupInput();

  console.log('Input mode:', INPUT_MODE);
  console.log('Strategy:', strategies[currentStrategyIndex].name);
}

function draw() {
  background(255);
  drawGrid();

  humanMover.update();
  computerMover.update();

  if (gameState === 'human-moving' && !humanMover.isMoving()) {
    beginComputerDelay();
  }

  if (gameState === 'computer-delay' && millis() - computerDelayStart >= computerMover.responseDelay) {
    if (pendingComputerDir) {
      applyMove(computerMover, pendingComputerDir);
      pendingComputerDir = null;
      gameState = 'computer-moving';
    } else {
      gameState = 'idle';
    }
  }

  if (gameState === 'computer-moving' && !computerMover.isMoving()) {
    gameState = 'idle';
  }

  humanMover.display(w, h);
  computerMover.display(w, h);
  drawStatus();
}

function drawGrid() {
  noStroke();
  for (let c = 0; c < COLS; c++) {
    let x = c * w;
    for (let r = 0; r < ROWS; r++) {
      let y = r * h;
      fill((c + r) % 2 === 0 ? 255 : 0);
      rect(x, y, w, h);
    }
  }
}

function drawStatus() {
  push();
  fill(255, 235);
  rect(12, 12, 250, 74);
  fill(0);
  textSize(14);
  textAlign(LEFT, TOP);
  text(`Mode: ${INPUT_MODE}`, 20, 20);
  text(`Strategy: ${strategies[currentStrategyIndex].name}`, 20, 40);
  text(`Tracked tag: ${TRACKED_TAG_ID}`, 20, 60);
  pop();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    currentStrategyIndex = (currentStrategyIndex + 1) % strategies.length;
    console.log('Strategy:', strategies[currentStrategyIndex].name);
    return;
  }

  if (INPUT_MODE !== 'KEYBOARD') return;
  if (gameState !== 'idle') return;

  let dirKey = null;

  if (keyCode === LEFT_ARROW) dirKey = 'left';
  if (keyCode === RIGHT_ARROW) dirKey = 'right';
  if (keyCode === UP_ARROW) dirKey = 'up';
  if (keyCode === DOWN_ARROW) dirKey = 'down';

  if (!dirKey) return;
  requestHumanMove(dirKey);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateCellSize();
}

function updateCellSize() {
  w = width / COLS;
  h = height / ROWS;
}

function isCellInBounds(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

function canMove(mover, dirKey) {
  let direction = DIRECTIONS[dirKey];
  if (!direction) return false;

  let nextCol = mover.col + direction.dc;
  let nextRow = mover.row + direction.dr;
  return isCellInBounds(nextCol, nextRow);
}

function applyMove(mover, dirKey) {
  let direction = DIRECTIONS[dirKey];
  if (!direction) return false;

  mover.moveTo(mover.col + direction.dc, mover.row + direction.dr);
  return true;
}

function requestHumanMove(dirKey) {
  if (!canMove(humanMover, dirKey)) return false;

  applyMove(humanMover, dirKey);
  lastHumanDir = dirKey;
  beginHumanTurn();
  return true;
}

function requestHumanMoveToCell(col, row) {
  if (gameState !== 'idle') return false;
  if (!isCellInBounds(col, row)) return false;
  if (humanMover.col === col && humanMover.row === row) return false;

  let dirKey = getDirectionFromCells(humanMover.col, humanMover.row, col, row);
  humanMover.moveTo(col, row);
  lastHumanDir = dirKey;
  beginHumanTurn();
  return true;
}

function beginHumanTurn() {
  if (humanMover.isMoving()) {
    gameState = 'human-moving';
  } else {
    beginComputerDelay();
  }
}

function beginComputerDelay() {
  gameState = 'computer-delay';
  computerDelayStart = millis();
  let strategy = strategies[currentStrategyIndex];
  pendingComputerDir = strategy.decide(computerMover, humanMover, lastHumanDir);
}

function getDirectionFromCells(fromCol, fromRow, toCol, toRow) {
  let dc = toCol - fromCol;
  let dr = toRow - fromRow;

  if (abs(dc) + abs(dr) !== 1) return null;
  if (dc === -1) return 'left';
  if (dc === 1) return 'right';
  if (dr === -1) return 'up';
  if (dr === 1) return 'down';
  return null;
}

function setupInput() {
  if (INPUT_MODE !== 'POZYX') return;
  if (typeof io !== 'function') {
    console.warn('Socket.io client is unavailable.');
    return;
  }

  socket = io();
  socket.on('connect', function () {
    console.log("HEY, I'VE CONNECTED: ", socket.id);
  });
  socket.on('pozyx', handlePozyxMessage);
}

function handlePozyxMessage(message) {
  let tag = Array.isArray(message) ? message[0] : message;
  if (!tag || tag.tagId !== TRACKED_TAG_ID) return;

  let coordinates = tag.data && tag.data.coordinates;
  if (!coordinates) return;

  let projected = projectPozyxToCanvas(coordinates.x, coordinates.y);
  let cell = getCellFromCanvas(projected.x, projected.y);
  requestHumanMoveToCell(cell.col, cell.row);
}

function projectPozyxToCanvas(x, y) {
  let translatedX = (x + POZYX_PROJECTION.xOffset) * POZYX_PROJECTION.xMult;
  let translatedY = (y + POZYX_PROJECTION.yOffset) * POZYX_PROJECTION.yMult;
  return { x: translatedX, y: translatedY };
}

function getCellFromCanvas(x, y) {
  let col = constrain(floor(x / w), 0, COLS - 1);
  let row = constrain(floor(y / h), 0, ROWS - 1);
  return { col, row };
}