let cx, cw, sz;
let a = 0;
let aspeed = 0.1;
let adir = 1;
let ds = [];
let cs = [];
let then = 0;
let y = 0;

let follow = false;
let loop = true;

const TH = 1;
const M = TH * 100;

const FR = 30;
const D_DUR = FR * 0.1; // 1/10th of a second
const C_DUR = FR * 0.2; // 1/2 of a second

function setup() {
  createCanvas(windowWidth, windowHeight);
  cx = width / 2;
  cy = height / 2;
  sz = width / 5;
  rectMode(CENTER);
  frameRate(FR);
  background(0);
}

function keyPressed() {
  if (keyCode == '32') loop = !loop;
  if (loop) loop();
  else noLoop();
}

function draw() {
  background(0, 2);
  fill(255);
  noStroke();

  // Recent change normalized by change over time
  let avgs = calc();
  console.log(avgs);
  let avg_d = avgs.avg_d;
  let avg_c = avgs.avg_c;

  let _cd = avg_d > avg_c ? avg_d / avg_c : avg_c / avg_d;
  let cd = floor(_cd);
  if (_cd) {
    fill(cd > TH ? 'red' : 'white');
    rect(0, y, _cd * 10, 1);
  }

  // Display speed
  let d = ds.slice(-1);
  rect(width - d, y, 10, 1);
  stroke("red");
  line(width - M, 0, width - M, height);
  noStroke();

  // Erase change feedback
  fill(0);
  rect(cx, cy, sz);

  // Should we follow?
  let now = millis(); // Debounce 
  if (cd > TH && now - then > 1000) {
    follow = random(1) > 0.8;
    fill('red');
    noStroke();
    rect(mouseX, mouseY, 5, 5);
    textSize(24);
    text(cd, mouseX, mouseY);
    // Store timestamp
    then = now;
  }


  // Move down
  y++;
  y %= height;


  if (follow) {
    aspeed = avg_c;
    //console.log(nfs(aspeed, 0, 2));    
  }

  a += aspeed * adir;
  if (a < 0 || a > 255) adir *= -1;

  fill(255, a);
  noStroke();
  rect(cx, cy, sz);

  // Text labels
  noStroke();
  fill(0);
  rect(cx, 0, width, 60);
  fill(255);
  textAlign(LEFT, TOP);
  text("recent/older avg", 10, 0);
  textAlign(RIGHT, TOP);
  text("acc", width - 10, 0);

}


// Calculate speed: recent average (10f) over older average (50f)
function calc() {

  // Calculate distance traveled (speed)
  let d = dist(mouseX, mouseY, pmouseX, pmouseY);

  // Update
  d = floor(d);
  ds.push(d);
  if (ds.length > D_DUR) {
    cs.push(ds.shift());
  }

  // New now average
  let d_sum = 0;
  for (let d of ds) d_sum += d;
  let avg_d = d_sum / ds.length;

  // New trend average
  let c_sum = 0;
  for (let c of cs) c_sum += c;
  let avg_c = c_sum / cs.length;
  if (cs.length > C_DUR) cs.shift();

  console.log("!", D_DUR);
  return { avg_d: avg_d, avg_c: avg_c }
}
