const AVG_FRAMES = 10;
const DIAM = 100;
const MOVE_TH = 5;
const COUNT_TH = 60 * 5; 

class Mover {

    constructor(id, x, y) {
        this.id = id;
        this.locs = [];
        this.update(x, y);
        this.f = 0;
    }

    set(f) {
        this.f = f;
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