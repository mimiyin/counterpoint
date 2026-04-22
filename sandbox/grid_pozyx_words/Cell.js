class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.empty();
        this.cue(true);
        this.voice = new p5.Speech();
    }

    run() {
        this.update();
        this.display();
    }

    speak(word) {
        // speak
        if(!this.ready) return;
        this.voice.speak(word);
        this.cue(false);
    }

    display() {
        stroke('white');
        fill(255, this.ready ? 0 : 255);
        rect(this.x, this.y, this.w, this.h);
    }

    cue(state) {
        this.ready = state;
    }

    occupy() {
        this.isEmpty = false;
    }

    empty() {
        this.isEmpty = true;
    }
}