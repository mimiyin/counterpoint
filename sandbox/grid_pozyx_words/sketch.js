let movers = {}
let cells = [];

const COLS = 7;
const ROWS = 10;
let w, h;

let word_files = {};

let chains = {};
let word = 'hello';

let t = 0;
let dir = 1;

function process(lines) {
  lines.forEach((line) => {
    let words = line.split(' ');
    let first = words[0];
    let second = words[1];
    if (!(first in chains)) chains[first] = [];
    chains[first].push(second)
  });

  console.log(chains);
}

//let words = ['i', 'you', 'me', 'us', 'here', 'now', 'there', 'then', 'why', 'because'];
function preload() {
  loadStrings('text.txt', process);
  for(let word of words) {
    word_files[word] = loadSound('words/' + word + '.wav');
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width / COLS;
  h = height / ROWS;

  console.log(word_files);
  // Set up pozyx
  pozyx();

  for (let r = 0; r < ROWS; r++) {
    cells[r] = [];
    for (let c = 0; c < COLS; c++) {
      cells[r][c] = new Cell(c * w, r * h);
    }
  }

  // Create fake data
  if (!pozyx_on) init_movers(2);
}

function draw() {
  background(0);
  noStroke();

  // Look for new tag data
  for(let id in tags) {
    let pos = tags[id];
    if(id in movers) movers[id].update(pos.x, pos.y)
    else {
      movers[id] = new Mover(id, pos.x, pos.y);
    }
  }


  // Draw cells
  // Reset them all to empty
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let cell = cells[r][c];
      cell.display();
    }
  }
  

  // Check movers
  // Occupy cells
  // Count + speak
  // Draw movers
  for (let m in movers) {
    let mover = movers[m];
    mover.move();
    mover.count(0);
    let cell = locate(mover.x, mover.y);
    cell.occupy();
    if (mover.still()) {
      // Noodle
      dir = random(1) < 0.8 ? dir : -dir;
      let d = random(1) < 0.8 ? 1 : 0.5;
      d *= dir;
      t += d;
      t = constrain(t, 0, words.length-1);

      // Randomize
      if(random(1) > 0.8) t = random(0, words.length);

      // Change direction
      if(t < 1 && dir < 0) dir = 1;
      if(t >= words.length - 1 && dir > 0) dir = -1;


      let w = floor(t);
      console.log(t, w, words[w]);
      cell.speak(words[w]);
      //let n = floor(random(chains[word].length)) || 0;
      //word = chains[word][n];
      //console.log("next word", word);
      mover.silence();
    }
    mover.display();
  }

  // Recheck cells
  // Cue up cells that are empty
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let cell = cells[r][c];
      // if cell is empty
      //if(cell.isEmpty) cell.cue(true);
    }
  }
}

function get_random_mover() {
    let movers_arr = [];
    for(let m in movers) {
      movers_arr.push(movers[m]);
    }
    return(random(movers_arr));
}

function locate(x, y) {
  let r = floor(y / h);
  let c = floor(x / w);
  return cells[r][c];
}

function calc_avg() {
  // Calculate avg position
  let avg = { x : 0, y : 0 };
  let count = 0;
  for (let m in movers) {
    let mover = movers[m];
    avg.x += mover.x;
    avg.y += mover.y;
    count++;
  }
  avg.x /= count;
  avg.y /= count;

  return avg;
}