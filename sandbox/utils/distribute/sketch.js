let points = [];
let diag = 0;
let np;

function setup() {
  createCanvas(windowWidth, windowHeight);
  diag = sqrt(sq(width) + sq(height));
  noFill();

}

function draw() {
  background(0);
  stroke(255);
  strokeWeight(1);
  if (points.length >= 4) {
    beginShape();
    bezier(points[0].x, points[0].y, points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y);
    endShape();

    // Control lines
    stroke('blue');
    line(points[0].x, points[0].y, points[1].x, points[1].y);
    line(points[2].x, points[2].y, points[3].x, points[3].y);
  }


  stroke('red');
  strokeWeight(10);
  for (let pt of points) {
    point(pt.x, pt.y);
  }

}

function mousePressed() {
  if (keyIsPressed) return;
  points.unshift({ x: mouseX, y: mouseY });
  points = points.slice(0, 4);
}

// Move the closest point with the mouse
// mouse is being dragged
function mouseDragged() {
  if (keyIsPressed) {
    let nearest = diag;
    for (let p in points) {
      let point = points[p];
      let d = dist(mouseX, mouseY, point.x, point.y);
      if (d < nearest) {
        nearest = d;
        np = p;
      }
    }
    points[np].x = mouseX;
    points[np].y = mouseY;
  }
}
