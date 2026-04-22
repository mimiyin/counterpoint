class Cell {
    constructor(x, y, sound) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.sound = sound;
    }

    run() {
        this.update();
        this.display();
    }

    play() {
        this.sound.play();
    }

    display() {
        noFill();
        stroke('white');
        rect(this.x, this.y, this.w, this.h);
    }

    flash() {
        fill('red');
        rect(this.x, this.y, this.w, this.h);
    }





}