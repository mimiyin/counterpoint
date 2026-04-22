const AVG_FRAMES = 120;

function createOsc(f) {
    let osc = new p5.Oscillator();
    osc.setType('sine');
    osc.freq(f);
    osc.start();
    osc.amp(0);
    osc.amp(2, 10);
    return osc;
}

class Mover {

    constructor(x, y) {
        this.locs = [];
        this.update(x, y);
        this.f = 0;
        this.oscs = [];
    }

    set(f) {
        //console.log(this.oscs);
        if (this.f == f) {
            this.waver();
            return;
        }
        this.f = f;
        this.sound();
        this.silence();
    }

    waver() {
        let osc = this.oscs.at(-1);
        let amp = osc.getAmp();
        if(amp >= 2) {
            console.log('waning');
            osc.amp(-1, random(5, 10));
        }
        else if(amp <= -1) {
            console.log('waxing');
            osc.amp(1, random(10, 20));
        }

    }

    sound() {
        this.oscs.push(createOsc(this.f));
    }

    silence() {
        this.oscs.splice(0, this.oscs.length - 1).forEach((osc, o, oscs) => {
            osc.amp(0, 1);
            setTimeout(()=>{
                osc.stop();
                oscs.splice(o);
            }, 1000);
        });
    }

    move() {
        let d = dist(mouseX, mouseY, this.x, this.y);
        if(d < DIAM/2) {
            this.update(mouseX, mouseY);
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