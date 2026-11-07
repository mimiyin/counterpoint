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

export function fakeRoomTracker(getCanvasPos, id = 'fake1') {
  const metresPerPixel = 0.002;
  const jitter = () => (Math.random() * 2 - 1) * 0.0003;

  return function () {
    const pos = getCanvasPos();

    return [{
      id: id,
      x: pos.x * metresPerPixel + jitter(),
      y: 0.03 + jitter(),
      z: pos.y * metresPerPixel + jitter(),
    }];
  };
}

// A fake tracker moved with the arrow keys, in tracker units. It starts at (0, 0) on the floor.
// Hold an arrow key to move it: left and right change x, up and down change z.
// speed: tracker units per second
export function keyboardRoomTracker(speed = 0.5, id = 'fake1') {
  const pos = { x: 0, z: 0 };
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const held = new Set();

  window.addEventListener('keydown', (event) => {
    if (!(event.key in moves)) return;
    held.add(event.key);
    event.preventDefault(); // arrow keys would scroll the page
  });
  window.addEventListener('keyup', (event) => held.delete(event.key));
  window.addEventListener('blur', () => held.clear()); // a key released in another window is never seen

  let last = performance.now();

  return function () {
    const now = performance.now();
    const seconds = (now - last) / 1000;
    last = now;

    for (const key of held) {
      pos.x += moves[key][0] * speed * seconds;
      pos.z += moves[key][1] * speed * seconds;
    }

    return [{ id: id, x: pos.x, y: 0, z: pos.z }];
  };
}
