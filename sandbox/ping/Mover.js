const AVG_FRAMES = 1;
const DIAM = 50;
const MOVE_TH = 5;
const COUNT_TH = 10; //60 * 5; 


class Mover {
    constructor(id, x, y, a, osc) {
        this.id = id;
        this.update(x,  y);
        this.osc = osc;
        this.c = 0;
        this.a = a/100;
    }
    
    // Angle from mover to target
    calc_ta(target) {
        let here = createVector(this.x, this.y);
        let there = createVector(target.x, target.y);
        let diff = there.sub(here);
        return diff.heading();
    }

    // Distance from target
    calc_d(target) {
        return dist(this.x, this.y, target.x, target.y);
    }

    // Delta between mover's angle and angle to target
    calc_t2a(target, dir) {
        // Map to angle
        let ta = this.calc_ta(target); // Dir dist to 0
        ta = map(ta, -PI, PI, 0, TWO_PI);
        let a = map(this.a, -PI, PI, 0, TWO_PI);
        let delta = dir == 'cw' ? ta-a : a -ta;
        return (TWO_PI + delta) % TWO_PI;
    }
    load(sound) {
      this.ping = sound;
    }

    play(target) {
        let d = this.calc_d(target);
        let interval = floor(map(d, 0, height, 1, 180));
        if  (this.c > interval) {
            this.ping.play();
            console.log("PLAY!", interval);
            this.c = 0;
        }
        this.c++;
    }

    sing(target) {

        let cwt2a = this.calc_t2a(target, 'cw'); //this.calc_a2ta(target);
        let r = map(cwt2a, 0, TWO_PI, 0, RATIOS.length);

        // Map to distance
        // let d = this.y - target.y; //this.calc_d(target);
        // let r = map(d, 0, height, 0, RATIOS.length);
        
        // Convert ratio to frequency
        r = constrain(r, 0, RATIOS.length);
        let f = (RATIOS[floor(r)] * BASE) || BASE;
        this.osc.amp(1);
        this.osc.freq(f);
    }
    amp(target) {
        let cwt2a = this.calc_t2a(target, 'cw');
        let ccwt2a = this.calc_t2a(target, 'ccw');
        let t2a = min(cwt2a, ccwt2a);
        let amp = map(abs(t2a), 0, HALF_PI, 1, 0);

        //let d = this.calc_d(target);
        //let amp = map(d, 0, height, 1, 0);
        amp = constrain(amp, 0, 1);
        this.osc.amp(amp);
    }

    update(x, y, a) {
        this.x = x;
        this.y = y;
        a = map(a, -270, 90, -180, 180);
        this.a = map(a, -180, 180, PI, -PI);
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
        fill('black');
        textAlign(CENTER, CENTER);
        text(nfs(this.a, 0, 2), 0, -10);
        text(nfs(this.calc_ta(target), 0, 2), 0, 0);
        text(nfs(this.calc_t2a(target, 'cw'), 0, 2), 0, 10);
        pop();
    }
}