// Passes the raw tracker position through unchanged.
// Use it to read the tracker's own coordinates when measuring the calibration points.
export function identityTransformer(raw) {
  return { x: raw.x, y: raw.y, z: raw.z };
}

// Builds a transformer from tracker space to physical space (y is vertical, x and z are on the floor).
// origin: raw tracker reading at physical (0, 0, 0)
// xPoint: raw tracker reading at physical (xDistance, 0, 0)
// zPoint: raw tracker reading at physical (0, 0, zDistance)
// xDistance, zDistance: physical distance from the origin to xPoint and to zPoint
// xOffset, zOffset: offset of the physical space from the tracker space
export function createRoomTransformer(origin, xPoint, zPoint, xDistance = 1, zDistance = 1, xOffset = 0, zOffset = 0) {
  // Floor directions of the room's x and z axes, in tracker coordinates
  const xx = xPoint.x - origin.x;
  const xz = xPoint.z - origin.z;
  const zx = zPoint.x - origin.x;
  const zz = zPoint.z - origin.z;
  const xLen = Math.sqrt(xx * xx + xz * xz);
  const zLen = Math.sqrt(zx * zx + zz * zz);
  const det = xx * zz - xz * zx;

  // The three points must form a corner.
  if (Math.abs(det) <= 0.05 * xLen * zLen) {
    throw new Error('Room calibration failed: origin, xPoint and zPoint are on one line, or a reading is missing.');
  }

  // The room's x and z axes should be at a right angle and share one scale. If not, a point was misplaced.
  const cos = (xx * zx + xz * zz) / (xLen * zLen);
  if (Math.abs(cos) > 0.1) {
    const angle = Math.round(Math.acos(cos) * 180 / Math.PI);
    throw new Error('Room calibration failed: x and z axes are ' + angle + ' degrees apart, expected 90.');
  }

  const xScale = xDistance / xLen;
  const zScale = zDistance / zLen;
  if (Math.abs(xScale - zScale) > 0.05 * xScale) {
    throw new Error('Room calibration failed: x scale (' + xScale.toFixed(3) + ') and z scale (' + zScale.toFixed(3) + ') differ by more than 5%.');
  }

  const yScale = xScale;

  return function (raw) {
    const qx = raw.x - origin.x;
    const qz = raw.z - origin.z;

    return {
      x: xOffset + xDistance * (qx * zz - qz * zx) / det,
      y: yScale * (raw.y - origin.y), // assume y axis is along the absolute vertical direction
      z: zOffset + zDistance * (-qx * xz + qz * xx) / det,
    };
  };
}

export function createRoomTransformerFromConfig(config) {
  return createRoomTransformer(
    config.origin,
    config.xPoint,
    config.zPoint,
    config.xDistance,
    config.zDistance,
    config.xOffset,
    config.zOffset
  );
}
