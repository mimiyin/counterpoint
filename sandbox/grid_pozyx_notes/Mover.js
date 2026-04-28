const AVG_FRAMES = 1;
let amp_max = 1;
let amp_min = 0;

const DIAM = 50;
const MOVE_TH = 5;
const COUNT_TH = 60 * 5; 


function createOsc(f) {
    let osc = new p5.Oscillator();
    osc.setType('sine');
    osc.freq(f);
    osc.start();
    osc.amp(0);
    osc.amp(1, 10);
    return osc;
}

class Mover {

    constructor(id, x, y) {
        this.id = id;
        this.locs = [];
        this.update(x, y);
        this.f = 0;
        this.oscs = [];
    }

    set(f) {
        //console.log(this.oscs);
        // If the note hasn't changed
        if (this.f == f) {
            //console.log('waver');
            this.waver();
            return;
        }
        console.log('new');
        this.f = f;
        this.sound();
        this.clear();
    }

    waver() {
        let osc = this.oscs.at(-1);
        let amp = osc.getAmp();
        //console.log('amp', this.f, amp, amp_max, amp_min);
        if(amp >= amp_max) {
            console.log('wane');
            osc.amp(amp_min, random(5, 10));
        }
        else if(amp <= amp_min) {
            console.log('wax');
            amp_min = random(-5, -1);
            osc.amp(amp_max, random(2, 10));
        }

    }

    sound() {
        this.oscs.push(createOsc(this.f));
    }


    clear() {
        this.oscs.splice(0, this.oscs.length - 1).forEach((osc, o, oscs) => {
            osc.amp(0, 1);
            setTimeout(()=>{
                osc.stop();
                oscs.splice(o);
            }, 1000);
        });
    }

    move() {
        if(!mouseIsPressed) return;
        let d = dist(mouseX, mouseY, this.x, this.y);
        console.log('d', d);
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
        fill('white');
        textAlign(CENTER, CENTER);
        text(floor(nfs(this.f, 0, 2)), this.x, this.y);
    }
}