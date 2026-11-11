const AVG_FRAMES = 1;
const DIAM = 50;
const MOVE_TH = 5;
const COUNT_TH = 10; //60 * 5; 


class Mover {
    constructor(id, x, y, osc) {
        this.id = id;
        this.update(x,y);
        this.osc = osc;
        this.c = 0;
        this.a = PI;
    }
    calc_a(target) {
        let here = createVector(this.x, this.y);
        let there = createVector(target.x, target.y);
        let diff = there.sub(here);
        return diff.heading();
    }
    calc_d(target) {
        return dist(this.x, this.y, target.x, target.y);
    }
    load(sound) {
        this.ping = sound;
    }
    play(target) {
        let d = this.calc_d(target);
        let interval = floor(map(d, 0, height, 1, 180));
        if(this.c > interval) {
            this.ping.play();
            console.log("PLAY!", interval);
            this.c = 0;
        }
        this.c++;
    }
    sing(target) {
        let d = this.calc_d(target);
        let r = map(d, 0, height, 0, RATIOS.length);
        let f = RATIOS[floor(r)] * BASE;
        this.osc.amp(1);
        this.osc.freq(f);
    }
    amp(target) {
        let a = this.calc_a(target);
        let d = this.calc_d(target);
        let amp = map(abs(d), 0, height, 1, 0.5);
        amp = constrain(amp, 0, 1);
        this.osc.freq(BASE);
        this.a %= TWO_PI;
        console.log(this.a, a);

        //3.14 and -3.12 are only 0.02 apart 
        // Calculate distance to PI boundary
        let ad2b = abs(abs(a) - PI);
        let thisad2b = abs(abs(this.a) - PI);
        let chasm = ad2b + thisad2b;

        // Is target in front of me?    
        let inFront = abs(a-this.a) < 0.1 || chasm < 0.1;
        this.osc.amp( inFront ? amp : 0);
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