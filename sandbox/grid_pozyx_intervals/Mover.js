const AVG_FRAMES = 10;

const DIAM = 100;
const MOVE_TH = 5;
const COUNT_TH = 60 * 5; 

const AMP_MAX = 1;
const AMP_MIN = 0;

const FADE_DUR = 3;
const FADEOUT_DUR = 1;
const WAVER = true;
const RANDOMIZE = true;

function createOsc(f) {
    let osc = new p5.Oscillator();
    osc.setType('sine');
    osc.freq(f);
    osc.amp(0);
    osc.start();
    return osc;
}

class Mover {

    constructor(id, x, y) {
        this.id = id;
        this.locs = [];
        this.update(x, y);
        this.f = 0;
        this.oscs = [];
        this.fade_dur = FADE_DUR;
        this.waxed = false;
    }

    set(f) {
        //console.log(this.oscs);
        // Play the note
        if(this.oscs.length > 0) this.play();
        // If the note hasn't changed
        if (this.f == f) return;
        this.f = f;
        // Create new note
        this.sound();
        // Fade out old note
        this.clear();
    }

    play() {
        let osc = this.oscs.at(-1);
        let amp = osc.getAmp();
        //console.log('amp', this.f, amp, AMP_MAX, AMP_MIN);
        if(RANDOMIZE && this.waxed && amp > 0) {
            this.fade_dur = random(1, FADE_DUR);
            this.waxed = false;
        }
        if(WAVER && amp >= AMP_MAX) {
            osc.amp(AMP_MIN, this.fade_dur);
        }
        else if(amp <= AMP_MIN) {
            this.waxed = true;
            osc.amp(AMP_MAX, this.fade_dur);
        }
    }

    sound() {
        this.oscs.push(createOsc(this.f));
    }


    clear() {
        this.oscs.splice(0, this.oscs.length - 1).forEach((osc, o, oscs) => {
            osc.amp(0, FADEOUT_DUR);
            setTimeout(()=>{
                osc.stop();
                oscs.splice(o);
            }, FADEOUT_DUR * 1000);
        });
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
        fill('white');
        textAlign(CENTER, CENTER);
        textSize(48);
        text(floor(nfs(this.f, 0, 2)), this.x, this.y);
    }
}