// socket.io is loaded here, not at the top of the file, so importing this module works without the socket server
export async function connectSocket(store, port = 8001) {
  const { io } = await import('/socket.io/socket.io.esm.min.js');
  const socket = io(location.protocol + '//' + location.hostname + ':' + port);
  
  socket.on('connect', () => {
    console.log("Tracker connected: ", socket.id);
  });

  socket.on('disconnect', () => {
    console.log("Tracker disconnected: ", socket.id);
  });

  socket.on('trackers', (message) => store.update(message));
  return socket;
}
