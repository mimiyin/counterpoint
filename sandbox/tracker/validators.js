// The agreed format of tracker data: {ts, trackers: [{id, x, y, z, ...}, ...]}

// A message needs a list of tracker entries, and every entry must be valid
export function isValidMessage(message) {
  return message != null
    && Array.isArray(message.trackers)
    && message.trackers.every(isValidTracker);
}

export function isValidTracker(raw) {
  return raw != null
    && typeof raw.id === 'string'
    && Number.isFinite(raw.x) && Number.isFinite(raw.y) && Number.isFinite(raw.z);
}

export function isValidPosition(pos) {
  return pos != null
    && Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z);
}
