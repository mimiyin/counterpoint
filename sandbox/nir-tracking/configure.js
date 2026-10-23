// Edits nir-serving/config.json through the relay (GET/PUT /nir/config). serve.py re-reads that
// file while running. No detection happens here. Geometry matches serve.py: rotate the WHOLE
// frame clockwise by `rotate` degrees about its centre, then crop with `roi`.
const FALLBACK = {
  source: 'http://192.168.0.90/axis-cgi/mjpg/video.cgi?resolution=2992x2992&fps=4',
  rotate: 0, roi: [598, 598, 2394, 2394], fps: 4, confidence: 0.25, device: 'auto',
};
const $ = (id) => document.getElementById(id);
const canvas = $('view');
const ctx = canvas.getContext('2d');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// UI state. Crop is kept as percentages of the (rotated) frame, which has the source's size.
const state = {
  source: FALLBACK.source, rotate: 0, w: 60, h: 60, cx: 50, cy: 50, lock: true,
  fps: 4, confidence: 0.25, device: 'auto', grid: true, dots: true,
};
let savedJson = '';   // last config known to be on disk
let loaded = false;
let people = [];
let lastNir = -Infinity;

const img = new Image();
img.onerror = () => { $('status').textContent = 'stream error: check URL, network, camera'; };
let streamTimer = null;
function loadStream() {
  clearTimeout(streamTimer);
  streamTimer = setTimeout(() => {
    img.src = state.source + (state.source.includes('?') ? '&' : '?') + '_=' + Date.now();
  }, 300);
}

// ---- frame size / roi <-> percent ----
function frameSize() {
  if (img.naturalWidth) return { w: img.naturalWidth, h: img.naturalHeight };
  const m = /resolution=(\d+)x(\d+)/.exec(state.source);
  return m ? { w: +m[1], h: +m[2] } : { w: 2992, h: 2992 };
}
function roiPixels() {
  const f = frameSize();
  return [
    Math.round(f.w * (state.cx - state.w / 2) / 100),
    Math.round(f.h * (state.cy - state.h / 2) / 100),
    Math.round(f.w * (state.cx + state.w / 2) / 100),
    Math.round(f.h * (state.cy + state.h / 2) / 100),
  ];
}
function roiOutside() {
  const f = frameSize();
  const [x0, y0, x1, y1] = roiPixels();
  return x0 < 0 || y0 < 0 || x1 > f.w || y1 > f.h;
}
function currentConfig() {
  return {
    source: state.source, rotate: state.rotate, roi: roiPixels(),
    fps: state.fps, confidence: state.confidence, device: state.device,
  };
}
function applyConfig(c) {
  state.source = c.source;
  state.rotate = c.rotate;
  state.fps = c.fps;
  state.confidence = c.confidence;
  state.device = c.device;
  const f = (() => {
    const m = /resolution=(\d+)x(\d+)/.exec(c.source);
    return m ? { w: +m[1], h: +m[2] } : { w: 2992, h: 2992 };
  })();
  const [x0, y0, x1, y1] = c.roi;
  state.w = (x1 - x0) / f.w * 100;
  state.h = (y1 - y0) / f.h * 100;
  state.cx = (x0 + x1) / 2 / f.w * 100;
  state.cy = (y0 + y1) / 2 / f.h * 100;
  state.lock = Math.abs(state.w - state.h) < 0.05;
}

// ---- controls ----
const pairs = { rotate: 'rotateN', w: 'wN', h: 'hN', cx: 'cxN', cy: 'cyN', fps: 'fpsN', confidence: 'confidenceN' };
const limits = { rotate: [-180, 180], w: [5, 100], h: [5, 100], cx: [0, 100], cy: [0, 100], fps: [1, 60], confidence: [0.05, 1] };

function setValue(key, value) {
  value = Number(value);
  if (!Number.isFinite(value)) return;
  state[key] = clamp(value, ...limits[key]);
  if (state.lock && key === 'w') state.h = state.w;
  if (state.lock && key === 'h') state.w = state.h;
  if (key === 'fps') {
    state.fps = Math.round(state.fps);
    if (/([?&])fps=\d+/.test(state.source)) {
      state.source = state.source.replace(/([?&])fps=\d+/, `$1fps=${state.fps}`);
      loadStream();
    }
  }
  sync();
}

const show = (v) => Number(Number(v).toFixed(2));

function sync() {
  for (const [k, n] of Object.entries(pairs)) {
    $(k).value = state[k];
    if (document.activeElement !== $(n)) $(n).value = show(state[k]);
  }
  $('lock').checked = state.lock;
  $('grid').checked = state.grid;
  $('dots').checked = state.dots;
  $('device').value = state.device;
  if (document.activeElement !== $('source')) $('source').value = state.source;
  $('ccw').textContent = `= ${show(-state.rotate)}° counter-clockwise`;

  const [x0, y0, x1, y1] = roiPixels();
  const f = frameSize();
  $('roiInfo').textContent = `crop ${x1 - x0} x ${y1 - y0} px  [${x0}, ${y0}, ${x1}, ${y1}]  of ${f.w} x ${f.h}` +
    (roiOutside() ? '  OUTSIDE FRAME: reduce size or move the centre' : '');

  const dirty = loaded && JSON.stringify(currentConfig()) !== savedJson;
  $('save').classList.toggle('dirty', dirty);
  $('save').disabled = !loaded || !dirty || roiOutside();
  $('revert').disabled = !dirty;
  if (dirty && !$('saveState').classList.contains('err')) $('saveState').textContent = 'unsaved changes';
}

for (const [k, n] of Object.entries(pairs)) {
  $(k).addEventListener('input', (e) => { $('saveState').classList.remove('err'); setValue(k, e.target.value); });
  $(n).addEventListener('input', (e) => { $('saveState').classList.remove('err'); setValue(k, e.target.value); });
  $(n).addEventListener('blur', sync);
}
document.querySelectorAll('[data-rot]').forEach((b) => b.addEventListener('click', () => {
  const d = Number(b.dataset.rot);
  if (d === 0) return setValue('rotate', 0);
  if (Math.abs(d) === 1) return setValue('rotate', state.rotate + d);
  if (d === 180) return setValue('rotate', state.rotate >= 0 ? state.rotate - 180 : state.rotate + 180);
  setValue('rotate', ((state.rotate + d + 540) % 360) - 180);
}));
$('lock').addEventListener('change', (e) => { state.lock = e.target.checked; if (state.lock) state.h = state.w; sync(); });
$('grid').addEventListener('change', (e) => { state.grid = e.target.checked; sync(); });
$('dots').addEventListener('change', (e) => { state.dots = e.target.checked; sync(); });
$('device').addEventListener('change', (e) => { state.device = e.target.value; sync(); });
$('source').addEventListener('input', (e) => { state.source = e.target.value.trim(); sync(); });
$('source').addEventListener('change', () => { loadStream(); sync(); });

// ---- save / revert ----
async function save() {
  const config = currentConfig();
  $('saveState').classList.remove('err');
  $('saveState').textContent = 'saving…';
  try {
    const res = await fetch('/nir/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    savedJson = JSON.stringify(config);
    $('saveState').textContent = 'saved ' + new Date().toLocaleTimeString();
  } catch (e) {
    $('saveState').classList.add('err');
    $('saveState').textContent = 'save failed: ' + e.message;
  }
  sync();
}
function revert() {
  applyConfig(JSON.parse(savedJson));
  $('saveState').classList.remove('err');
  $('saveState').textContent = '';
  loadStream();
  sync();
}
$('save').addEventListener('click', save);
$('revert').addEventListener('click', revert);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (!$('save').disabled) save(); }
});
window.addEventListener('beforeunload', (e) => {
  if (loaded && JSON.stringify(currentConfig()) !== savedJson) e.preventDefault();
});

async function loadConfig() {
  let config = FALLBACK;
  try {
    const res = await fetch('/nir/config');
    if (res.ok) config = await res.json();
    else if (res.status === 403) $('saveState').textContent = 'config is only available from the server machine (403)';
    else if (res.status === 404) $('saveState').textContent = 'no config.json yet: showing defaults';
  } catch (e) {
    $('saveState').textContent = 'could not load config: ' + e.message;
  }
  applyConfig(config);
  savedJson = JSON.stringify(currentConfig());
  loaded = true;
  loadStream();
  sync();
}

// ---- geometry / drawing ----
// The view is a square showing the whole (rotated) frame, fit inside the canvas.
let box = { x: 0, y: 0, size: 100 };
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const size = Math.min(canvas.clientWidth, canvas.clientHeight) - 16;
  box = { x: (canvas.clientWidth - size) / 2, y: (canvas.clientHeight - size) / 2, size };
}
window.addEventListener('resize', resize);

function cropRect() {
  const { x, y, size } = box;
  return {
    x: x + size * (state.cx - state.w / 2) / 100,
    y: y + size * (state.cy - state.h / 2) / 100,
    w: size * state.w / 100,
    h: size * state.h / 100,
  };
}

function draw() {
  requestAnimationFrame(draw);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  const { x, y, size } = box;

  // area outside the source after rotation stays black, same as serve.py
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, size, size);

  if (img.naturalWidth) { // an endless MJPEG <img> never reports complete, so test naturalWidth
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(state.rotate * Math.PI / 180); // canvas positive = clockwise on screen
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    $('status').textContent = `streaming ${img.naturalWidth}x${img.naturalHeight}`;
  }

  // dim everything outside the crop
  const c = cropRect();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.rect(c.x, c.y, c.w, c.h);
  ctx.fill('evenodd');
  ctx.restore();

  // frame centre marker (rotation pivot)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + size / 2 - 8, y + size / 2); ctx.lineTo(x + size / 2 + 8, y + size / 2);
  ctx.moveTo(x + size / 2, y + size / 2 - 8); ctx.lineTo(x + size / 2, y + size / 2 + 8);
  ctx.stroke();

  // crop rectangle
  ctx.strokeStyle = roiOutside() ? '#f44' : '#3f3';
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x, c.y, c.w, c.h);
  if (state.grid) {
    ctx.strokeStyle = 'rgba(80,255,80,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(c.x + c.w * i / 3, c.y); ctx.lineTo(c.x + c.w * i / 3, c.y + c.h);
      ctx.moveTo(c.x, c.y + c.h * i / 3); ctx.lineTo(c.x + c.w, c.y + c.h * i / 3);
    }
    ctx.stroke();
  }

  // live detections from serve.py (relative to the SAVED crop; shown inside the current box)
  const live = performance.now() - lastNir < 3000;
  $('count').textContent = live ? `(${people.length})` : '(none)';
  if (state.dots && live) {
    ctx.fillStyle = '#fff';
    for (const p of people) {
      ctx.beginPath();
      ctx.arc(c.x + p.x * c.w, c.y + p.y * c.h, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#3f3';
  ctx.font = '12px system-ui';
  ctx.fillText('top of rotated frame', x + 6, y + 14);
}

// ---- drag crop ----
let dragging = null;
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const c = cropRect();
  if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) {
    dragging = { px, py, cx: state.cx, cy: state.cy };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  const dx = (e.clientX - r.left - dragging.px) / box.size * 100;
  const dy = (e.clientY - r.top - dragging.py) / box.size * 100;
  state.cx = clamp(Math.round((dragging.cx + dx) * 2) / 2, 0, 100);
  state.cy = clamp(Math.round((dragging.cy + dy) * 2) / 2, 0, 100);
  sync();
});
canvas.addEventListener('pointerup', () => { dragging = null; });

// ---- live detections (read-only) ----
const socket = io();
socket.on('nir', (d) => {
  if (!d || !Array.isArray(d.people)) return;
  people = d.people;
  lastNir = performance.now();
});

resize();
sync();
loadConfig();
requestAnimationFrame(draw);
