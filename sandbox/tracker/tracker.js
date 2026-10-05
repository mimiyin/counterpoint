class TrackerStore {

  constructor(transformer, port = 8001) {
    this.transformer = transformer;
    this.trackers = {};

    this.socket = io(location.protocol + '//' + location.hostname + ':' + port);
    this.socket.on('connect', () => {
      console.log("Tracker connected: ", this.socket.id);
    });
    this.socket.on('trackers', (message) => this.update(message));
  }

  update(message) {
    for (const raw of message.trackers) {
      let pos = this.transformer(raw);
      let prev = this.trackers[raw.id];

      this.trackers[raw.id] = {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        px: prev ? prev.x : pos.x,
        py: prev ? prev.y : pos.y,
        pz: prev ? prev.z : pos.z,
      };
    }
  }

  getTrackers() {
    return this.trackers;
  }
}
