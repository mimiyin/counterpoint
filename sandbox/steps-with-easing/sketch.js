const NUM_STEPS = 10;
let STEP_W;
let paces = {
    'vs': 60 * 5,
    's': 24 * 5,
    'm': 12 * 5,
    'f': 6 * 5,
}

// Default fraction of a pace interval used as lead time for easing
const LEAD_FRAC = 0.5;

// Per-step lead fractions for each mover
// Each entry corresponds to the same index in the choreo array
// Customize these to give each mover different inertia per step
let leadFracs = {
    'A': [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    'B': [0.1, 0.1, 0.1, 0.1, 0.1, 0.1]
}

// Populate with every combination and permutation
let choreo = {
    'A': [0, 1, 0, 0, 1, 0],
    'B': [1, 0, 1, 1, 0, 0]
}

let A, B;
let sounds = {};

let go = true;

// Generating all the possibilities
let choreos = [];
let results = [];
const LIMIT = 6;
generate([], 0);

// All possible pairings of all possible choreographies
for (let i = 0; i < results.length; i++) {
    let resultA = results[i];
    let choreosI = [];
    for (let j = 0; j < results.length; j++) {
        let resultB = results[j];
        let choreo = { 'A': resultA, 'B': resultB }
        choreosI.push(choreo);
    }
    choreos.push(choreosI);
}
// Recursively populate all possible choreographies
function generate(arr, idx) {
    if (idx == LIMIT) {
        results.push(arr);
        return;
    }
    let arr0 = arr.slice(0);
    arr0[idx] = 0;
    generate(arr0, idx + 1);
    let arr1 = arr.slice(0);
    arr1[idx] = 1;
    generate(arr1, idx + 1);
}

console.log(choreos);

function preload() {
    sounds.a = loadSound('a.wav');
    sounds.b = loadSound('b.wav');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    STEP_W = width / NUM_STEPS;
    // Use the default choreo on first load
    initMovers(choreo);
}

function reset() {
    let c = random(random(choreos));
    console.log(c);
    initMovers(c);
}

function initMovers(c) {
    A = new Mover('A', height / 3, paces.m, sounds.a, c.A, leadFracs.A);
    B = new Mover('B', 2 * height / 3, paces.m, sounds.b, c.B, leadFracs.B);
}

function replay() {
    A.reset();
    B.reset();
}

function draw() {
    background(0);
    if (go) {
        A.run();
        B.run();
    }

    fill('white');
    textSize(24);
    text("Press [spacebar] to replay current pattern. [ENTER] to randomly select new pattern.", 100, 100);
}

class Mover {
    constructor(name, y, pace, sound, choreo, leadFracs) {
        this.name = name;
        this.y = y;
        this.pace = pace;
        this.sound = sound;
        this.choreo = choreo;
        // Per-step lead fractions; fall back to global LEAD_FRAC if not provided
        this.leadFracs = leadFracs || new Array(choreo.length).fill(LEAD_FRAC);

        this.w = STEP_W / 4;
        this.h = height / 10;

        this.reset();
    }

    reset() {
        this.go = true;
        this.c = 0;      // choreography index
        this.s = 0;       // current step count (completed steps)

        // Position tracking for easing
        this.x = 0;             // current rendered x position
        this.startX = 0;        // x position at start of animation
        this.targetX = 0;       // x position we're easing toward
        this.animStartFrame = -1; // frame when animation started (-1 = not animating)
        this.animating = false;   // whether we're currently easing
        this.currentLeadFrames = 0; // leadFrames for the active animation
    }

    run() {
        if (this.go) {
            let framesUntilBeat = this.pace - (frameCount % this.pace);

            // Compute lead frames for the current choreography step
            let stepLeadFrames = Math.floor(this.pace * this.leadFracs[this.c]);

            // Look ahead: if we're exactly leadFrames away from the next beat,
            // peek at the next choreography step and start easing if it's a step
            if (!this.animating && framesUntilBeat == stepLeadFrames && this.c < this.choreo.length) {
                let next = this.choreo[this.c];
                if (next) {
                    // Start easing toward the next position
                    this.startX = this.s * STEP_W;
                    this.targetX = (this.s + 1) * STEP_W;
                    this.animStartFrame = frameCount;
                    this.currentLeadFrames = stepLeadFrames;
                    this.animating = true;
                }
            }

            // Interpolate position during animation
            if (this.animating) {
                let elapsed = frameCount - this.animStartFrame;
                let t = constrain(elapsed / this.currentLeadFrames, 0, 1);
                // Ease-out cubic: decelerates into the destination
                let eased = 1 - Math.pow(1 - t, 3);
                this.x = lerp(this.startX, this.targetX, eased);
            }

            // On the beat frame: finalize the step
            if (frameCount % this.pace == 0) {
                let next = this.choreo[this.c];
                if (next) {
                    this.step();
                    // Snap to final position
                    this.x = this.s * STEP_W;
                    this.animating = false;
                }

                console.log(this.name, this.choreo[this.c] == 1 ? 'STEPS!' : 'waits.');
                this.c++;

                // Stop when we're done
                if (this.c >= this.choreo.length) this.go = false;
            }
        }
        this.display();
    }

    step() {
        this.s++;
        this.sound.play();
    }

    display() {
        fill(255);
        rect(this.x, this.y, this.w, this.h);
    }
}

function keyPressed() {
    if (keyCode == '32') replay();
    else if (keyCode == RETURN) reset();
}
