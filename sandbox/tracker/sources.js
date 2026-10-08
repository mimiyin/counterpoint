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

export function connectFake(store, getTrackers, rate = 60) {
  const timer = setInterval(() => {
    store.update({ ts: Date.now() / 1000, trackers: getTrackers() });
  }, 1000 / rate);

  return () => clearInterval(timer);
}

export function fakeRoomTracker(getCanvasPos) {
  const metresPerPixel = 0.002;
  const jitter = () => (Math.random() * 2 - 1) * 0.0003;

  return function () {
    const pos = getCanvasPos();

    return [{
      id: 'fake1',
      x: pos.x * metresPerPixel + jitter(),
      y: 0.03 + jitter(),
      z: pos.y * metresPerPixel + jitter(),
    }];
  };
}
