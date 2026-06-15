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

let currentProfileIndex = 0;
let showDebug = true;
let showHuman = true;

let w;
let h;

let humanMover;
let computerMover;
let lastHumanDir = null;

let gameState = 'idle';
let pendingComputerDir = null;
let computerDelayStart = 0;

const POZYX_DWELL_MS = 250;
let pozyxPendingCell = null;
let pozyxPendingStart = 0;

const humanDistanceHistory = [];

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

// The STRATEGY_PROGRAM array defines the sequence of strategies 
// that will be cycled through when the user presses the 'S' key. 
// Each entry corresponds to a strategy defined in the strategies array below. 
// See strategies comment for details on each strategy.
// This allows for easy switching between different computer response behaviors during runtime.
const STRATEGY_PROGRAM = [
  'static/mimic-human-direction',
  'streak/mimic-human-direction', // use first streak to introduce surpise

  'static/mimic-human-distance', // then goes to distanc mimic
  'streak/mimic-human-distance', // another streak for surprise

  'elastic/mimic-human-direction', // goes to elastic. tracking mimic/not-mimic. the type of mimicry is direction.
  'elastic/mimic-human-distance', // again, tracking mimic/not-mimic, but this time the type of mimicry is distance (closer/further).

  // 'elastic/self-distance', // then tracking its own distance behaviour regardless of human's behaviour. 
  'elastic/human-distance', // then tracking human's distance behaviour regardless of its own. 
                            // default threshold 04 is clingy
                            // you'd need to try to take a consetive number of closer steps to make it choose further
  
  // 'phrase/random', // using AxxxB phrases. Not good fow now.

  'random/random',
];
let currentProgramStep = 0;

const strategies = [
  {
    // The computer moves completely at random on every step, with no awareness
    // of what the human is doing. Acts as a baseline with no responsiveness.
    name: 'random/random',
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
    name: 'static/mimic-human-direction',
    memoryWindow: 0,
    memory: [],
    decide(computer, human, humanDir) {
      return responseTypes.mimic(computer, human, humanDir);
    }
  },
  {
    // The computer mirrors the human's last distance move: if the human moved
    // closer to the computer, the computer moves closer to the human; if the
    // human moved further away, the computer also moves further away.
    // Falls back to random if no human move has been recorded yet.
    name: 'static/mimic-human-distance',
    memoryWindow: 0,
    memory: [],
    decide(computer, human, humanDir) {
      let lastHumanType = humanDistanceHistory[humanDistanceHistory.length - 1];
      if (!lastHumanType) return responseTypes.random(computer, human, humanDir);
      return responseTypes[lastHumanType](computer, human);
    }
  },
  {
    // The computer accumulates a mimic streak. For the first gracePeriod steps
    // flipping is impossible. After that, flip probability scales linearly from
    // minFlipChance (at streak = gracePeriod+1) to 1.0 (at streak = maxStreak).
    // A flip fires a single not-mimic step and resets the streak to 1.
    name: 'streak/mimic-human-direction',
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
    // Like streak, but the default move mirrors the human's last distance move
    // (mimic-distance: human closer → computer closer, human further → computer further).
    // The streak counts consecutive mimic-distance moves. After the grace period,
    // flip probability rises until a single counter move fires (opposite of human's
    // last distance move) and resets the streak.
    name: 'streak/mimic-human-distance',
    streak: 1,
    gracePeriod: 5,
    maxStreak: 15,
    minFlipChance: 0.1,
    decide(computer, human, humanDir) {
      let lastHumanType = humanDistanceHistory[humanDistanceHistory.length - 1];
      let mimicType = lastHumanType || 'closer';
      let flipType = (mimicType === 'closer') ? 'further' : 'closer';

      if (this.streak <= this.gracePeriod) {
        this.streak++;
        return responseTypes[mimicType](computer, human);
      }

      let flipChance = map(this.streak, this.gracePeriod + 1, this.maxStreak, this.minFlipChance, 1.0);

      if (random() < flipChance) {
        this.streak = 1;
        return responseTypes[flipType](computer, human);
      } else {
        this.streak++;
        return responseTypes[mimicType](computer, human);
      }
    }
  },
  {
    // The computer starts in mimic human's direction mode and tracks the ratio of mimic moves over
    // a sliding memory window. As that ratio rises above mimicThreshold, the
    // probability of switching to not-mimic increases. This creates an elastic
    // tension: the more the computer has been mimicking human, the more likely it is
    // to break the pattern — and vice versa.
    name: 'elastic/mimic-human-direction',
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
    // Elastic strategy tracking whether the computer is mirroring the human's
    // distance behaviour (mimic) or doing the opposite (not-mimic).
    // 'mimic' = human closer → computer closer; human further → computer further.
    // As the mimic ratio in the memory window rises above mimicThreshold, the
    // probability of switching to not-mimic increases elastically.
    name: 'elastic/mimic-human-distance',
    memoryWindow: 10,
    memory: new Array(10).fill('mimic'),
    mimicThreshold: 0.5,
    notMimicChanceMin: 0.5,
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

      let lastHumanType = humanDistanceHistory[humanDistanceHistory.length - 1];
      let mimicMove = lastHumanType || 'closer';
      let notMimicMove = (mimicMove === 'closer') ? 'further' : 'closer';
      return responseTypes[chosenType === 'mimic' ? mimicMove : notMimicMove](computer, human);
    }
  },
  {
    // The two tracked types are 'closer' and 'further' of itself, disregarding human's behaviour.
    // The computer tracks its own recent distance moves in the memory window and 
    // calculates the ratio of moves that brought it closer to the human.
    // As the closer ratio rises above closerThreshold, the probability of
    // choosing a further move increases elastically — and vice versa.
    name: 'elastic/self-distance',
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
    // Like elastic/self-distance, but the memory window tracks the HUMAN mover's
    // moves (closer/further relative to the computer) rather than the computer's
    // own past moves. The computer reads the human's recent approach/retreat
    // ratio and applies the same elastic logic to choose its own next move.
    name: 'elastic/human-distance',
    memoryWindow: 10,
    closerThreshold: 0.4, //good range：0.2–0.4 (lower = more likely to choose further, 0.4 very clingy)
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
    // The computer operates in structured phrases. Each phrase has the form
    // A...A B, where A is repeated (phraseLength-1) times and B is the opposite
    // type. The final B move is shared with the next phrase as its first step,
    // so transitions are seamless. After each phrase, a new length (2–10) is
    // chosen randomly, giving AB, AAB, AAAB, ... up to Ax9 B.
    name: 'phrase/random',
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
        console.log(`[phrase/random] new phrase: ${newAType.padEnd(9)} x${this.phraseLength - 1} + ${newBType}`);
      } else {
        this.step++;
      }

      return responseTypes[typeToUse](computer, human, humanDir);
    }
  },
];



function setup() {
  createCanvas(windowWidth, windowHeight);
  updateCellSize();

  humanMover = new Mover(5, 5, color('#2f9e44'), 'ease', ['left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right']);
  humanMover.moveDuration = 250;

  computerMover = new Mover(5, 6, color('#c92a2a'), 'ease', ['left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right']);
  applyProfile(computerMover, RESPONSE_PROFILES[currentProfileIndex]);

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

  if (INPUT_MODE === 'POZYX') {
    let tag = tags[TRACKED_TAG_ID];
    if (tag) {
      let cell = getCellFromCanvas(tag.x, tag.y);
      if (!pozyxPendingCell || pozyxPendingCell.col !== cell.col || pozyxPendingCell.row !== cell.row) {
        pozyxPendingCell = cell;
        pozyxPendingStart = millis();
      } else if (millis() - pozyxPendingStart >= POZYX_DWELL_MS) {
        requestHumanMoveToCell(cell.col, cell.row);
      }
    }
  }

  if (showHuman) humanMover.display(w, h);
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
  rect(12, 12, 700, 348);
  fill(0);
  textSize(28);
  textAlign(LEFT, TOP);

  let x = 40;
  const keyColor = color(0, 150, 0);

  // Input (I):
  textStyle(NORMAL);
  fill(0); text('Input (', x, 40);
  let iParenX = x + textWidth('Input (');
  fill(keyColor); text('I', iParenX, 40);
  fill(0); text('): ', iParenX + textWidth('I'), 40);
  textStyle(BOLD);
  text(INPUT_MODE, iParenX + textWidth('I') + textWidth('): '), 40);

  // Strategy (S):
  textStyle(NORMAL);
  fill(0); text('Strategy (', x, 80);
  let sParenX = x + textWidth('Strategy (');
  fill(keyColor); text('S', sParenX, 80);
  fill(0); text('): ', sParenX + textWidth('S'), 80);
  let strategyX = sParenX + textWidth('S') + textWidth('): ');
  textStyle(BOLD);
  let strategyFull = STRATEGY_PROGRAM[currentProgramStep].toUpperCase();
  let slashIdx = strategyFull.indexOf('/');
  if (slashIdx !== -1) {
    fill(200, 0, 0);
    let beforeSlash = strategyFull.slice(0, slashIdx);
    text(beforeSlash, strategyX, 80);
    fill(0);
    text(strategyFull.slice(slashIdx), strategyX + textWidth(beforeSlash), 80);
  } else {
    fill(0); text(strategyFull, strategyX, 80);
  }

  // Profile (P):
  textStyle(NORMAL);
  fill(0); text('Profile (', x, 120);
  let pParenX = x + textWidth('Profile (');
  fill(keyColor); text('P', pParenX, 120);
  fill(0); text('): ', pParenX + textWidth('P'), 120);
  textStyle(BOLD);
  text(RESPONSE_PROFILES[currentProfileIndex].name.toUpperCase(), pParenX + textWidth('P') + textWidth('): '), 120);

  // Tracked tag:
  textStyle(NORMAL);
  fill(0);
  let l4 = 'Tracked tag: ';
  text(l4, x, 160);
  textStyle(BOLD);
  text(TRACKED_TAG_ID, x + textWidth(l4), 160);

  // Toggle lines
  textStyle(NORMAL);
  fill(0); text('Toggle Status (', x, 200);
  let tdX = x + textWidth('Toggle Status (');
  fill(keyColor); text('D', tdX, 200);
  fill(0); text(')', tdX + textWidth('D'), 200);

  fill(0); text('Toggle Human (', x, 240);
  let thX = x + textWidth('Toggle Human (');
  fill(keyColor); text('H', thX, 240);
  fill(0); text(')', thX + textWidth('H'), 240);

  fill(0); text('Reset (', x, 280);
  let trX = x + textWidth('Reset (');
  fill(keyColor); text('R', trX, 280);
  fill(0); text(')', trX + textWidth('R'), 280);

  fill(0); text('Reset Further (', x, 320);
  let tfX = x + textWidth('Reset Further (');
  fill(keyColor); text('F', tfX, 320);
  fill(0); text(')', tfX + textWidth('F'), 320);

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
    if (INPUT_MODE === 'POZYX') pozyx();
    console.log('Input mode:', INPUT_MODE);
    return;
  }

  if (key === 'd' || key === 'D') {
    showDebug = !showDebug;
    return;
  }

  if (key === 'h' || key === 'H') {
    showHuman = !showHuman;
    return;
  }

  if (key === 'r' || key === 'R') {
    resetComputer();
    return;
  }

  if (key === 'f' || key === 'F') {
    resetComputerFurther();
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
  const CARDINALS = ['up', 'down', 'left', 'right'];
  let adjacent = CARDINALS
    .map(dir => ({ col: humanMover.col + DIRECTIONS[dir].dc, row: humanMover.row + DIRECTIONS[dir].dr }))
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

function resetComputerFurther() {
  let targetCol = (COLS - 1) - humanMover.col;
  let targetRow = (ROWS - 1) - humanMover.row;

  gameState = 'idle';
  pendingComputerDir = null;
  computerMover.col = targetCol;
  computerMover.row = targetRow;
  computerMover._fromCol = targetCol;
  computerMover._fromRow = targetRow;
  computerMover._toCol = targetCol;
  computerMover._toRow = targetRow;
  computerMover._moving = false;
  console.log(`[reset further] computer → (${targetCol}, ${targetRow})`);
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

function getCellFromCanvas(x, y) {
  let col = constrain(floor(x / w), 0, COLS - 1);
  let row = constrain(floor(y / h), 0, ROWS - 1);
  return { col, row };
}