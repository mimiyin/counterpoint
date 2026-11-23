const AVG_FRAMES = 1;
const DIAM = 50;
const MOVE_TH = 5;
const COUNT_TH = 10; //60 * 5; 


class Mover {
    constructor(id, x, y, osc) {
        this.id = id;
        this.update(x, y);
        this.osc = osc;
        this.c = 0;
        this.a = PI;
    }
    calc_ta(target) {
        let here = createVector(this.x, this.y);
        let there = createVector(target.x, target.y);
        let diff = there.sub(here);
        return diff.heading();
    }
    calc_d(target) {
        return dist(this.x, this.y, target.x, target.y);
    }
    calc_a2ta(target) {
        // Map to angle
        let _ta = this.calc_ta(target);
        let ta = _ta + PI;
        let a = this.a + PI;
        console.log(a, ta, _ta);
        return abs(a - ta);

        // let a20 = this.a + PI; // Angle to 0
        // let t20 = this.calc_ta(target) + PI; // Target angle to 0
        // let a2PI = PI - a20; // Angle to PI
        // let t2PI = PI - t20; // Target angle to PI
        // return a2PI + t2PI; //Angle across PI
    }
    calc_a2tamin(target) {
        let a20 = abs(this.a); // Angle to 0
        let t20 = abs(this.calc_ta(target)); // Target angle to 0
        let a2PI = PI - a20; // Angle to PI
        let t2PI = PI - t20; // Target angle to PI
        let adiffx0 = a20 + t20; //Angle across 0
        let adiffxPI = a2PI + t2PI; //Angle across PI
        return min(adiffx0, adiffxPI);
    }
    load(sound) {
      this.ping = sound;
    }
    play(target) {
        let d = this.calc_d(target);
        let interval = floor(map(d, 0, height, 1, 180));
        if (this.c > interval) {
            this.ping.play();
            console.log("PLAY!", interval);
            this.c = 0;
        }
        this.c++;
    }
    sing(target) {
<<<<<<< Updated upstream
        let d = this.y - target.y; //this.calc_d(target);
        let r = map(d, 0, height, 0, RATIOS.length);
        r = constrain(r, 0, RATIOS.length);
        let f = RATIOS[floor(r)] * BASE;
        f = constrain(f, BASE, 4*BASE) || BASE;
        console.log(RATIOS.length, floor(r), f);
        this.osc.amp(1);
=======
        let a2ta = this.calc_a2ta(target); //this.calc_a2ta(target);
        let r = map(a2ta, 0, TWO_PI, 0, RATIOS.length);


        // // Map to distance
        // let d = this.calc_d(target);
        // let r = map(d, 0, height, 0, RATIOS.length);

        let f = RATIOS[floor(r)] * BASE;
>>>>>>> Stashed changes
        this.osc.freq(f);
    }
    amp(target) {
        //let a2ta = this.calc_a2tamin(target);
        //let amp = map(abs(a2ta), 0, PI, 1, 0);

        let d = this.calc_d(target);
        let amp = map(d, 0, height, 1, 0);
        amp = constrain(amp, 0, 1);
        this.osc.amp(amp);
    }

    update(x, y) {
        this.x = x;
        this.y = y;
    }

    display() {
        push();
        translate(this.x, this.y);
        fill('white');
        ellipse(0, 0, DIAM);
        push();
        stroke('white');
        rotate(this.a);
        line(0, 0, DIAM, 0);
        pop();
        fill('white');
        textAlign(CENTER, CENTER);
        text(this.c, 0, 0);
        pop();
    }
}