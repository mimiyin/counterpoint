import { Mode } from './mode.js';

// Direction mode: guides the user back to the front direction.
// Assumes the phone is held landscape with the top of the phone (front camera) to the user's left,
// upright with the screen facing the eyes, and rotation lock is on. The page then stays portrait,
// and the user's left is the page's top, their right the page's bottom.

const FIELD_DEGREES = 180;

export class DirectionMode extends Mode {
  constructor() {
    super();
    this.front = null;
    this.heading = null;
    this.sensorOn = false;
  }

  start() {
    this.startSensor();
    this.front = null;
  }

  draw() {
    background(0);
    fill(255);

    if (this.heading === null) {
      rect(width / 2, height / 2, width, height);
      return;
    }

    if (this.front === null) {
      this.front = this.heading;
    }

    // Turned right -> front is to the user's left (the page's top) -> the white slides up.
    let amount = -this.turnFrom(this.heading, this.front) / FIELD_DEGREES;  // -1 to 1, positive: toward the user's right (down)
    rect(width / 2, height / 2 + amount * height, width, height);
  }

  async startSensor() {
    if (this.sensorOn) return;
    this.sensorOn = true;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer !== 'granted') throw new Error('permission ' + answer);
      }
      window.addEventListener('deviceorientation', (e) => this.onOrientation(e));
    } catch (err) {
      this.sensorOn = false;  // let a later tap try again
      console.warn('Motion sensor:', err.message);
    }
  }

  // The phone's back points along its -z axis. Rotate that axis into the world with alpha, beta, gamma
  // (the rotation matrix from the W3C DeviceOrientation spec) and take its compass angle on the floor.
  // Unlike alpha alone, this stays right when the screen tilts past vertical, where iOS flips alpha by 180.
  onOrientation(e) {
    if (e.alpha === null) return;
    const a = e.alpha * Math.PI / 180;
    const b = e.beta * Math.PI / 180;
    const g = e.gamma * Math.PI / 180;
    const east = -(Math.cos(g) * Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.sin(g));
    const north = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.cos(g) * Math.sin(b));
    this.heading = Math.atan2(east, north) * 180 / Math.PI;
  }

  turnFrom(degrees, fromDegrees) {
    return ((degrees - fromDegrees) % 360 + 540) % 360 - 180;
  }
}
