export class Tracker {

  constructor(id, historySize = 180) {
    this.id = id;
    this.historySize = historySize;
    this.history = [];
  }

  get current() {
    return this.history[this.history.length - 1] || null;
  }

  get previous() {
    return this.history[this.history.length - 2] || this.current;
  }

  // TODO: handle lost trackers. Record the arrival time here and add isStale(), so a tracker that stops
  // updating is flagged and kept, not frozen forever. Clear the history when it returns after a gap.
  update(pos, raw, ts) {
    this.history.push({ x: pos.x, y: pos.y, z: pos.z, ts: ts, raw: raw });
    
    if (this.history.length > this.historySize) {
        this.history.shift();
    }
  }

  clear() {
    this.history = [];
  }

  getPosition() {
    return this.current;
  }
}
