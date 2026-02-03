let cx, cw, sz;
let a = 0;
let aspeed = 0.1;
let adir = 1;
let d = 1;
let ds = [];
let cs = [];
let avg_d = 1;
let avg_c = 1;
let cd = 0;
let y = 0;

let follow = false;

const TH = 0.34;
const M = TH * 100;

function setup() {
  createCanvas(windowWidth, windowHeight);
  cx = width / 2;
  cy = height / 2;
  sz = width / 5;
  rectMode(CENTER);
  frameRate(30);
  background(0);
}

function draw() {
  background(0, 2);
  fill(255);
  noStroke();
  //if (frameCount % 6 == 0) {
  let _cd = calc();
  if(_cd) rect(0, y, _cd * 10, 1);
  y++;
  y %= height;

  // Calculate normalized acc
  let ncd = abs(cd - _cd) / cd;
  console.log(ncd);

  if (ncd) {
    let xccd = ncd * 100;
    rect(width - xccd, y, xccd, 1);
    stroke("red");
    line(width - M, 0, width - M, height);
    noStroke();
  }

  // Erase change feedback
  fill(0);
  rect(cx, cy, sz);
  if (ncd >= TH && ncd !== Infinity && ncd !== isNaN) {
    //fill("red");
    //rect(cx, cy, sz);
    //aspeed *= 10;
    // Should I follow or not?
    follow = random(1) > 0.8;
    //console.log('follow?', follow);
    fill('red');
    noStroke();
    rect(mouseX, mouseY, 5, 5);
  }
  
  if(follow) {
    aspeed = avg_c;
    //console.log(nfs(aspeed, 0, 2));    
  }

  a += aspeed * adir;
  if (a < 0 || a > 255) adir *= -1;

  fill(255, a);
  noStroke();
  rect(cx, cy, sz);
  
  // Update for next frame
  cd = _cd;

  // Text labels
  noStroke();
  fill(0);
  rect(cx, 0, width, 60);
  fill(255);
  textAlign(LEFT, TOP);
  text("recent/older avg", 10, 0);
  textAlign(RIGHT, TOP);
  text("acc", width-10, 0);

}


// Calculate speed: recent average (10f) over older average (50f)
function calc() {
  let d = dist(mouseX, mouseY, pmouseX, pmouseY);

  // Update
  ds.push(d);
  if (ds.length > 10) {
    cs.push(ds.shift());
  }

  // New now average
  let d_sum = 0;
  for (let d of ds) d_sum += d;
  avg_d = d_sum / ds.length;

  // New trend average
  let c_sum = 0;
  for (let c of cs) c_sum += c;
  avg_c = c_sum / cs.length;
  if (cs.length > 50) cs.shift();

  // console.log("!", nfs(avg_d/avg_c, 0, 2));
  return avg_d / avg_c;
}
