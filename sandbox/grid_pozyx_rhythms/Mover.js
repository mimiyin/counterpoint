const AVG_FRAMES = 10;
const AMP_MAX = 1;
const AMP_MIN = 0.1;

const DIAM = 100;
const MOVE_TH = 5;
const COUNT_TH = 60 * 5; 
const FADEIN_DUR = 5;


function createOsc(f) {
    let osc = new p5.Oscillator();
    osc.setType('sine');
    osc.freq(f);
    osc.start();
    osc.amp(0);
    osc.amp(AMP_MAX, FADEIN_DUR);
    return osc;
}

class Mover {

    constructor(id, x, y) {
        this.id = id;
        this.locs = [];
        this.update(x, y);
    }

    run() {
        this.move();
        this.display();
    }

    move() {
        if(!mouseIsPressed) return;
        let d = dist(mouseX, mouseY, this.x, this.y);
        if(d < DIAM) {
            this.x = mouseX;
            this.y = mouseY;
            tags[this.id] = { x : this.x, y : this.y, ts : Date.now() };
        }
    }

    update(x, y) {
        this.locs.push({ x : x, y : y });
        if(this.locs.length > AVG_FRAMES) this.locs.shift();
        
        let _x = 0;
        let _y = 0;
        
        this.locs.forEach((loc)=>{
            _x += loc.x;
            _y += loc.y;
        });
        
        _x /= this.locs.length;
        _y /= this.locs.length;

        this.x = _x;
        this.y = _y;
    }

    display() {
        fill('red');
        ellipse(this.x, this.y, DIAM);
    }
}