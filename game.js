
const Result = require('./result');
const axios = require('axios'); // axios 추가

let dailyTotalDealerTips = 0;
let dailyTotalGameMinutes = 0;
let totalRewardPaid = 0;
let minTTRPerMinute = 16.6;
let storedGameUuid = null; // 🔹 `gameUuid`를 저장할 변수

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

    // async gameOver(io, roomId, userList, userCard, startTime) {
    //     console.log("game over!!!");

    //     let totalDealerTip = this.pot * 0.05; // 💰 딜러팁 5% 차감
    //     let gameDurationMinutes = 10;
    //     socket.emit("get_uuid"); // 🔹 서버에 저장된 `gameUuid` 요청

    //     try {
    //         const client = await pool.connect();

    //         // 🔹 1일 총 딜러팁 & 게임 시간 조회
    //         const totalData = await client.query(`
    //             SELECT 
    //                 COALESCE(SUM(total_dealer_tips), 0) AS daily_dealer_tips,
    //                 COALESCE(SUM(EXTRACT(EPOCH FROM total_play_time) / 60), 0) AS daily_game_minutes
    //             FROM game_sessions
    //             WHERE start_time >= NOW() - INTERVAL '1 day'
    //         `);

    //         let dailyTotalDealerTips = totalData.rows[0].daily_dealer_tips;
    //         let dailyTotalGameMinutes = totalData.rows[0].daily_game_minutes;

    //         // 🔹 TTR 1분당 지급 계산
    //         let ttrPerMinute = (dailyTotalDealerTips * 0.7) / dailyTotalGameMinutes / 100000;

    //         // 🔹 50만원 지급 여부 확인
    //         const totalRewardPaidData = await client.query(`
    //             SELECT COALESCE(SUM(reward_amount), 0) AS total_reward_paid
    //             FROM ttr_rewards
    //             WHERE reward_time >= NOW() - INTERVAL '1 day'
    //         `);
    //         let totalRewardPaid = totalRewardPaidData.rows[0].total_reward_paid;

    //         // 🔹 50만원 초과한 적이 있는지 확인
    //         let hasExceeded50k = totalRewardPaid >= 500000;

    //         // 🔹 50만원 초과 전이면 최소 지급 1분당 16.6원 적용
    //         if (!hasExceeded50k && ttrPerMinute < 16.6) {
    //             ttrPerMinute = 16.6;
    //         }

    //         // 🔹 게임 세션 저장
    //         await client.query(`
    //             INSERT INTO game_sessions (room_id, start_time, end_time, total_play_time, total_dealer_tips, ttr_per_minute)
    //             VALUES ($1, $2, NOW(), $3, $4, $5)
    //         `, [roomId, startTime, `${gameDurationMinutes} minutes`, totalDealerTip, ttrPerMinute]);

    //         console.log(" 게임 세션 저장 완료");

    //         // 🔹 **TTR 보상 지급 내역 저장**
    //         for (let user of userList) {
    //             let userId = io.sockets.sockets.get(user)?.playerData?.userkey || "unknown";
    //             let rewardAmount = gameDurationMinutes * ttrPerMinute;

    //             if (totalRewardPaid + rewardAmount > 500000) {
    //                 console.log(` 50만원 초과하여 ${userId}에게 지급 중단.`);
    //                 continue;
    //             }

    //             await client.query(`
    //                 INSERT INTO ttr_rewards (user_id, reward_amount)
    //                 VALUES ($1, $2)
    //             `, [userId, rewardAmount]);

    //             console.log(` [보상 기록] 유저 ${userId} - ${rewardAmount} TTR`);
    //         }

    //         console.log(" 보상 지급 내역 저장 완료");
    //         client.release();
    //     } catch (err) {
    //         console.error(" 데이터베이스 오류:", err);
    //     }

    // gameOver(io, roomId, userList, userCard) {
    //     console.log("game over!!!");

    //     let winner;
    //     let totalPot = this.pot; // 현재 팟 머니
    //     let dealerTip = Math.floor(totalPot * 0.05); // 팟 머니의 5% (소수점 버림)
    //     let winnerAmount = totalPot - dealerTip; // 나머지를 승자에게 지급

    //     socket.emit("get_uuid"); // 🔹 서버에 저장된 `gameUuid` 요청

    //     for (var u of userList) {
    //         if (this.callList[u] < 0) {
    //             continue;
    //         }
    //         let cards = userCard[u];
    //         let r1 = new Result(cards);
    //         let win = 0;

    //         r1.calc();
    //         for (var u2 of userList) {
    //             if (this.callList[u2] < 0) {
    //                 win += 1;
    //                 continue;
    //             }
    //             if (u == u2) {
    //                 continue;
    //             }
    //             let cards2 = userCard[u2];
    //             let r2 = new Result(cards2);
    //             r2.calc();

    //             if (r1.compare(r2)) {
    //                 win += 1;
    //             }
    //         }
    //         console.log(`winnner info : user ${u}  win ${win}  userlist len  ${userList.length}`);
    //         if (win == userList.length - 1) {
    //             winner = u;
    //         }
    //     }

    //     console.log(`🎉 승리자: ${winner}`);
    //     console.log(`💰 총 팟: ${totalPot},  딜러 팁 (5%): ${dealerTip},  승리자 지급 금액: ${winnerAmount}`);

    //     const requestData = {
    //         gameId: storedGameUuid,
    //         dealerTipAmount: dealerTip.toFixed(2) // 🔹 서버에 실제 차감된 딜러팁 전송
    //     };

    //     fetch('https://svr.sotong.com/api/v1/games/termination', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify(requestData)
    //     })
    //         .then(response => {
    //             if (response.status === 200) {
    //                 console.log("호출 성공")
    //             }
    //         })
    //         .catch(error => console.error('에러 발생:', error));

    //     console.log(`winner is ${winner}`);
    //     console.log(` 총 팟: ${totalPot},  딜러 팁 (5%): ${dealerTip},  승리자 금액: ${winnerAmount}`);

    //     // 승자에게 팟 머니 지급 (5% 제외)
    //     if (winner) {
    //         this.userMoney[winner] += winnerAmount;
    //     }

    //     // 클라이언트에게 결과 전송
    //     io.sockets.in(roomId).emit('gameover', {
    //         userList: userList,
    //         userCard: userCard,
    //         winner: winner,
    //         dealerTip: dealerTip, // 딜러 팁 정보 추가
    //         userMoney: this.userMoney
    //     });

    //     // 팟 초기화
    //     this.pot = 0;
    // }

    gameOver(io, roomId, userList, userCard) {
        console.log("game over!!!");

        let winner;
        let totalPot = this.pot; // 총 팟 머니
        let dealerTip = Math.floor(totalPot * 0.05); // 딜러 팁 (5% 차감)
        let winnerAmount = totalPot - dealerTip; // 승리자가 가져갈 금액

        socket.emit("get_uuid"); // 🔹 서버에 저장된 `gameUuid` 요청

        // 승리자 찾기
        for (var u of userList) {
            if (this.callList[u] < 0) {
                continue; // 다이한 플레이어는 제외
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
                winner = u;
            }
        }

        console.log(`🎉 승리자: ${winner}`);
        console.log(`💰 총 팟: ${totalPot},  딜러 팁 (5%): ${dealerTip},  승리자 지급 금액: ${winnerAmount}`);

        // **API 요청 데이터 준비**
        const terminationData = {
            gameId: storedGameUuid,
            dealerTipAmount: dealerTip.toFixed(2) // 승리자는 5% 포함
        };

        let gamersData = [];

        userList.forEach(user => {
            let userData = {
                userkey: io.sockets.sockets.get(user)?.playerData?.userkey || "unknown",
                nyangAmount: this.userMoney[user], // 최종 잔액
                dealerTipAmount: user === winner ? dealerTip.toFixed(2) : "0.00" // 승리자는 5%, 패배자는 0
            };
            gamersData.push(userData);
        });

        const nyangData = {
            gamers: gamersData
        };

        // **승리자 & 패배자 API 호출**
        fetch('https://svr.sotong.com/api/v1/games/result/initiation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nyangData)
        })
            .then(response => response.json())
            .then(data => {
                console.log('게임 결과 API 응답:', data);
            })
            .catch(error => {
                console.error('게임 결과 API 호출 실패:', error);
            });

        fetch('https://svr.sotong.com/api/v1/games/termination', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(terminationData)
        })
            .then(response => {
                if (response.status === 200) {
                    console.log("게임 종료 API 호출 성공");
                }
            })
            .catch(error => console.error('게임 종료 API 호출 실패:', error));

        // 승리자에게 팟 머니 지급 (5% 제외)
        if (winner) {
            this.userMoney[winner] += winnerAmount;
        }

        // 클라이언트에게 결과 전송
        io.sockets.in(roomId).emit('gameover', {
            userList: userList,
            userCard: userCard,
            winner: winner,
            dealerTip: dealerTip, // 딜러 팁 정보 추가
            userMoney: this.userMoney
        });

        // 팟 초기화
        this.pot = 0;
    }


}