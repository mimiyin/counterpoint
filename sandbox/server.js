// Create server
const PORT = process.env.PORT || 8001;

// Get SSL stuff
// const fs = require('fs');
// const key = fs.readFileSync('./key.pem');
// const cert = fs.readFileSync('./cert.pem');

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

let server = require('http').createServer(app).listen(PORT, function() {
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
  }
  catch(e) {
    console.log('Whoops, no data.');
  }
  //client.end();
});
