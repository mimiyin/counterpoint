const AVG_FRAMES = 1;
const DIAM = 50;
const MOVE_TH = 5;
const COUNT_TH = 10; //60 * 5; 


class Mover {
    constructor(id, x, y) {
        this.id = id;
        this.locs = [];
        this.px = 0;
        this.py = 0;
        this.update(x,y);
        this.c = floor(random(-COUNT_TH, COUNT_TH));
    }
    count(move) {
        if(move > MOVE_TH) this.c = 0;
        else if(this.c >= 0) {
            this.c++;   
        }
    }

    move() {
        if(!mouseIsPressed) return;
        //let d = dist(mouseX, mouseY, this.x, this.y);
        //if(d < DIAM/2) {
            this.x = constrain(mouseX, 0, width);
            this.y = constrain(mouseY, 0, height);
            let d = dist(this.x, this.y, this.px, this.py);
            this.count(d);
            this.px = this.x;
            this.py = this.y;
            tags[this.id] = { x : this.x, y : this.y, ts : Date.now() };
        //}
    }

    still() {
        return this.c >= COUNT_TH;
    }

    silence() {
        this.c = -1;
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

        this.px = this.x;
        this.py = this.y;

        this.x = _x;
        this.y = _y;

        let d = dist(this.x, this.y, this.px, this.py);
        this.count(d);
    }

    display() {
        fill('red');
        ellipse(this.x, this.y, DIAM);
        fill('white');
        textAlign(CENTER, CENTER);
        text(this.c, this.x, this.y);
    }
}