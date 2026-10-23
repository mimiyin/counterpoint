// No model, video, person IDs or history here. Only Socket.IO + p5 rendering.
const DIAMETER = 26;
let people = [];
let roi = { width: 1550, height: 1900 }; // fallback for old AXIS demo
let lastUpdate = -Infinity;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  const socket = io(); // existing sandbox/server.js:8001
  socket.on('nir', (data) => {
    if (!data || !Array.isArray(data.people)) return;
    people = data.people; // complete snapshot, no persistent IDs
    if (data.roi && data.roi.width > 0 && data.roi.height > 0) roi = data.roi;
    lastUpdate = performance.now();
  });
  socket.on('disconnect', () => { people = []; });
}

function draw() {
  background(0);
  // The CPU model may take ~3s/frame. Clear on disconnect or long absence.
  if (performance.now() - lastUpdate > 8000) people = [];
  const scale = min(width / roi.width, height / roi.height);
  const x0 = (width - roi.width * scale) / 2;
  const y0 = (height - roi.height * scale) / 2;
  fill(255);
  for (const p of people) {
    circle(x0 + p.x * roi.width * scale, y0 + p.y * roi.height * scale, DIAMETER);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
