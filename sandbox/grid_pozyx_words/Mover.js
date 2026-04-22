class Mover {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.c = floor(random(-COUNT_TH, COUNT_TH));
    }
    count(move) {
        if(move > MOVE_TH) this.c = 0;
        else if(this.c >= 0) this.c++;   
        
        
    }

    move() {
        let d = dist(mouseX, mouseY, this.x, this.y);
        if(d < DIAM/2) {
            this.update(mouseX, mouseY);
        }
    }

    speak() {
        return this.c >= COUNT_TH;
    }

    silence() {
        this.c = -1;
    }

    update(x, y) {
        let d = dist(this.x, this.y, x, y);
        this.count(d);
        this.x = x;
        this.y = y;
    }

    display() {
        fill('red');
        ellipse(this.x, this.y, DIAM);
        fill('white');
        text(floor(this.c), this.x, this.y);
    }





}