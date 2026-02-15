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
        this.halfPace = Math.floor(pace / 2);
        this.sound = sound;
        this.choreo = choreo;
        // Per-step lead fractions; fall back to global LEAD_FRAC if not provided
        this.leadFracs = leadFracs || new Array(choreo.length).fill(LEAD_FRAC);

        // Full mover width (same as original); each foot is half of this
        this.w = STEP_W / 4;
        this.footW = this.w / 2;
        this.h = height / 10;

        this.reset();
    }

    reset() {
        this.go = true;
        this.c = 0;      // choreography index
        this.s = 0;       // current step count (completed steps)
        this.finishing = false; // true when choreo is done but left foot still animating

        // Right foot position tracking
        this.rightX = 0;
        this.rightStartX = 0;
        this.rightTargetX = 0;
        this.rightAnimStart = -1;
        this.rightAnimating = false;
        this.rightLeadFrames = 0;

        // Left foot position tracking
        this.leftX = 0;
        this.leftStartX = 0;
        this.leftTargetX = 0;
        this.leftAnimStart = -1;
        this.leftAnimating = false;
    }

    run() {
        if (this.go) {
            let framesUntilBeat = this.pace - (frameCount % this.pace);

            // Compute lead frames for the current choreography step
            let stepLeadFrames = Math.floor(this.halfPace * this.leadFracs[this.c]);

            // --- RIGHT FOOT: start easing leadFrames before the beat ---
            if (!this.rightAnimating && framesUntilBeat == stepLeadFrames && this.c < this.choreo.length) {
                let next = this.choreo[this.c];
                if (next) {
                    this.rightStartX = this.s * STEP_W;
                    this.rightTargetX = (this.s + 1) * STEP_W;
                    this.rightAnimStart = frameCount;
                    this.rightLeadFrames = stepLeadFrames;
                    this.rightAnimating = true;
                }
            }

            // Interpolate right foot position during animation
            if (this.rightAnimating) {
                let elapsed = frameCount - this.rightAnimStart;
                let t = constrain(elapsed / this.rightLeadFrames, 0, 1);
                // Ease-out cubic
                let eased = 1 - Math.pow(1 - t, 3);
                this.rightX = lerp(this.rightStartX, this.rightTargetX, eased);
            }

            // --- On the beat: finalize right foot, start left foot ---
            if (frameCount % this.pace == 0) {
                let next = this.choreo[this.c];
                if (next) {
                    this.step();
                    // Snap right foot to final position
                    this.rightX = this.s * STEP_W;
                    this.rightAnimating = false;

                    // Start left foot easing toward the same destination
                    this.leftStartX = (this.s - 1) * STEP_W;
                    this.leftTargetX = this.s * STEP_W;
                    this.leftAnimStart = frameCount;
                    this.leftLeadFrames = stepLeadFrames;
                    this.leftAnimating = true;
                }

                console.log(this.name, this.choreo[this.c] == 1 ? 'STEPS!' : 'waits.');
                this.c++;

                // Stop when we're done
                if (this.c >= this.choreo.length) this.finishing = true;
            }

            // --- LEFT FOOT: interpolate during its animation ---
            if (this.leftAnimating) {
                let elapsed = frameCount - this.leftAnimStart;
                let t = constrain(elapsed / this.leftLeadFrames, 0, 1);
                // Ease-out cubic
                let eased = 1 - Math.pow(1 - t, 3);
                this.leftX = lerp(this.leftStartX, this.leftTargetX, eased);

                // Snap when done
                if (t >= 1) {
                    this.leftX = this.leftTargetX;
                    this.leftAnimating = false;
                    if (this.finishing) this.go = false;
                }
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
        // Left foot (drawn on the left side)
        rect(this.leftX, this.y, this.footW, this.h);
        // Right foot (drawn on the right side, offset by footW)
        rect(this.rightX + this.footW, this.y, this.footW, this.h);
    }
}

function keyPressed() {
    if (keyCode == '32') replay();
    else if (keyCode == RETURN) reset();
}
