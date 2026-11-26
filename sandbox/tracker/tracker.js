const POSITION_AXES = ['x', 'y', 'z'];
const ROTATION_AXES = ['rx', 'ry', 'rz'];
const ROTATION_RANGE = { min: -180, max: 180 };
const ROTATION_PERIOD = ROTATION_RANGE.max - ROTATION_RANGE.min;

function hasRotation(reading) {
  return ROTATION_AXES.every((axis) => Number.isFinite(reading[axis]));
}

function wrapToRange(angle) {
  return ((angle - ROTATION_RANGE.min) % ROTATION_PERIOD + ROTATION_PERIOD) % ROTATION_PERIOD + ROTATION_RANGE.min;
}

// How far an angle is from another angle, the short way round (-period / 2 to period / 2)
// So 179 and -179 are 2 apart, not 358
function angleOffset(angle, fromAngle) {
  const half = ROTATION_PERIOD / 2;
  return ((angle - fromAngle + half) % ROTATION_PERIOD + ROTATION_PERIOD) % ROTATION_PERIOD - half;
}

// A tracker that has not updated for this milliseconds as lost
const STALE_AFTER = 500;

export class Tracker {

  constructor(id, historySize = 180) {
    this.id = id;
    this.historySize = historySize;
    this.history = [];
    this.lastSeen = null;
  }

  get current() {
    return this.history[this.history.length - 1] || null;
  }

  get previous() {
    return this.history[this.history.length - 2] || this.current;
  }

  isStale() {
    return this.lastSeen === null || performance.now() - this.lastSeen > STALE_AFTER;
  }

  update(pos, raw, ts) {
    if (this.isStale()) {
      this.clear();
    }

    this.lastSeen = performance.now();
    this.history.push({ x: pos.x, y: pos.y, z: pos.z, rx: raw.rx, ry: raw.ry, rz: raw.rz, ts: ts, raw: raw });

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
    const readings = samples.map((sample) => (useRaw ? sample.raw : sample));
    const stats = {};

    // TODO: remove condition if rotation data is always present.
    const axes = readings.every(hasRotation) ? [...POSITION_AXES, ...ROTATION_AXES] : POSITION_AXES;

    for (const axis of axes) {
      const isAngle = ROTATION_AXES.includes(axis);
      const firstValue = readings[0][axis];
      const values = readings.map((reading) => (isAngle ? angleOffset(reading[axis], firstValue) : reading[axis]));
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;

      stats[axis] = {
        mean: isAngle ? wrapToRange(firstValue + mean) : mean,
        deviation: Math.sqrt(variance),
        range: Math.max(...values) - Math.min(...values),
      };
    }

    return stats;
  }

  getPosByAvg(windowSize, useRaw = false, withStats = false) {
    const stats = this.getStats(windowSize, useRaw);
    return stats ? this.posFromStats(stats, withStats) : null;
  }

  getTransformationByAvg(windowSize, useRaw = false) {
    const stats = this.getStats(windowSize, useRaw);
    if (!stats) return null;

    const pos = this.posFromStats(stats, true);
    if (!stats.rx) return pos;

    const rot = this.rotFromStats(stats, true);

    return {
      ...pos, ...rot,
      deviation: { ...pos.deviation, ...rot.deviation },
      range: { ...pos.range, ...rot.range },
    };
  }

  posFromStats(stats, withStats) {
    const pos = { x: stats.x.mean, y: stats.y.mean, z: stats.z.mean };

    if (withStats) {
      pos.deviation = { x: stats.x.deviation, y: stats.y.deviation, z: stats.z.deviation };
      pos.range = { x: stats.x.range, y: stats.y.range, z: stats.z.range };
    }

    return pos;
  }

  rotFromStats(stats, withStats) {
    const rot = { rx: stats.rx.mean, ry: stats.ry.mean, rz: stats.rz.mean };

    if (withStats) {
      rot.deviation = { rx: stats.rx.deviation, ry: stats.ry.deviation, rz: stats.rz.deviation };
      rot.range = { rx: stats.rx.range, ry: stats.ry.range, rz: stats.rz.range };
    }

    return rot;
  }
}
