let INPUT_MODE = 'KEYBOARD';
const TRACKED_TAG_ID = '10002042';

const COLS = 7;
const ROWS = 10;

const DIRECTIONS = {
  left:       { dc: -1, dr:  0 },
  right:      { dc:  1, dr:  0 },
  up:         { dc:  0, dr: -1 },
  down:       { dc:  0, dr:  1 },
  'up-left':  { dc: -1, dr: -1 },
  'up-right': { dc:  1, dr: -1 },
  'down-left':  { dc: -1, dr:  1 },
  'down-right': { dc:  1, dr:  1 },
};

const POZYX_PROJECTION = {
  xMult: 0.375,
  yMult: 0.375,
  xOffset: 1250,
  yOffset: 0,
};

const RESPONSE_PROFILES = [
  {
    // Computer waits for human to finish, then responds after a delay.
    name: 'turn-taking',
    moveDuration: 350,
    responseDelay: 500,
    simultaneousMove: false,
  },
  {
    // Computer starts moving at the same time as human, no delay.
    name: 'simultaneous',
    moveDuration: 350,
    responseDelay: 0,
    simultaneousMove: true,
  },
];

let currentProfileIndex = 0;
let showDebug = true;

let w;
let h;
let socket;

let humanMover;
let computerMover;
let lastHumanDir = null;

let gameState = 'idle';
let pendingComputerDir = null;
let computerDelayStart = 0;

const humanDistanceHistory = [];

const responseTypes = {
  // Pick freely from all valid moves.
  random(computer) {
    let validMoves = computer.movementOptions.filter(dirKey => canMove(computer, dirKey));
    if (validMoves.length === 0) return null;
    return random(validMoves);
  },

  // Copy the human's last direction. Silently rejects the move if that direction is blocked.
  mimic(computer, human, humanDir) {
    if (humanDir && canMove(computer, humanDir)) {
      return humanDir;
    }
    console.log(`[mimic] cannot move: hitting a wall (direction: ${humanDir})`);
    return null;
  },

  // Pick from valid moves that are NOT the mimic direction, so it always feels distinct.
  // Falls back to unconstrained random if no other moves are available.
  'not-mimic'(computer, human, humanDir) {
    let mimicDir = (humanDir && canMove(computer, humanDir)) ? humanDir : null;
    let validMoves = computer.movementOptions.filter(d => canMove(computer, d) && d !== mimicDir);
    return validMoves.length > 0 ? random(validMoves) : responseTypes.random(computer, human, humanDir);
  },

  // Pick from valid moves that bring the computer closer to the human.
  // Falls back to any valid move if no strictly closer move exists.
  closer(computer, human) {
    let currentDist = dist(computer.col, computer.row, human.col, human.row);
    let validMoves = computer.movementOptions.filter(dirKey => {
      if (!canMove(computer, dirKey)) return false;
      let d = DIRECTIONS[dirKey];
      return dist(computer.col + d.dc, computer.row + d.dr, human.col, human.row) < currentDist;
    });
    if (validMoves.length === 0) validMoves = computer.movementOptions.filter(d => canMove(computer, d));
    return validMoves.length > 0 ? random(validMoves) : null;
  },

  // Pick from valid moves that take the computer further from the human.
  // Falls back to any valid move if no strictly further move exists.
  further(computer, human) {
    let currentDist = dist(computer.col, computer.row, human.col, human.row);
    let validMoves = computer.movementOptions.filter(dirKey => {
      if (!canMove(computer, dirKey)) return false;
      let d = DIRECTIONS[dirKey];
      return dist(computer.col + d.dc, computer.row + d.dr, human.col, human.row) > currentDist;
    });
    if (validMoves.length === 0) validMoves = computer.movementOptions.filter(d => canMove(computer, d));
    return validMoves.length > 0 ? random(validMoves) : null;
  },
};

const strategies = [
  {
    // The computer moves completely at random on every step, with no awareness
    // of what the human is doing. Acts as a baseline with no responsiveness.
    name: 'random',
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
    name: 'mimic',
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
    // Like elastic-mimic, but the two tracked types are 'closer' and 'further':
    // whether each move decreased or increased the distance to the human.
    // As the closer ratio rises above closerThreshold, the probability of
    // choosing a further move increases elastically — and vice versa.
    name: 'elastic-distance',
    memoryWindow: 10,
    memory: new Array(10).fill('closer'),
    // The closer ratio above which further chance starts to kick in.
    closerThreshold: 0.7,
    // The minimum probability of choosing further when closerRatio equals closerThreshold.
    furtherChanceMin: 0.5,
    // The maximum probability of choosing further when closerRatio reaches 1.0.
    furtherChanceMax: 0.9,
    decide(computer, human, humanDir) {
      let closerCount = this.memory.filter(t => t === 'closer').length;
      let closerRatio = closerCount / this.memoryWindow;
      let chosenType = 'closer';

      if (closerRatio > this.closerThreshold) {
        let furtherChance = map(closerRatio, this.closerThreshold, 1.0, this.furtherChanceMin, this.furtherChanceMax);
        if (random() < furtherChance) {
          chosenType = 'further';
        }
      }

      this.memory.push(chosenType);
      if (this.memory.length > this.memoryWindow) {
        this.memory.shift();
      }

      return responseTypes[chosenType](computer, human);
    }
  },
  {
    // Like elastic-distance, but the memory window tracks the HUMAN mover's
    // moves (closer/further relative to the computer) rather than the computer's
    // own past moves. The computer reads the human's recent approach/retreat
    // ratio and applies the same elastic logic to choose its own next move.
    name: 'elastic-distance-human',
    memoryWindow: 10,
    closerThreshold: 0.4, //good range：0.2–0.4 (lower = more likely to choose further)
    furtherChanceMin: 0.6,
    furtherChanceMax: 0.9,
    decide(computer, human, humanDir) {
      let window = humanDistanceHistory.slice(-this.memoryWindow);
      let effectiveWindow = window.length || 1;
      let closerCount = window.filter(t => t === 'closer').length;
      let closerRatio = closerCount / effectiveWindow;
      let chosenType = 'closer';

      if (closerRatio > this.closerThreshold) {
        let furtherChance = map(closerRatio, this.closerThreshold, 1.0, this.furtherChanceMin, this.furtherChanceMax);
        if (random() < furtherChance) {
          chosenType = 'further';
        }
      }

      return responseTypes[chosenType](computer, human);
    }
  },
  {
    // The computer accumulates a mimic streak. For the first gracePeriod steps
    // flipping is impossible. After that, flip probability scales linearly from
    // minFlipChance (at streak = gracePeriod+1) to 1.0 (at streak = maxStreak).
    // A flip fires a single not-mimic step and resets the streak to 1.
    name: 'streak',
    // How many consecutive mimic steps have been taken since the last flip.
    streak: 1,
    // Steps at the start of each mimic run during which flipping is impossible.
    gracePeriod: 5,
    // When streak reaches this value, flip probability reaches 1.0 (guaranteed flip).
    maxStreak: 15,
    // Flip probability at the first step after the grace period ends.
    minFlipChance: 0.1,
    decide(computer, human, humanDir) {
      if (this.streak <= this.gracePeriod) {
        this.streak++;
        return responseTypes.mimic(computer, human, humanDir);
      }

      // Probability scales from minFlipChance (streak = gracePeriod+1) to 1.0 (streak = maxStreak).
      let flipChance = map(this.streak, this.gracePeriod + 1, this.maxStreak, this.minFlipChance, 1.0);

      if (random() < flipChance) {
        this.streak = 1;
        const CARDINALS = ['left', 'right', 'up', 'down'];
        let mimicDir = (humanDir && canMove(computer, humanDir)) ? humanDir : null;
        let validCardinals = CARDINALS.filter(d => canMove(computer, d) && d !== mimicDir);
        return validCardinals.length > 0 ? random(validCardinals) : responseTypes['not-mimic'](computer, human, humanDir);
      } else {
        this.streak++;
        return responseTypes.mimic(computer, human, humanDir);
      }
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

const STRATEGY_PROGRAM = ['mimic', 'streak', 'elastic-mimic', 'elastic-distance', 'elastic-distance-human', 'random'];
let currentProgramStep = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  updateCellSize();

  humanMover = new Mover(5, 5, color('#2f9e44'), 'ease', ['left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right']);
  humanMover.moveDuration = 250;

  computerMover = new Mover(5, 6, color('#c92a2a'), 'ease', ['left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right']);
  applyProfile(computerMover, RESPONSE_PROFILES[currentProfileIndex]);

  setupInput();

  console.log('Input mode:', INPUT_MODE);
  console.log('Strategy:', STRATEGY_PROGRAM[currentProgramStep]);
  console.log('Profile:', RESPONSE_PROFILES[currentProfileIndex].name);
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

  if (gameState === 'simultaneous') {
    let delayElapsed = millis() - computerDelayStart >= computerMover.responseDelay;
    if (delayElapsed && pendingComputerDir) {
      applyMove(computerMover, pendingComputerDir);
      pendingComputerDir = null;
    }
    if (delayElapsed && !humanMover.isMoving() && !computerMover.isMoving()) {
      gameState = 'idle';
    }
  }

  humanMover.display(w, h);
  computerMover.display(w, h);
  if (showDebug) drawStatus();
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
  rect(12, 12, 500, 308);
  fill(0);
  textSize(28);
  textAlign(LEFT, TOP);

  let x = 40;

  textStyle(NORMAL);
  let l1 = 'Input: ';
  text(l1, x, 40);
  textStyle(BOLD);
  text(INPUT_MODE, x + textWidth(l1), 40);

  textStyle(NORMAL);
  let l2 = 'Strategy (S): ';
  text(l2, x, 80);
  textStyle(BOLD);
  text(STRATEGY_PROGRAM[currentProgramStep].toUpperCase(), x + textWidth(l2), 80);

  textStyle(NORMAL);
  let l3 = 'Profile (P): ';
  text(l3, x, 120);
  textStyle(BOLD);
  text(RESPONSE_PROFILES[currentProfileIndex].name.toUpperCase(), x + textWidth(l3), 120);

  textStyle(NORMAL);
  let l4 = 'Tracked tag: ';
  text(l4, x, 160);
  textStyle(BOLD);
  text(TRACKED_TAG_ID, x + textWidth(l4), 160);

  textStyle(NORMAL);
  text('Toggle Input (I)', x, 200);
  text('Toggle Status (D)', x, 240);
  text('Reset (R)', x, 280);

  pop();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    currentProgramStep = (currentProgramStep + 1) % STRATEGY_PROGRAM.length;
    console.log('Strategy:', STRATEGY_PROGRAM[currentProgramStep]);
    return;
  }

  if (key === 'p' || key === 'P') {
    currentProfileIndex = (currentProfileIndex + 1) % RESPONSE_PROFILES.length;
    applyProfile(computerMover, RESPONSE_PROFILES[currentProfileIndex]);
    console.log('Profile:', RESPONSE_PROFILES[currentProfileIndex].name);
    return;
  }

  if (key === 'i' || key === 'I') {
    INPUT_MODE = (INPUT_MODE === 'KEYBOARD') ? 'POZYX' : 'KEYBOARD';
    if (INPUT_MODE === 'POZYX') setupInput();
    console.log('Input mode:', INPUT_MODE);
    return;
  }

  if (key === 'd' || key === 'D') {
    showDebug = !showDebug;
    return;
  }

  if (key === 'r' || key === 'R') {
    resetComputer();
    return;
  }

  if (INPUT_MODE !== 'KEYBOARD') return;
  if (gameState !== 'idle') return;

  let dirKey = null;

  if (keyCode === 103) dirKey = 'up-left';
  if (keyCode === 104) dirKey = 'up';
  if (keyCode === 105) dirKey = 'up-right';
  if (keyCode === 100) dirKey = 'left';
  if (keyCode === 102) dirKey = 'right';
  if (keyCode === 97)  dirKey = 'down-left';
  if (keyCode === 98)  dirKey = 'down';
  if (keyCode === 99)  dirKey = 'down-right';

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

function recordHumanDistanceMove(toCol, toRow) {
  let currentDist = dist(humanMover.col, humanMover.row, computerMover.col, computerMover.row);
  let newDist = dist(toCol, toRow, computerMover.col, computerMover.row);
  humanDistanceHistory.push(newDist < currentDist ? 'closer' : 'further');
}

function requestHumanMove(dirKey) {
  if (!canMove(humanMover, dirKey)) return false;

  let d = DIRECTIONS[dirKey];
  recordHumanDistanceMove(humanMover.col + d.dc, humanMover.row + d.dr);
  applyMove(humanMover, dirKey);
  lastHumanDir = dirKey;
  beginHumanTurn();
  return true;
}

function requestHumanMoveToCell(col, row) {
  if (gameState !== 'idle') return false;
  if (!isCellInBounds(col, row)) return false;
  if (humanMover.col === col && humanMover.row === row) return false;

  recordHumanDistanceMove(col, row);
  let dirKey = getDirectionFromCells(humanMover.col, humanMover.row, col, row);
  humanMover.moveTo(col, row);
  lastHumanDir = dirKey;
  beginHumanTurn();
  return true;
}

function beginHumanTurn() {
  if (computerMover.simultaneousMove) {
    gameState = 'simultaneous';
    computerDelayStart = millis();
    let strategy = strategies.find(s => s.name === STRATEGY_PROGRAM[currentProgramStep]);
    pendingComputerDir = strategy.decide(computerMover, humanMover, lastHumanDir);
  } else {
    if (humanMover.isMoving()) {
      gameState = 'human-moving';
    } else {
      beginComputerDelay();
    }
  }
}

function beginComputerDelay() {
  gameState = 'computer-delay';
  computerDelayStart = millis();
  let strategy = strategies.find(s => s.name === STRATEGY_PROGRAM[currentProgramStep]);
  pendingComputerDir = strategy.decide(computerMover, humanMover, lastHumanDir);
}

function resetComputer() {
  let adjacent = Object.values(DIRECTIONS)
    .map(d => ({ col: humanMover.col + d.dc, row: humanMover.row + d.dr }))
    .filter(cell => isCellInBounds(cell.col, cell.row));

  if (adjacent.length === 0) return;

  let target = random(adjacent);
  gameState = 'idle';
  pendingComputerDir = null;
  computerMover.col = target.col;
  computerMover.row = target.row;
  computerMover._fromCol = target.col;
  computerMover._fromRow = target.row;
  computerMover._toCol = target.col;
  computerMover._toRow = target.row;
  computerMover._moving = false;
  console.log(`[reset] computer → (${target.col}, ${target.row})`);
}

function applyProfile(mover, profile) {
  mover.moveDuration = profile.moveDuration;
  mover.responseDelay = profile.responseDelay;
  mover.simultaneousMove = profile.simultaneousMove;
}

function getDirectionFromCells(fromCol, fromRow, toCol, toRow) {
  let dc = toCol - fromCol;
  let dr = toRow - fromRow;

  if (abs(dc) > 1 || abs(dr) > 1 || (dc === 0 && dr === 0)) return null;
  if (dc === -1 && dr ===  0) return 'left';
  if (dc ===  1 && dr ===  0) return 'right';
  if (dc ===  0 && dr === -1) return 'up';
  if (dc ===  0 && dr ===  1) return 'down';
  if (dc === -1 && dr === -1) return 'up-left';
  if (dc ===  1 && dr === -1) return 'up-right';
  if (dc === -1 && dr ===  1) return 'down-left';
  if (dc ===  1 && dr ===  1) return 'down-right';
  return null;
}

function setupInput() {
  if (INPUT_MODE !== 'POZYX') return;
  if (socket) return;
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