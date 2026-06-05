let a = 0;
let aspeed = 1;
let adir = 1;

function setup() {
  createCanvas(windowWidth, windowHeight);
  cx = width / 2;
  cy = height / 2;
  sz = width / 5;
  rectMode(CENTER);
  background(0);
}

function keyPressed() {
  if (keyCode == '32') loop = !loop;
  if (loop) loop();
  else noLoop();
}

function draw() {
  background(0);

  // Breathe
  a += aspeed * adir;
  if(a < 0 || a > 255) adir *= -1;

  noStroke();
  fill(255, a);
  rect(cx, cy, sz);
}

function keyPressed() {
  switch(keyCode) {
    case RIGHT_ARROW:
      aspeed += 0.5;
      break;
    case LEFT_ARROW:
      aspeed -= 0.5;
      break;
    case UP_ARROW:
      aspeed+=10;
      break;
    case DOWN_ARROW:
      aspeed-=10;
      break;
  }

  aspeed = constrain(aspeed, 0, 255);
  console.log('aspeed: ', aspeed);
}



