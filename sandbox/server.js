// Saving data
const fs = require('fs');
const readFile = fs.promises.readFile;
let save = true;
let live = true;
let idx = Date.now();
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
    //console.log(topic, data);
    io.emit("pozyx", data);

    // Don't do anything if not saving
    if (!save) return;

    // Use null and 2 as arguments for JSON.stringify to create human-readable formatted JSON
    const jsonData = JSON.stringify(data, null, 2);

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
  
  // Don't do anything if getting live data
  if(live) return;

  // Getting saved data
  getJsonData('data/pozyx-' + idx + '.json')
    .then((result) => {
      console.log(result);
      // Stream saved data
      setInterval(() => {
        io.emit("pozyx", savedData[sd]);
        sd++;
        sd % sd.length;
      }, 1000)

    })
    .catch(error => console.error(error));

});

