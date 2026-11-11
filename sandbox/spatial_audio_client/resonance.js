// The Resonance Audio scene. Positions come in as floor metres from the controller,
// measured from the floor's top-left corner: x across, z down the canvas.

const ROOM_HEIGHT_M = 3;
const EAR_HEIGHT_M = 1.6;
const ROOM_MATERIALS = {
  left: 'plaster-smooth', right: 'plaster-smooth',
  front: 'plaster-smooth', back: 'plaster-smooth',
  down: 'polished-concrete-or-tile', up: 'acoustic-ceiling-tiles',
};

let scene;
let floorSizeInMetres = null;

export function startResonance() {
  scene = new ResonanceAudio(getAudioContext());
  scene.output.connect(getAudioContext().destination);
  scene.setListenerOrientation(0, 0, -1, 0, 1, 0); // facing forward, head up
}

export function updateRoom(floor) {
  if (!isNewFloorSize(floor)) return;

  floorSizeInMetres = floor;
  scene.setRoomProperties({ width: floor.width, height: ROOM_HEIGHT_M, depth: floor.depth }, ROOM_MATERIALS);
}

export function placeListenerOnFloor(floorPos) {
  const p = floorToResonance(floorPos);
  scene.setListenerPosition(p.x, p.y, p.z);
}

// turnDegrees: how far the listener is turned from forward, right is positive
export function turnListener(turnDegrees) {
  // Facing direction for a turn of θ is (sin θ, 0, -cos θ): forward is -z, turning right swings towards +x.
  // Resonance rotates the sound field by the orientation it is given, instead of by its inverse,
  // so sounds would turn with the listener's head (on a phone, turning left moved a front sound to the left ear).
  // Passing the opposite turn, -θ, keeps them still in the room: (sin(-θ), 0, -cos(-θ)) = (-sin θ, 0, -cos θ).
  const turn = turnDegrees * Math.PI / 180;
  scene.setListenerOrientation(-Math.sin(turn), 0, -Math.cos(turn), 0, 1, 0);
}

// The sound now plays through a Resonance source instead of straight out; move it with placeSourceOnFloor
export function createSpatialSource(sound) {
  const source = scene.createSource();
  sound.disconnect();
  sound.connect(source.input);
  return source;
}

export function placeSourceOnFloor(source, floorPos) {
  const p = floorToResonance(floorPos);
  source.setPosition(p.x, p.y, p.z);
}

function isNewFloorSize(floor) {
  return !floorSizeInMetres || floorSizeInMetres.width !== floor.width || floorSizeInMetres.depth !== floor.depth;
}

function floorToResonance(floorPos) {
  const roomCentreX = floorSizeInMetres.width / 2;
  const roomCentreZ = floorSizeInMetres.depth / 2;
  const earAboveRoomCentre = EAR_HEIGHT_M - ROOM_HEIGHT_M / 2;

  return {
    x: floorPos.x - roomCentreX,
    y: earAboveRoomCentre,
    z: floorPos.z - roomCentreZ,
  };
}
