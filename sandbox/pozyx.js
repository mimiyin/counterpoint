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

        // Update data
        let tag = {};
        let exists = id in tags;
        tag.px = exists ? tags[id].x : pos.x;
        tag.py = exists ? tags[id].y : pos.y;
        tag.x = pos.x;
        tag.y = pos.y;
        let pkg = {};
        pkg.accs = accs;
        pkg.cum_accs = exists ? tags[id].acc.cum_accs : [];
        pkg.cum_accs.push(...pkg.accs);
        pkg.avg_acc = avg_acc(pkg.cum_accs);
        pkg.dev_acc = dev_acc(pkg.avg_acc, pkg.cum_accs);

        // Calc distance travelled
        pkg.d = dist(tag.px, tag.py, tag.x, tag.y);
        // Calc sum of accelerations
        pkg.sum = sum_acc(accs);

        // If there is movement and no acceleration, reject!
        if(pkg.d > 0 && pkg.sum < 400) pkg.msg = "\u{1F92A}";
        else pkg.msg = round(pkg.d) + ' ' + round(pkg.sum);

        // Assign pgk to tag
        tag.acc = pkg; 

        // Reject new positions
        if(pkg.msg == "\u{1F92A}") {
          tags[id].pkg = pkg;
          console.log("REJECTED", pkg.d, pkg.sum);
          return;
        }
        // Otherwise, update it
        else tags[id] = tag;          
      }
    }
  });
}

function dev_acc(avg, cum) {
  let dev = [0, 0, 0];
  for(let acc of cum) {
    for(let xyz in acc) {
      dev[xyz] += abs(acc[xyz] - avg[xyz]);
    }
  }
  return dev;
}


function avg_acc(cum) {
  let avg = [0, 0, 0];
  for(let acc of all) {
    for(let a in acc) {
      avg[a] += acc[a];
    }
  }
  for(let a in avg) {
    avg[a] /= all.length;
    noStroke();
    fill('purple');
    rect(a * w, 0, w/2, avg[a]);
  }
  return avg;
}

function sum_acc(accs) {
  let sum = 0;
  for(let acc of accs) {
    for(a = 0; a < XYZ; a++) {
      let xyz = acc[a];
      sum += abs(xyz);
    }
  }
  return sum;
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
