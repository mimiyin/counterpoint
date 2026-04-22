class Mover {
  constructor(col, row, color, moveType = 'teleport', movementOptions = ['left', 'right', 'up', 'down']) {
    this.col = col;
    this.row = row;
    this.color = color;
    this.moveType = moveType;
    this.movementOptions = movementOptions;

    this.moveDuration = 500;
    this.responseDelay = 0;

    this._fromCol = col;
    this._fromRow = row;
    this._toCol = col;
    this._toRow = row;
    this._moveStartTime = 0;
    this._moving = false;
  }

  _animProgress() {
    if (this.moveDuration <= 0) return 1;

    let elapsed = millis() - this._moveStartTime;
    let t = constrain(elapsed / this.moveDuration, 0, 1);

    if (this.moveType === 'ease') {
      t = t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;
    }

    return t;
  }

  update() {
    if (!this._moving) return;

    if (this._animProgress() >= 1) {
      this.col = this._toCol;
      this.row = this._toRow;
      this._moving = false;
    }
  }

  isMoving() {
    return this._moving;
  }

  display(cellWidth, cellHeight) {
    push();
    fill(this.color);
    noStroke();

    let displayCol = this.col;
    let displayRow = this.row;

    if (this._moving) {
      let t = this._animProgress();
      displayCol = lerp(this._fromCol, this._toCol, t);
      displayRow = lerp(this._fromRow, this._toRow, t);
    }

    let cx = displayCol * cellWidth + cellWidth / 2;
    let cy = displayRow * cellHeight + cellHeight / 2;
    let radius = min(cellWidth, cellHeight) * 0.35;

    ellipse(cx, cy, radius * 2, radius * 2);
    pop();
  }

  moveTo(newCol, newRow) {
    if (this._moving) {
      this.col = this._toCol;
      this.row = this._toRow;
      this._moving = false;
    }

    if (this.moveType === 'teleport') {
      this.col = newCol;
      this.row = newRow;
      return;
    }

    this._fromCol = this.col;
    this._fromRow = this.row;
    this._toCol = newCol;
    this._toRow = newRow;
    this._moveStartTime = millis();
    this._moving = true;
  }
}