// How far the target is from where the person faces, in degrees: right positive, left negative, ahead 0, behind 180 or -180
export function targetOffsetDegrees(scene, turnDegrees) {
  if (!scene || !scene.listener) return null;

  const target = scene.sources.find((src) => src.id === 'target');
  if (!target) return null;

  const towardsTarget = Math.atan2(target.x - scene.listener.x, -(target.z - scene.listener.z)) * 180 / Math.PI;
  return ((towardsTarget - turnDegrees) % 360 + 540) % 360 - 180;
}
