// Sound source: https://freesound.org/people/ERH/sounds/43312/

let center = {};
let ping;
let counter = 0;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  center.x = width/2;
  center.y = height/2;

  ping = await loadSound('ping.m4a');
}

function draw() {
  let d = dist(center.x, center.y, mouseX, mouseY);
  let interval = floor(map(d, 0, center.x, 1, 180));

  counter++;
  if(counter % interval == 0) ping.play();

  console.log(interval);
}

function keyPressed() {
  ping.play();
}