class Pair {
    constructor(A, B) {
        this.A = A;
        this.B = B;
    }

    run() {
        this.set();
        this.display();
    }

    set() {
        let r = floor(map(this.dist(), 0, diag, 0, RATIOS.length));
        let f = floor(RATIOS[r] * BASE);
        this.A.set(BASE);
        this.B.set(f);
    }

    dist() {
        return dist(this.A.x, this.A.y, this.B.x, this.B.y);
    }

    display() {
        stroke('white');
        line(this.A.x, this.A.y, this.B.x, this.B.y);
    }
}