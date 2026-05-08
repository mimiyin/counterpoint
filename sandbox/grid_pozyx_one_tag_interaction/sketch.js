const INPUT_MODE = 'KEYBOARD';
const TRACKED_TAG_ID = '10002042';

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
  // Pick freely from all valid moves.
  random(computer) {
    let validMoves = computer.movementOptions.filter(dirKey => canMove(computer, dirKey));
    if (validMoves.length === 0) return null;
    return random(validMoves);
  },

  // Copy the human's last direction. Falls back to random if that move isn't available.
  mimic(computer, human, humanDir) {
    if (humanDir && canMove(computer, humanDir)) {
      return humanDir;
    }
    return responseTypes.random(computer, human, humanDir);
  },

  // Pick from valid moves that are NOT the mimic direction, so it always feels distinct.
  // Falls back to unconstrained random if no other moves are available.
  'not-mimic'(computer, human, humanDir) {
    let mimicDir = (humanDir && canMove(computer, humanDir)) ? humanDir : null;
    let validMoves = computer.movementOptions.filter(d => canMove(computer, d) && d !== mimicDir);
    return validMoves.length > 0 ? random(validMoves) : responseTypes.random(computer, human, humanDir);
  },
};

const strategies = [
  {
    // The computer moves completely at random on every step, with no awareness
    // of what the human is doing. Acts as a baseline with no responsiveness.
    name: 'always-random',
    memoryWindow: 0,
    memory: [],
    decide(computer, human, humanDir) {
      return responseTypes.random(computer, human, humanDir);
    }
  },
  {
    // The computer always attempts to mirror the human's last direction.
    // If that direction is blocked, it falls back to random. Acts as a baseline
    // with maximum responsiveness and no variation.
    name: 'always-mimic',
    memoryWindow: 0,
    memory: [],
    decide(computer, human, humanDir) {
      return responseTypes.mimic(computer, human, humanDir);
    }
  },
  {
    // The computer starts in mimic mode and tracks the ratio of mimic moves over
    // a sliding memory window. As that ratio rises above mimicThreshold, the
    // probability of switching to not-mimic increases. This creates an elastic
    // tension: the more the computer has been mimicking, the more likely it is
    // to break the pattern — and vice versa.
    name: 'elastic-mimic',
    memoryWindow: 10,
    memory: new Array(10).fill('mimic'),
    // The mimic ratio above which not-mimic chance starts to kick in.
    // Below this threshold, the computer always mimics.
    mimicThreshold: 0.5,
    // The minimum probability of choosing not-mimic when mimicRatio equals mimicThreshold.
    notMimicChanceMin: 0.5,
    // The maximum probability of choosing not-mimic when mimicRatio reaches 1.0.
    notMimicChanceMax: 0.9,
    decide(computer, human, humanDir) {
      let mimicCount = this.memory.filter(t => t === 'mimic').length;
      let mimicRatio = mimicCount / this.memoryWindow;
      let chosenType = 'mimic';

      if (mimicRatio > this.mimicThreshold) {
        let notMimicChance = map(mimicRatio, this.mimicThreshold, 1.0, this.notMimicChanceMin, this.notMimicChanceMax);
        if (random() < notMimicChance) {
          chosenType = 'not-mimic';
        }
      }

      this.memory.push(chosenType);
      if (this.memory.length > this.memoryWindow) {
        this.memory.shift();
      }

      return responseTypes[chosenType](computer, human, humanDir);
    }
  },
  {
    // The computer alternates between mimic and not-mimic, but instead of
    // switching at a fixed interval, the probability of flipping grows with
    // each consecutive step in the same mode (the streak). A short streak is
    // unlikely to flip; once the streak hits maxStreak, a flip is guaranteed.
    // This produces variable-length runs with a natural sense of building pressure.
    name: 'streak-flip',
    // Current active mode: 'mimic' or 'not-mimic'. Flips between the two.
    currentType: 'mimic',
    // How many consecutive times the current type has been used.
    streak: 1,
    // When streak reaches this value, flip probability reaches 1.0 (guaranteed flip).
    maxStreak: 10,
    // Flip probability when streak = 1 (just flipped). Higher = more jittery.
    minFlipChance: 0.1,
    decide(computer, human, humanDir) {
      // Probability of flipping scales linearly from minFlipChance (streak=1) to 1.0 (streak=maxStreak).
      let flipChance = map(this.streak, 1, this.maxStreak, this.minFlipChance, 1.0);

      if (random() < flipChance) {
        this.currentType = (this.currentType === 'mimic') ? 'not-mimic' : 'mimic';
        this.streak = 1;
      } else {
        this.streak++;
      }

      return responseTypes[this.currentType](computer, human, humanDir);
    }
  },
  {
    // The computer operates in structured phrases. Each phrase has the form
    // A...A B, where A is repeated (phraseLength-1) times and B is the opposite
    // type. The final B move is shared with the next phrase as its first step,
    // so transitions are seamless. After each phrase, a new length (2–10) is
    // chosen randomly, giving AB, AAB, AAAB, ... up to Ax9 B.
    name: 'phrase-random',
    // The repeated move type (A) in the current phrase.
    currentType: 'mimic',
    // Total length of the current phrase: (phraseLength-1) A moves, then 1 B move.
    // Ranges from 2 (AB) to 10 (Ax9 B).
    phraseLength: 2,
    // Current position within the phrase (0-indexed).
    step: 0,
    decide(computer, human, humanDir) {
      let otherType = (this.currentType === 'mimic') ? 'not-mimic' : 'mimic';
      let isLastStep = this.step === this.phraseLength - 1;
      let typeToUse = isLastStep ? otherType : this.currentType;

      if (isLastStep) {
        // The B move ends this phrase and simultaneously starts the next one.
        // Flip: B's type becomes the new A type.
        let newAType = otherType;
        let newBType = this.currentType; // old A becomes the B of the next phrase
        this.currentType = newAType;
        // Pick a new random phrase length for the upcoming phrase.
        this.phraseLength = floor(random(2, 11));
        // B was step 0 of the new phrase; advance to step 1.
        this.step = 1;
        console.log(`[phrase-random] new phrase: ${newAType.padEnd(9)} x${this.phraseLength - 1} + ${newBType}`);
      } else {
        this.step++;
      }

      return responseTypes[typeToUse](computer, human, humanDir);
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