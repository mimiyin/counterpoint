import { Tracker } from './tracker.js';
import { isValidMessage, isValidPosition } from './validators.js';

export class TrackerStore {

  constructor(transformer) {
    this.transformer = transformer;
    this.trackers = {};
  }

  update(message) {
    if (!isValidMessage(message)) {
      this.warnInvalid('data that is not in the {ts, trackers: [{id, x, y, z}]} format', message);
      return;
    }

    for (const raw of message.trackers) {
      const pos = this.transform(raw);
      if (!pos) continue;

      if (!(raw.id in this.trackers)) {
        this.trackers[raw.id] = new Tracker(raw.id);
      }

      this.trackers[raw.id].update(pos, raw, message.ts);
    }
  }

  transform(raw) {
    const pos = this.transformer(raw);

    if (!isValidPosition(pos)) {
      this.warnInvalid('a transformer result that is not {x, y, z} numbers', pos);
      return null;
    }

    return pos;
  }

  // TODO: warn once or throttle.
  warnInvalid(what, data) {
    console.warn('TrackerStore: ignoring ' + what + '.', data);
  }

  setTransformer(transformer) {
    this.transformer = transformer;

    for (const id in this.trackers) {
      this.trackers[id].clear();
    }
  }

  getTrackers() {
    return this.trackers;
  }
}
