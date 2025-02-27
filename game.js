
const Result = require('./result');
const axios = require('axios'); // axios 추가

module.exports = class Game {

    init() {
        this.cards = require('./card')();
        this.userCard = new Map();
        this.turn = 3;
        this.betList = {};
        this.callList = {};
        this.betCntList = {};
        this.maxCall = 0;
        this.pot = 0;
        this.defaultPrice = 100;
        this.defaultCount = 1;
        if (!this.userMoney) {
            this.userMoney = {}; // 기존 값이 없을 때만 초기화
        }
    }

    choice(io, roomId, socketId, cards, userList) {
        console.log(`received choice by ${socketId}`);

        this.userCard.set(socketId, cards);

        console.log(this.userCard);

        if (this.userCard.size == userList.length) {
            //all choice complete 
            console.log("all choice complete!!");
            this.sevenTurn(io, roomId, userList);
        }
    }


    start(io, userList) {

        this.cards.init();
        this.cards.suffle();
        this.maxCall = 0;

        for (var u of userList) {

            let playerSocket = io.sockets.sockets.get(u);
            let startingMoney = playerSocket?.playerData?.money || 10000; // URL에서 받은 금액

            // 기존 보유 금액 유지하도록 변경
            if (this.userMoney[u] === undefined) {
                this.userMoney[u] = startingMoney; // 처음 참가한 경우에만 설정
            }

            this.pot += this.defaultPrice;
            this.betList[u] = this.defaultPrice;
            this.callList[u] = 0;
            this.betCntList[u] = this.defaultCount;
            this.userMoney[u] -= this.defaultPrice; // 베팅 금액 차감

            let choiceCard = this.cards.choice();
            io.to(u).emit("choice", {
                cards: choiceCard,
                myMoney: this.userMoney[u] // 플레이어의 보유 금액 전송
            });
        }
    }

    sevenTurn(io, roomId, userList) {
        if (this.turn == 7) {
            let userCard3 = {};
            for (var u of userList) {
                userCard3[u] = [];
                for (var c of this.userCard.get(u)) {
                    userCard3[u].push(c);
                }
            }
            this.gameOver(io, roomId, userList, userCard3);
            return;
        }
        this.turn += 1;
        console.log("sevenTurn(), turn = " + this.turn);

        //GIVE
        let userCard2 = {};
        for (var u of userList) {
            this.userCard.get(u).push(this.cards.openPop());
            userCard2[u] = [];
            for (var c of this.userCard.get(u)) {
                if (c.isShow) {
                    userCard2[u].push(c);
                }
            }

            let myResult = new Result(this.userCard.get(u));
            let myCalcResult = myResult.calc();
            let myLevel = myCalcResult.madeLevel;
            io.to(u).emit('give_my_card_info', {
                cards: this.userCard.get(u),
                level: myLevel
            });
        }
        io.sockets.in(roomId).emit('give_user_card_info', {
            cards: userCard2
        });
        console.log('GIVE END');



        //BOSS
        let bossId = this.whosTheBoss(userList, userCard2);
        console.log("boss is " + bossId);
        io.sockets.in(roomId).emit('boss', {
            bossId: bossId
        });
        console.log('BOSS END');


        //BETTING
        this.updateBettingInfo(io, roomId, bossId, userList, null, null);
    }


    whosTheBoss(userList, userCard) {
        for (var u of userList) {
            if (this.callList[u] < 0) {
                continue;
            }
            let cards = userCard[u];
            let r1 = new Result(cards);
            let win = 0;

            r1.calc();
            for (var u2 of userList) {
                if (this.callList[u2] < 0) {
                    win += 1;
                    continue;
                }
                if (u == u2) {
                    continue;
                }
                let cards2 = userCard[u2];
                let r2 = new Result(cards2);
                r2.calc();

                if (r1.compare(r2)) {
                    win += 1;
                }
            }

            if (win == userList.length - 1) {
                return u;
            }
        }
        return 0;
    }

    updateBettingInfo(io, roomId, currentUserId, userList, userId, type) {
        if (userId == null && type == null) {
            io.sockets.in(roomId).emit('bettingInfo', {
                currentUserId: currentUserId,
                userList: userList,
                pot: this.pot,
                maxCall: this.maxCall,
                callList: this.callList,
                turn: this.turn,
                hasBetCnt: this.betCntList[currentUserId] != 0
            });
            return;
        }

        let myCall = this.maxCall - this.callList[userId];
        let betPrice = this.calcBet(userId, userList, type, myCall);

        console.log(`💰 ${userId} 베팅 금액: ${betPrice}, 베팅 후 남은 금액: ${this.userMoney[userId]}`);

        let nextUserId = this.findNextUserId(userList, currentUserId);
        console.log('next user id = ' + nextUserId);

        io.sockets.in(roomId).emit('bettingInfo', {
            userId: userId,
            userList: userList,
            pot: this.pot,
            maxCall: this.maxCall,
            callList: this.callList,
            betPrice: betPrice,
            turn: this.turn,
            type: type
        });

        if (nextUserId == null) {
            this.maxCall = 0;
            let dieCnt = 0;
            for (var u of userList) {
                if (this.callList[u] >= 0) {
                    this.callList[u] = 0;
                    this.betCntList[u] = this.defaultCount;
                } else {
                    dieCnt += 1;
                }
            }
            if (dieCnt >= userList.length - 1) {
                this.turn = 7;
            }
            this.sevenTurn(io, roomId, userList);
        } else {
            this.updateBettingInfo(io, roomId, nextUserId, userList, null, null);
        }
    }


    findNextUserId(userList, currentUserId) {
        if (this.maxCall == 0) {
            return null;
        }
        let idx = 0;
        for (var i = 0; i < userList.length; i++) {
            if (userList[i] == currentUserId) {
                idx = i;
                break;
            }
        }

        for (let cnt = 0; cnt < userList.length; cnt++) {
            idx += 1;
            if (idx == userList.length) {
                idx = 0;
            }
            let u = userList[idx];
            if (this.callList[u] < 0) { //die case
                continue;
            }

            if (this.betCntList[u] > 0) {
                return u;
            } else if (this.betCntList[u] == 0 && this.callList[u] != this.maxCall) {
                return u;
            }
        }
        return null;
    }


    calcBet(userId, userList, type, myCall) {
        let prevUserId = '';
        for (var i = 0; i < userList.length; i++) {
            if (userList[i] == userId) {
                let idx = i == 0 ? userList.length - 1 : i - 1;
                prevUserId = userList[idx];
                break;
            }
        }

        if (type == 'call') {
            this.callList[userId] += myCall;
        } else if (type == 'die') {
            this.callList[userId] = -1;
        } else if (type == 'half') {
            this.callList[userId] += myCall + Math.round((this.pot + myCall) * 0.5);
        } else if (type == 'quater') {
            this.callList[userId] += myCall + Math.round((this.pot + myCall) * 0.25);
        } else if (type == 'double') {
            this.callList[userId] += this.callList[prevUserId] * 2;
        } else if (type == 'bing') {
            this.callList[userId] += this.defaultPrice;
        }

        let betAmount = this.callList[userId];
        this.userMoney[userId] -= betAmount; // 보유 금액에서 차감
        this.pot += betAmount;
        this.betList[userId] += betAmount;

        if (this.maxCall < this.callList[userId]) {
            this.maxCall = this.callList[userId];
        }

        this.betCntList[userId] -= 1;

        return betAmount; // bet price 반환
    }


    betting(io, roomId, userList, userId, type) {
        io.sockets.in(roomId).emit('betting', {
            userId: userId,
            type: type
        });

        this.updateBettingInfo(io, roomId, userId, userList, userId, type);
    }
    

    gameOver(io, roomId, userList, userCard) {
        console.log("game over!!!");

        let winner = null;
        let resultData = [];

        for (let u of userList) {
            if (this.callList[u] < 0) {
                continue;
            }
            let cards = userCard[u];
            let r1 = new Result(cards);
            let win = 0;

            r1.calc();
            for (let u2 of userList) {
                if (this.callList[u2] < 0) {
                    win += 1;
                    continue;
                }
                if (u === u2) {
                    continue;
                }
                let cards2 = userCard[u2];
                let r2 = new Result(cards2);
                r2.calc();

                if (r1.compare(r2)) {
                    win += 1;
                }
            }

            if (win === userList.length - 1) {
                winner = u;
            }
        }

        // 🛠️ 승자 보유 금액 업데이트 (이 코드가 API 요청 전에 먼저 실행되어야 함)
        if (winner) {
            console.log(`winner is ${winner}`);
            console.log(`이전 보유 금액: ${this.userMoney[winner]}`);
            console.log(`팟 머니: ${this.pot}`);

            this.userMoney[winner] += this.pot;

            console.log(`승리 후 보유 금액: ${this.userMoney[winner]}`); // ✅ 여기 확인
        }

        // 🛠️ 최신 보유 금액을 반영하여 resultData 생성
        for (let u of userList) {
            console.log(`플레이어 ${u} 최종 보유 금액: ${this.userMoney[u]}`);

            resultData.push({
                userkey: io.sockets.sockets.get(u)?.playerData?.userkey || "unknown",
                nyangAmount: this.userMoney[u] || 0
            });
        }

        // 🛠️ API 요청 직전 최종 로그 추가
        console.log('API 요청 데이터 (전송 직전):', JSON.stringify(resultData, null, 2));

        // 게임 결과 API 호출
        axios.post('https://svr.sotong.com/api/v1/games/result', { gamers: resultData }, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                console.log('게임 결과 API 응답:', response.data);
            })
            .catch(error => {
                console.error('게임 결과 API 호출 중 에러 발생:', error);
            });

        // 모든 유저의 최신 보유 금액을 클라이언트로 전달
        io.sockets.in(roomId).emit('gameover', {
            userList: userList,
            userCard: userCard,
            winner: winner,
            userMoney: this.userMoney
        });

        this.pot = 0;
    }

}