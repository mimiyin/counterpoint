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
// Mapping mm to pixels
const XMULT = .375;
const YMULT = .375;
const X_OFF = 1250;
const Y_OFF = -100;

// Distance to Acceleration TH for filtering noisy pos data
const D2A_TH = 2;


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
        
        // Get latest data
        let pos = calc_pos(x, y);
        let accs = calc_acc(data.tagData.accelerometer);

        // Load previous data or create new
        let data = tags[id] || { x : pos.x, y : posy }

        // Update data
        data.px = data.x;
        data.px = data.y;
        data.x = pos.x;
        data.y = pos.y;
        data.accs = accs;

        // Calc distance travelled
        let d = dist(data.px, data.py, data.x, data.y);
        // Calc ratio of distance to acceleration data
        let d2a = d / calc_acc(accs);
        // If there was too much movement, discard the data
        if(d2a > D2A_TH) {
          // Only update acceleration data
          tags[id].accs = accs;
          return;
        }

        // Otherwise, update it
        tags[id] = data;
      }
    }
  });
}

function calc_acc(accs) {
  const XY = 2;
  let sum = 0;
  for(let acc of accs) {
    for(a = 0; a < XY; a++) {
      let xy = acc[a];
      sum += abs(xy);
    }
  }
  return sum / (accs.length * XY);
}

// Map poxyz to projection
function calc_pos(x, y) {

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