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

  getStats(windowSize, useRaw = false) {
    if (windowSize < 1 || this.history.length < windowSize) return null;

    const samples = this.history.slice(-windowSize);
    const stats = {};

    for (const axis of ['x', 'y', 'z']) {
      const values = samples.map((sample) => (useRaw ? sample.raw : sample)[axis]);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;

      stats[axis] = {
        mean: mean,
        deviation: Math.sqrt(variance),
        range: Math.max(...values) - Math.min(...values),
      };
    }

    return stats;
  }

  getPosByAvg(windowSize, useRaw = false, withStats = false) {
    const stats = this.getStats(windowSize, useRaw);
    if (!stats) return null;

    const pos = { x: stats.x.mean, y: stats.y.mean, z: stats.z.mean };

    if (withStats) {
      pos.deviation = { x: stats.x.deviation, y: stats.y.deviation, z: stats.z.deviation };
      pos.range = { x: stats.x.range, y: stats.y.range, z: stats.z.range };
    }

    return pos;
  }
}
