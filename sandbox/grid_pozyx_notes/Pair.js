class Pair {
    constructor(A, B) {
        this.A = A;
        this.B = B;
        this.oscs = [];
        this.f = -1;
    }

    run() {
        this.set();
        this.play();
        this.display();
    }

    play() {
        this.osc = this.oscs.at(-1);
        play(this.osc);
    }

    set() {
        // Calculate frequency mapped to distance
        let r = floor(map(this.dist(), 0, diag, 0, RATIOS.length));
        let f = floor(RATIOS[r] * BASE);

        // No change
        if (this.f == f) return;

        // Store new frequency
        this.f = f;
        
        // Display frequency
        this.A.set(this.f);
        this.B.set(this.f);

        // Create new note
        this.sound();
        // Fade out old note
        this.clear();
    }

    sound() {
        let osc = createOsc(this.f);
        this.oscs.push(osc);
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

    dist() {
        return dist(this.A.x, this.A.y, this.B.x, this.B.y);
    }

    display() {
        stroke('white');
        line(this.A.x, this.A.y, this.B.x, this.B.y);
    }
}