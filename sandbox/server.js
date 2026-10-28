// Saving data
const fs = require('fs');
const readFile = fs.promises.readFile;
let record = false;
let live = true;
let sd = 0;

// Async function get saved data
async function getJsonData(filePath) {
  try {
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON:', error);
  }
}

// Create server
const PORT = process.env.PORT || 8001;

// Get SSL stuff
// const fs = require('fs');
// const key = fs.readFileSync('./key.pem');
// const cert = fs.readFileSync('./cert.pem');

// App
const express = require('express');
const app = express();

// Tell server where to look for files
app.use(express.static('./'));

// Save the VIVE calibration sent by the grid_vive_calibration sketch into config/.
// Each save gets its own timestamped file, so earlier calibrations are never overwritten.
app.post('/config/grid_vive_calibration', express.json(), function (req, res) {
  const config = req.body;
  if (!config || !config.origin || !config.xPoint || !config.zPoint) {
    res.status(400).json({ error: 'Expected origin, xPoint and zPoint.' });
    return;
  }

  // Local time, without characters Windows does not allow in file names, e.g. 2026-10-28_15-30-05
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + '_' + pad(now.getHours()) + '-' + pad(now.getMinutes()) + '-' + pad(now.getSeconds());

  const saved = { savedAt: now.toISOString(), ...config };
  const file = 'config/grid_vive_calibration_' + stamp + '.json';

  fs.mkdir('config', { recursive: true }, (err) => {
    if (err) {
      console.error("An error occurred while creating the config folder:", err);
      res.status(500).json({ error: err.message });
      return;
    }

    fs.writeFile(file, JSON.stringify(saved, null, 2) + '\n', 'utf8', (err) => {
      if (err) {
        console.error("An error occurred while writing the calibration:", err);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log("VIVE calibration saved to " + file);
      res.json({ saved: file });
    });
  });
});

// Make a web application server!
// let server = require('https').createServer({
//   key: key,
//   cert: cert
// }, app).listen(PORT, function() {
//   console.log('Server listening at port: ', PORT);
// });

let server = require('http').createServer(app).listen(PORT, function () {
  console.log('Server listening at port: ', PORT);
});

// Create socket server
let io = require('socket.io')(server);
require('../nir-serving/relay')(app, io, express);

const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://10.0.0.254:1883");

client.on("connect", () => {
  client.subscribe("tags", (err) => {
    if (!err) {
      client.publish("tags", "Hello mqtt");
    }
  });
});


client.on("message", (topic, message) => {
  // message is Buffer

  try {
    let data = JSON.parse(message.toString());
    //console.log(topic, data[0]);
    if(live) io.emit("pozyx", data[0]);


    // Don't do anything if not saving
    if (!record) return;

    // Use null and 2 as arguments for JSON.stringify to create human-readable formatted JSON
    const jsonData = JSON.stringify(data[0], null, 2) + ',';

    fs.appendFile('data/pozyx.json', jsonData, 'utf8', (err) => {
      if (err) {
        console.error("An error occurred while writing the file:", err);
        return;
      }
      console.log("JSON file has been saved.");
    });
  }
  catch (e) {
    console.log('Whoops, no data.');
  }
  //client.end();
});

// Socket connections
io.on('connection', function (socket) {
  console.log('Connected: ', socket.id);

  socket.on('start', function () {
    // Don't do anything if getting live data
    if (live) return;

    // Getting recorded data
    getJsonData('data/pozyx.json')
      .then((record) => {
        console.log("length", record.length);

        // Stream recorded data
        sendData(record, 0, record[0].timestamp);
      })
      .catch(error => console.error(error));

  });

  // Handle Vive data from TD plugin
  // Note: this will be thrown away, when we move to python server, as we will decicde the output format.
  socket.on("vive", ({channels} = {}) => {
    if (!channels) return;

    const data = { ts: Date.now() / 1000, trackers: parseTrackers(channels) };
    io.emit("trackers", data);
  })
});

// TD channel name -> unified field name. Anything not listed keeps its name.
const VIVE_FIELDS = { tx: 'x', ty: 'y', tz: 'z' };

// Group flat "id:channel" keys into one object per tracker
function parseTrackers(channels) {
  let trackers = {};
  for (const [key, value] of Object.entries(channels)) {
    const [id, channel] = key.split(":");

    if (!(id in trackers)) {
      trackers[id] = { id: id };
    }

    trackers[id][VIVE_FIELDS[channel] || channel] = value;
  }
  return Object.values(trackers);
}

function sendData(record, r, pts) {
  console.log('record', r, record.length);
  let data = record[r];
  let ts = data.timestamp;
  let delay = ts - pts;
  console.log('delay', delay);
  setTimeout(() => {
    io.emit("pozyx", data);
    r++;
    r %= record.length;
    sendData(record, r, ts);
  }, delay * 1000)
}