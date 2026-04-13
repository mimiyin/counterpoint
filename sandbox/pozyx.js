console.log("POZYX code");

// Screen size
const WIDTH = 3840;
const HEIGHT = 4320;


// Auto-pilot
let pozyx_on = false;

// Sockets
let socket = io();
socket.on('connect', function () {
  console.log("HEY, I'VE CONNECTED: ", socket.id);
});

// pozyx
let tags = {};

const XMULT = 0.45;
const YMULT = 0.7;
const X_OFF = -2000;
const Y_OFF = 500;
const THETA = -Math.PI/5;


// Listen for data coming from the server
function pozyx() {
  socket.on('pozyx', function (message) {
    if(!pozyx_on) return;
    //return;
    // Log the data
    //console.log('Received message: ', message);
    // Draw a circle at the y-position of the other user
    let tag = message[0];
    let data = tag.data//;
    let id = tag.tagId;
    let ts = tag.ts;

    if (data) {
      if (data.coordinates) {
        let x = data.coordinates.x;
        let y = data.coordinates.y;
        if (id in tags) tags[id] = { x: x, y: y, ts: ts };
        //if (poxyz_on) {
          movers[id] = calc(x, y);
          console.log("xy", id, movers[id].x, movers[id].y);
        //}
      }
    }
  });
}

// Map poxyz to projection
function calc(x, y) {
  // Rotate
  x = x*cos(THETA) - y*sin(THETA);
  y = x*sin(THETA) + y*cos(THETA);
  // Scale
  x*=XMULT;
  y*=YMULT;
  // Translate
  x += width/2 + X_OFF;
  y += height/2 + Y_OFF;

  return { x: x, y: y }
}

// Turn pozyx on/off
function toggle_pozyx(key) {
  switch (key) {
    case 'p':
      pozyx_on = !pozyx_on;
      break;
  }
}

function init_movers() {
  for(let m = 0; m < 10; m++) {
    movers[m] = { x : random(width), y : random(height) };
  }
}

