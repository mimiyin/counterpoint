const COLS = 10;
const ROWS = 10;
let w, h;

function setup() {
  createCanvas(windowWidth, windowHeight);
  w = width/COLS;
  h = height/ROWS;

  for(let c = 0 ; c < COLS; c++) {
    let x = c * w;
    for (let r = 0 ; r < ROWS; r++) {
      let y = r * h;
      fill((c + r) % 2 == 0 ? 255 : 0);
      rect(x, y, w, h);

    }
  }
}

// function draw() {
//   background(255);
// }