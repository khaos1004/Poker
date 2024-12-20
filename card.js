

module.exports = () => {

    let cards = [];

    class Card {
        constructor(shape, number) {
            this.shape = shape;
            this.number = number;
            this.isShow = false;
        }
    }


    function init() {
        cards = [];
        for(var i=1;i<=13;i++) {
            let s = "S"
            cards.push(new Card(s, i));
        }
        for(var i=1;i<=13;i++) {
            let s = "D"
            cards.push(new Card(s, i));
        }
        for(var i=1;i<=13;i++) {
            let s = "H"
            cards.push(new Card(s, i));
        }
        for(var i=1;i<=13;i++) {
            let s = "C"
            cards.push(new Card(s, i));
        }
    }

    function suffle() {
        cards.sort(() => Math.random() - 0.5);
        console.log('suffle is complete');
    }

    function choice() {
        let choiceCard = [];
        choiceCard.push(cards.pop());
        choiceCard.push(cards.pop());
        choiceCard.push(cards.pop());
        choiceCard.push(cards.pop());
        return choiceCard;        
    }

    function openPop() {
        let openCard = cards.pop();
        openCard.isShow = true;
        return openCard;
    }


    function run() {
        console.log("run");
    }


    return {
        Card: Card,
        init: init,
        suffle, suffle,
        run : run,
        choice : choice,
        openPop : openPop,
    }
};