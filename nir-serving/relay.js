// The existing Counterpoint server owns the Socket.IO connection.
// Add to sandbox/server.js after io is created:
// require('../nir-serving/relay')(app, io, express);
// express is passed in because it is installed in sandbox/node_modules,
// which is not on the module search path of this directory.
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const isLoopback = (req) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Same rules as validate_config() in serve.py. Returns a clean object or throws.
function cleanConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('config must be an object');
  const out = {};
  if (typeof raw.source !== 'string' || !raw.source.trim()) throw new Error('source');
  out.source = raw.source.trim();
  if (!isNum(raw.rotate) || raw.rotate < -360 || raw.rotate > 360) throw new Error('rotate');
  out.rotate = raw.rotate;
  const r = raw.roi;
  if (!Array.isArray(r) || r.length !== 4 || !r.every(Number.isInteger) ||
      r[2] <= r[0] || r[3] <= r[1]) throw new Error('roi');
  out.roi = r;
  if (!isNum(raw.fps) || raw.fps <= 0 || raw.fps > 60) throw new Error('fps');
  out.fps = raw.fps;
  if (!isNum(raw.confidence) || raw.confidence <= 0 || raw.confidence > 1) throw new Error('confidence');
  out.confidence = raw.confidence;
  if (!['auto', 'cpu', 'cuda'].includes(raw.device)) throw new Error('device');
  out.device = raw.device;
  return out;
}

module.exports = function installNirRelay(app, io, express) {
  // Config shared by serve.py (reads it, reloads on change) and the configure page (edits it).
  // Loopback only: it can contain the camera URL and it changes what serve.py does.
  app.get('/nir/config', (req, res) => {
    if (!isLoopback(req)) return res.sendStatus(403);
    fs.readFile(CONFIG_PATH, 'utf8', (err, text) => {
      if (err) return res.sendStatus(err.code === 'ENOENT' ? 404 : 500);
      res.type('json').send(text);
    });
  });

  app.put('/nir/config', express.json({ limit: '8kb' }), (req, res) => {
    if (!isLoopback(req)) return res.sendStatus(403);
    let config;
    try {
      config = cleanConfig(req.body);
    } catch (e) {
      return res.status(400).json({ error: `invalid ${e.message}` });
    }
    // Write to a temp file then rename, so serve.py never reads a half-written file.
    const tmp = CONFIG_PATH + '.tmp';
    fs.writeFile(tmp, JSON.stringify(config, null, 2) + '\n', 'utf8', (err) => {
      if (err) return res.sendStatus(500);
      fs.rename(tmp, CONFIG_PATH, (err2) => res.sendStatus(err2 ? 500 : 204));
    });
  });

  app.post('/nir', express.json({ limit: '32kb' }), (req, res) => {
    // This PoC requires the producer on the SAME machine as Counterpoint.
    if (!isLoopback(req)) {
      return res.sendStatus(403);
    }
    const data = req.body;
    const roi = data && data.roi;
    if (!data || !Array.isArray(data.people) || data.people.length > 100 ||
        !data.people.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
          p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) ||
        !roi || !Number.isFinite(roi.width) || !Number.isFinite(roi.height) ||
        roi.width <= 0 || roi.height <= 0 || roi.width > 10000 || roi.height > 10000) {
      return res.sendStatus(400);
    }

    io.emit('nir', {
      ts: Date.now() / 1000,
      videoTime: Number.isFinite(data.videoTime) ? data.videoTime : null,
      roi: { width: roi.width, height: roi.height },
      count: data.people.length,
      people: data.people.map(p => ({ x: p.x, y: p.y })),
    });
    res.sendStatus(204);
  });
};
