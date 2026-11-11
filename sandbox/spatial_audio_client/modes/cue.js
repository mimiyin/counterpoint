import { Mode } from './mode.js';
import { createSpatialSource, placeSourceOnFloor } from '../resonance.js';

// Sound cue mode: near an edge of the floor, a sound plays from the opposite side, drawing the person back in.
// The sound stays in the room as the person turns, so it is heard from where it is, not from where they face.

const CUE_WARN_M = 1;           // the cue starts when an edge is closer than this
const CUE_DISTANCE_SCALE = 1;     // each close edge pushes the cue away this many times its own distance: 1 mirrors it
const CUE_MIN_DISTANCE_M = 0.3;   // an edge pushes the cue at least this far, a sound on the listener's head has no direction
const CUE_PULSE_MS = 2000;

export class CueMode extends Mode {
  constructor() {
    super();
    this.cue = null;
    this.cueSource = null;
    this.pulseTimer = null;
  }

  preload() {
    this.cue = loadSound('../GOL_man/bell.wav');
  }

  setup() {
    this.cue.playMode('restart');
    this.cue.setVolume(0.5);

    this.cueSource = createSpatialSource(this.cue);
  }

  onScene(s) {
    const offset = cueOffsetFromEdges(s);

    if (offset) {
      placeSourceOnFloor(this.cueSource, { x: s.listener.x + offset.x, z: s.listener.z + offset.z });
    }
    this.setCuePlaying(offset !== null);
  }

  status() {
    return this.pulseTimer ? 'Near an edge: cue playing' : 'Inside the floor';
  }

  setCuePlaying(playing) {
    if (playing && this.pulseTimer === null) {
      this.cue.play();
      this.pulseTimer = setInterval(() => this.cue.play(), CUE_PULSE_MS);
    } else if (!playing && this.pulseTimer !== null) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }
}

// Where the cue goes relative to the listener, in metres
function cueOffsetFromEdges(scene) {
  if (!scene || !scene.listener) return null;

  const { x: listenerX, z: listenerZ } = scene.listener;
  const closeEdges = [
    { distance: listenerX, awayX: 1, awayZ: 0 },                        // left edge: away is to the right
    { distance: scene.floor.width - listenerX, awayX: -1, awayZ: 0 },   // right edge: away is to the left
    { distance: listenerZ, awayX: 0, awayZ: 1 },                        // front edge: away is further back
    { distance: scene.floor.depth - listenerZ, awayX: 0, awayZ: -1 },   // back edge: away is further forward
  ].filter((edge) => edge.distance < CUE_WARN_M);

  let offsetX = 0, offsetZ = 0;
  for (const edge of closeEdges) {
    const push = Math.max(CUE_MIN_DISTANCE_M, edge.distance * CUE_DISTANCE_SCALE);
    offsetX += edge.awayX * push;
    offsetZ += edge.awayZ * push;
  }

  // Zero when no edge is close, or when two opposite edges push equally (a very narrow floor)
  if (offsetX === 0 && offsetZ === 0) return null;
  return { x: offsetX, z: offsetZ };
}
