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

const XMULT = .375;
const YMULT = .375;
const X_OFF = 1250;
const Y_OFF = 0;


// Listen for data coming from the server
function pozyx() {
  socket.on('pozyx', function (message) {
    if(!pozyx_on) return;
    //return;
    // Log the data
    //nsole.log('Received message: ', message);
    // Draw a circle at the y-position of the other user
    let tag = message[0];
    let data = tag.data;
    let id = tag.tagId;
    let ts = tag.ts;
    
    if (data) {
      if (data.coordinates) {
        let x = data.coordinates.x;
        let y = data.coordinates.y;
        tags[id] = calc(x, y);
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
  x*=XMULT;
  y*=YMULT;
  
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

function init_movers(num) {
  if(pozyx_on) return;

  // Get current ts
  let ts = Date.now();

  for(let n = 0; n < num; n++) {
    tags[ts + '-' + n] = { x : mouseX, y : mouseY, ts : ts }
  }
}

