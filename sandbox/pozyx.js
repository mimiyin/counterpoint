console.log("POZYX code");

// Screen size
const WIDTH = 3840;
const HEIGHT = 4320;

// Auto-pilot
let pozyx_on = true;

// Sockets
let socket = io();
socket.on('connect', function () {
  console.log("HEY, I'VE CONNECTED: ", socket.id);
});

// pozyx
let tags = {};

const XMULT = .375;
const YMULT = .375;
const X_OFF = 1250;
const Y_OFF = -100;


// Listen for data coming from the server
function pozyx() {
  socket.on('pozyx', function (message) {
    if (!pozyx_on) return;
    //return;
    // Log the data
    //console.log('Received message: ', message.data);
    // Draw a circle at the y-position of the other user
    let tag = message;
    let data = tag.data;
    let id = tag.tagId;
    let ts = tag.ts;

    if (data) {
      if (data.coordinates) {
        let x = data.coordinates.x;
        let y = data.coordinates.y;
        tags[id] = calc(x, y);
        tags[id].a = data.tagData.accelerometer;
      }
    }
  });
}

// Map poxyz to projection
function calc(x, y) {

  // Translate
  x += X_OFF;
  y += Y_OFF;

  // Scale
  x *= XMULT;
  y *= YMULT;

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

function init_movers(count) {
  if (pozyx_on) return;

  // Get current ts
  let ts = Date.now();

  for (let c = 0; c < count; c++) {
    // Set x,y location of mover
    let x = count > 1 ? random(width) : mouseX;
    let y = count > 1 ? random(height) : mouseY;
    
    // Create tag obj
    tags[ts + '-' + c] = { x: x, y: y, ts: ts }
  }
}

function start() {
  socket.emit('start');
}

function record() {
  socket.emit('record');
}

function live() {
  socket.emit('live');
}