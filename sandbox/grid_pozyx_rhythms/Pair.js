class Pair {
    constructor(A, B, sound) {
        this.A = A;
        this.B = B;
        this.sound = sound;
        this.sound.play();
        this.tempo = 1000;
        this.ptempo = this.tempo;
    }
    
    run() {
        this.set();
        this.display();
    }

    set() {
        this.tempo = floor(map(this.dist(), 0, diag, TEMPO_MIN, TEMPO_MAX));
        if(abs(this.tempo - this.ptempo) < 300) return;
        this.ptempo = this.tempo;

        clearInterval(this.interval);
        this.interval = setInterval(()=>{
            this.sound.play();
            console.log("PLAY");
        }, this.tempo);
    }

    dist() {
        return dist(this.A.x, this.A.y, this.B.x, this.B.y);
    }

    display() {
        stroke('white');
        line(this.A.x, this.A.y, this.B.x, this.B.y);
    }
}