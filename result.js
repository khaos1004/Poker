

module.exports = class Result {



    constructor(cards) {
        this.cards = JSON.parse(JSON.stringify(cards)); //copy
        this.result = {};
    }


    

    shapeToInt(a) {
        if(a == "S") {
            return 4;
        }
        else if(a=="D") {
            return 3;
        } else if(a=="H") {
            return 2;
        } else if(a=="C") {
            return 1;
        }
    }

    compareShape(a, b) {
        if(this.shapeToInt(a) > this.shapeToInt(b)) return -1;
        if(this.shapeToInt(a) == this.shapeToInt(b)) return 0;
        if(this.shapeToInt(a) < this.shapeToInt(b)) return 1;
    }

    sortCards() {
        this.cards.sort((a,b)=> {
            let n1 = a.number == 1 ? 14 : a.number;
            let n2 = b.number == 1 ? 14 : b.number;
            if(n1 > n2) return -1;
            if(n1 == n2) {
                return this.compareShape(a.shape, b.shape);
            }
            if(n1 < n2) return 1;
        });
    }

    isRsf() {
        let mountine = [1, 10, 11, 12, 13];
        let mn = [0, 0, 0, 0, 0];
        let ms = [0, 0, 0, 0];
        
        for(var c of this.cards) {
            for(var mi=0;mi<mountine.length;mi++) {
                if(mountine[mi] == c.number) {
                    mn[mi]+=1;
                    if(c.shape == 'S') ms[3]+=1;
                    else if(c.shape == 'D') ms[2]+=1;
                    else if(c.shape == 'H') ms[1]+=1;
                    else if(c.shape == 'C') ms[0]+=1;
                }
            }
        }

        for(var mi=0;mi<mountine.length;mi++) {
            if(mn[mi] == 0) {
                return null;
            }
        }
        for(var i=0;i<4;i++) {
            if(ms[i] >= 5) {

                let shape = '';
                if(i == 3) {
                    shape = 'S';
                } else if(i == 2) {
                    shape = 'D';
                } else if(i == 1) {
                    shape = 'H';
                } else if(i == 0) {
                    shape = 'C';
                }

                for(var c of this.cards) {
                    c.isShow = false;
                    for(var j=0;j<mountine.length;j++) {
                        if(c.number == mountine[j] && c.shape == shape) {
                            c.isShow = true;
                        }
                    }
                }

                this.result = {
                    madeLevel : 1,
                    madeExtra : i + 1, //S = 4, D = 3, H= 2, C = 1
                }
                return this.result;
            }
        }
        return null;
    }

    isSf() {
        
        let sh = [0, 0, 0, 0];
        for(var c of this.cards) {
            if(c.shape == 'S') {
                sh[3]+=1;
            } else if(c.shape == 'D') sh[2] +=1;
            else if(c.shape == 'H') sh[1] += 1;
            else if(c.shape == 'C') sh[0] += 1;
        }

        let sameShape = 0;

        for(var i=0;i<4;i++) {
            if(sh[i] >= 5) {
                sameShape = i + 1;
            }
        }


        let hasStraight = false;
        let top = 0;
        let check = [];
        for(var c of this.cards) {
            check[c.number] = true;
        }
        for(var ii=10;ii>=1;ii--) {
            let i = ii;
            if(ii==10) {
                i = 1;
            }
            hasStraight = true;
            for(var j=0;j<=4;j++) {
                if(!check[i+j]) {
                    hasStraight = false;
                    top = 0;
                    break;
                }
                if(i+j == 1 || (top != 1 && top < i+j)) {
                    top = i+j;
                }
            }
            if(hasStraight) {
                break;
            }
       
        }

        if(sameShape != 0 && top != 0) {
            for(var c of this.cards) {
                let shape = '';
                if(sameShape == 4)  {
                    shape = 'S';
                } else if(sameShape == 3) shape = 'D';
                else if(sameShape == 2) shape = 'H';
                else if(sameShape == 1) shape = 'C';
                if(c.shape == shape) {
                    c.isShow = true;
                } else {
                    c.isShow = false;
                }
            }
            if(top == 1) {
                top = 14;
            }
            this.result = {
                madeLevel : 2,
                madeExtra : top * 10 + sameShape
            }
            return this.result;
        }
        return null;
    }

    isMountine() {
        //made level = 6
        let check = [10, 11, 12, 13, 1];
        let check2 = [0, 0, 0, 0, 0];
        let top = 14;
        let shape;
        for(var c of this.cards) {
            for(var i=0;i<check.length;i++) {
                if(check[i] == c.number) {
                    check2[i]+=1;
                    if(check[i] == 1) {
                        if(c.shape == 'S') shape = 4;
                        else if(c.shape == 'D') shape = 3;
                        else if(c.shape == 'H') shape = 2;
                        else if(c.shape == 'C') shape = 1;
                    }
                    break;
                }
            }
        }

        for(var i=0;i<check2.length;i++) {
            if(check2[i] == 0) {
                return null;
            }
        }

        for(var c of this.cards) {
            for(var i = 0;i<check.length;i++) {
                if(check[i] == c.number && check2[i] > 0) {
                    c.isShow = true;
                    break;
                } else {
                    c.isShow = false;
                }
            }
        }


        this.result = {
            madeLevel : 6,
            madeExtra : top * 10 + shape
        }
        return this.result;
        
    }

    isBst() {
        //마운틴이랑 비슷하게? // level = 7
        let check = [5, 4, 3, 2, 1];
        let check2 = [0, 0, 0, 0, 0];
        let top = 14;
        let shape = 0;
        for(var c of this.cards) {
            for(var i=0;i<check.length;i++) {
                if(check[i] == c.number) {
                    check2[i]+=1;
                    if(check[i] == 1) {
                        if(c.shape == 'S') shape = 4;
                        else if(c.shape == 'D') shape = 3;
                        else if(c.shape == 'H') shape = 2;
                        else if(c.shape == 'C') shape = 1;
                    }
                    break;
                }
            }
        }

        for(var i=0;i<check2.length;i++) {
            if(check2[i] == 0) {
                return null;
            }
        }

        for(var c of this.cards) {
            for(var i = 0;i<check.length;i++) {
                if(check[i] == c.number && check2[i] > 0) {
                    c.isShow = true;
                    break;
                } else {
                    c.isShow = false;
                }
            }
        }


        this.result = {
            madeLevel : 7,
            madeExtra : top * 10 + shape
        };
        return this.result;

    }

    isSt() {
        //level = 8
        let check = [];
        let shape = [];
        let resultShape = 0;
        let top = 0;
        for(var c of this.cards) {
            check[c.number] = true;
            let s=0;
            if(c.shape == 'S') s=4;
            else if(c.shape == 'D') s=3;
            else if(c.shape == 'H') s=2;
            else if(c.shape == 'C') s=1;
            if(shape[c.number] == null  || s > shape[c.number]) {
                shape[c.number] = s;
            }
        }

        for(var i=9;i>=2;i--) {
            let hasStraight = true;
            for(var j=0;j<=4;j++) {
                if(!check[i+j]) {
                    hasStraight = false;
                    break;
                }
            }
            if(hasStraight) {
                resultShape = shape[i+4];
                top = i+4;
                break;
            } 
        }

        if(top == 0 || resultShape == 0) {
            return null;
        }

        for(var c of this.cards) {
            for(var i = top; i>=top-4;i--) {
                if(c.number == i) {
                    c.isShow = true;
                    break;
                } else {
                    c.isShow = false;
                }
            }
        }

        this.result = {
            madeLevel : 8,
            madeExtra : top * 10 + resultShape
        };
        return this.result;
    }

    isFc() { //level =3
        let check = [];
        for(var c of this.cards) {
            if(check[c.number] == null) {
                check[c.number] = 1;
            } else {
                check[c.number] += 1;
            }
        }
        for(var i of Object.keys(check)) {
            if(check[i] >= 4) {
                for(var c of this.cards) {
                    if(c.number == i) {
                        c.isShow = true;
                    } else {
                        c.isShow = false;
                    }
                }

                let k = parseInt(i) == 1 ? 14 : parseInt(i);
                this.result = {
                    madeLevel : 3,
                    madeExtra : k
                };
                return this.result;
            }
        }
        return null;
    }

    isFh() { // level = 4
        let check = [];
        let extra = 0;
        let first = 0;
        let second = 0;
        let hasFullHouse = false;
        for(var c of this.cards) {
            if(check[c.number] == null) {
                check[c.number] = 1;
            } else {
                check[c.number] += 1;
                if(check[c.number] >= 3 && c.number > extra) {
                    first = c.number;
                    let k = c.number == 1 ? 14 : c.number;
                    extra = k;
                }
            }
        }
        for(var i of Object.keys(check)) {
            if(first != i && check[i] >= 2) {
                hasFullHouse = true;
                second = i; 
                break; 
            }
        }
        if(!hasFullHouse || extra == 0) {
            return null;
        }
        for(var c of this.cards) {
            if(c.number == first || c.number == second) {
                c.isShow = true;
            } else {
                c.isShow = false;
            }
        }

        this.result = {
            madeLevel : 4,
            madeExtra : extra
        }
        return this.result;
    }

    isFl() { //level 5
        let sh = [0, 0, 0, 0];
        let extra = 0;
        for(var c of this.cards) {
            if(c.shape == 'S') sh[3] += 1;
            else if(c.shape == 'D') sh[2] += 1;
            else if(c.shape == 'H') sh[1] += 1;
            else if(c.shape == 'C') sh[0] += 1;
        }


        for(var i=0;i<4;i++) {
            if(sh[i]>=5) {                    
                extra = i + 1;
            }
        }

        if(extra == 0) {
            return null;
        }

        let mul = 10000000000;
        let shape = '';
        if(extra == 4) shape = 'S';
        else if(extra == 3) shape = 'D';
        else if(extra == 2) shape = 'H';
        else if(extra == 1) shape = 'C';
        for(var c of this.cards) {
            if(c.shape == shape) {
                c.isShow = true;
            } else {
                c.isShow = false;
            }
            if(c.shape == shape && mul >= 10) {
                let k = c.number == 1 ? 14 : c.number;
                extra += k * mul * 0.1;
                mul /= 100;
            }
        }


        this.result = {
            madeLevel : 5,
            madeExtra : extra
        };
        return this.result;
    }

    isTr() {
        let check = [];
        for(var c of this.cards) {
            if(check[c.number] == null) {
                check[c.number] = 1;
            } else {
                check[c.number] += 1;
            }
        }
        for(var i of Object.keys(check)) {
            if(check[i] >= 3) {

                for(var c of this.cards) {
                    if(c.number == i) {
                        c.isShow = true;
                    } else {
                        c.isShow = false;
                    }
                }

                let k = parseInt(i) == 1 ? 14 : parseInt(i);
                this.result = {
                    madeLevel : 9,
                    madeExtra : k
                };
                return this.result;
            }
        }
        return null;
    }

    isTwoFair() { //level 10
        let check = [];
        let twoFair = [];
        for(var c of this.cards) {
            if(check[c.number] == null) {
                check[c.number] = 1;
            } else {
                check[c.number] += 1;
            }
        }
        for(var i of Object.keys(check)) {
            if(check[i] == 2) {
                twoFair.push(i);
            }
        }
        if(twoFair.length < 2) {
            return null;
        }

        twoFair.sort((a,b) => b-a);
        let k1 = twoFair[0] == 1 ? 14 : twoFair[0];
        let k2 = twoFair[1] == 1 ? 14 : twoFair[1];
        let extra = k1 * 100000 + k2 * 1000;
        
        let shape;
        let extraShape = 0;
        let otherNumber = 0;
        for(var c of this.cards) {
            if(c.shape == 'S') shape = 4;
            else if(c.shape == 'D') shape = 3;
            else if(c.shape == 'H') shape = 2;
            else if(c.shape == 'C') shape = 1;

            if(c.number == twoFair[0] || c.number == twoFair[1]) {
                c.isShow = true;
            } else {
                c.isShow = false;
            }

            if(c.number == twoFair[0] && shape > extraShape) {
                extraShape = shape;
            }
            if(c.number != twoFair[0] && c.number != twoFair[1] && otherNumber == 0) {
                let k = c.number == 1 ? 14 : c.number;
                otherNumber = k;
            }
        }

        extra += otherNumber * 10 + extraShape;

        this.result = {
            madeLevel : 10, 
            madeExtra : extra
        };

        return this.result;
    }

    isOneFair() {
        let check = [];
        let fair = [];
        for(var c of this.cards) {
            if(check[c.number] == null) {
                check[c.number] = 1;
            } else {
                check[c.number] += 1;
            }
        }
        for(var i of Object.keys(check)) {
            if(check[i] == 2) {
                fair.push(i);
            }
        }
        if(fair.length != 1) {
            return null;
        }

        let extra = fair[0] * 10000000;
        
        let shape;
        let extraShape = 0;
        let mul = 1000000;
        for(var c of this.cards) {
            if(c.shape == 'S') shape = 4;
            else if(c.shape == 'D') shape = 3;
            else if(c.shape == 'H') shape = 2;
            else if(c.shape == 'C') shape = 1;

            if(c.number == fair[0]) {
                c.isShow = true;
            } else {
                c.isShow = false;
            }

            if(c.number == fair[0] && shape > extraShape) {
                extraShape = shape;
            }
            if(c.number != fair[0] && mul >= 10) {
                let k = c.number == 1 ? 14 : c.number;
                extra += k * mul * 0.1;
                mul /= 100;
            }
        }

        extra += extraShape;

        this.result = {
            madeLevel : 11, 
            madeExtra : extra
        };

        return this.result;
    }

    isTop() {
        let mul = 10000000000;
        let extra = 0;
        for(var c of this.cards) {
            if(extra == 0) {
                let shape = 0;
                if(c.shape == 'S') shape = 4;
                else if(c.shape == 'D') shape = 3;
                else if(c.shape == 'H') shape = 2;
                else if(c.shape == 'C') shape = 1;
                extra += shape;
                c.isShow = true;
            } else {
                c.isShow = false;
            }

            if(mul >= 100) {
                let k = c.number == 1 ? 14 : c.number;
                extra += k * mul * 0.1;
                mul /=100;
            }
        }
        
        this.result = {
            madeLevel : 12,
            madeExtra : extra
        };
        return this.result;
    }


    calc() {
        this.sortCards();
        
        if(this.isRsf() != null) {
            return this.result;
        } else if(this.isSf() != null) {
            return this.result;
        } 
        else if(this.isFc() != null) {
            return this.result;
        }
        else if(this.isFh() != null) {
            return this.result;
        }
        else if(this.isFl() != null) {
            return this.result;
        }
        else if(this.isMountine() != null) {
            return this.result;
        }
        else if(this.isBst() != null) {
            return this.result;
        }
        else if(this.isSt() != null) {
            return this.result;
        }
        else if(this.isTr() != null) {
            return this.result;
        }
        else if(this.isTwoFair() != null) {
            return this.result;
        }
        else if(this.isOneFair() != null) {
            return this.result;
        }
        else if(this.isTop() != null) {
            return this.result;
        }
     
    }


    compare(target)  {
        console.log(`my level : ${this.result.madeLevel} / target level : ${target.result.madeLevel}`);
        console.log(`my extra : ${this.result.madeExtra} / target extra : ${target.result.madeExtra}`);
        if(target.result.madeLevel > this.result.madeLevel) {
            return true;
        } else if(target.result.madeLevel < this.result.madeLevel) {
            return false;
        } else {
            if(this.result.madeExtra > target.result.madeExtra) {
                return true;
            } else {
                return false;
            }
        }
    }
}