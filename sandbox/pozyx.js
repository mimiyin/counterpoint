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
// Mapping mm to pixels
const XMULT = .375;
const YMULT = .375;
const X_OFF = 1250;
const Y_OFF = -100;

// Distance to Acceleration TH for filtering noisy pos data
const XYZ = 3;
const A2D_TH = 0;


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
        let accs = data.tagData.accelerometer;

        // Load previous data or create new
        //let tag = tags[id] || { x : pos.x, y : pos.y };
        //if(id in tags) console.log(tags[id]);

        // Update data
        let tag = {};
        tag.px = (id in tags) ? tags[id].x : pos.x;
        tag.py = (id in tags) ? tags[id].y : pos.y;
        tag.x = pos.x;
        tag.y = pos.y;
        tag.accs = accs;

        // Calc distance travelled
        let d = dist(tag.px, tag.py, tag.x, tag.y);

        // Calc ratio of distance to acceleration data
        let a2d = calc_acc(accs) / (d + 1) || 0;
        //if(a2d > 25) console.log('d2a', d, a2d)
        // If there was too much movement, discard the data
        // if(a2d > A2D_TH) {
        //   // Only update acceleration data
        //   if(id in tags) tags[id].accs = accs;
        //   return;
        // }

        tag.d = d;
        tag.sum = calc_acc(accs);
        if(tag.d > 0 && tag.sum < 500) tag.msg = "HA";
        else tag.msg = round(tag.d) + ' ' + round(tag.sum);

        tags[id] = tag;
        return;
        if(tag.d > 0 && tag.sum < 400) {
          tags[id].accs = accs;
          tags[id].msg = "HA:" + round(tag.d) + "x:" + round(tag.sum);
          console.log("REJECTED", round(tag.x), round(tags[id].x));
          return;
        }
        // Otherwise, update it
        else {
          tags[id] = tag;
          console.log('x', round(tag.x), round(tags[id].x));
        }
        //console.log(tags);
      }
    }
  });
}

function calc_acc(accs) {

  let sum = 0;
  for(let acc of accs) {
    for(a = 0; a < XYZ; a++) {
      let xyz = acc[a];
      //console.log(xyz);
      sum += abs(xyz);
    }
  }
  //console.log('sum', sum, accs.length * XYZ);
  return sum / (accs.length * XYZ);
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
