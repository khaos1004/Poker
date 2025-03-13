const express = require('express');
const app = express();
const http = require('http');
// const { SocketAddress } = require('net');
const Game = require('./game');
const fs = require('fs');
const axios = require('axios'); // axios 추가
const path = require('path');
const { Pool } = require('pg');

// PostgreSQL 연결 풀 설정
const pool = new Pool({
  user: 'postgres',
  host: '1.201.161.233',
  database: 'sotong',
  password: 'postgres',
  port: 5432,
});


// 🔹 1분마다 실행하여 TTR 리워드 지급
// setInterval(async () => {
//   console.log("🔄 1분마다 TTR 리워드 지급 실행...");

//   try {
//     const client = await pool.connect();

//     // 🔹 1분마다 지급할 보상 조회
//     const result = await client.query(`
//           SELECT id, user_id, reward_amount 
//           FROM ttr_rewards
//           WHERE reward_time >= NOW() - INTERVAL '1 minute'
//       `);

//     if (result.rows.length === 0) {
//       console.log(" 지급할 TTR 리워드 없음.");
//       client.release();
//       return;
//     }

//     for (let row of result.rows) {
//       const { id, user_id, reward_amount } = row;

//       // 🔹 현재 연결된 소켓에서 해당 유저의 `to_address` 가져오기
//       let userSocket = [...io.sockets.sockets.values()].find(
//         (s) => s.playerData?.userkey === user_id
//       );
//       let toAddress = userSocket?.playerData?.walletAddress;

//       if (!toAddress) {
//         console.error(`❌ 유저 ${user_id}의 지갑 주소 없음, 지급 건너뜀.`);
//         continue;
//       }

//       // 🔹 API 호출하여 TTR 전송
//       try {
//         const response = await axios.post(
//           'http://1.201.162.165:9000/api/v1/wallet_transfer_to_address',
//           new URLSearchParams({
//             amount_to_transfer: reward_amount.toString(),
//             to_address: toAddress  // 🔹 유저별 `to_address` 적용
//           }),
//           {
//             headers: {
//               'Authorization': '1AA75CC269F33FB15479233CAC6705D2DD0016072F561E1547E4BF731C49C6FD',
//               'Content-Type': 'application/x-www-form-urlencoded'
//             }
//           }
//         );

//         console.log(` 유저 ${user_id} TTR ${reward_amount} 지급 완료 (지갑: ${toAddress})`, response.data);

//       } catch (error) {
//         console.error(`❌ 유저 ${user_id} TTR 전송 실패 (지갑: ${toAddress}):`, error.response?.data || error.message);
//       }
//     }

//     client.release();
//   } catch (err) {
//     console.error("❌ TTR 리워드 지급 중 오류 발생:", err);
//   }
// }, 60000);  // 🔄 1분마다 실행

/**
 * 특정 유저에게 TTR 리워드를 지급하는 API 호출 함수
 * @param {string} userkey - 리워드를 받을 유저키 
 */
async function RewoadToUser(userkey) {
  const apiUrl = 'https://svr.sotong.com/api/v1/reward/game';
  const data = {
    "userkey": userkey,
  };

  try {
    const response = await axios.post(apiUrl, data);

    if (response.status === 200) {
      console.log(`리워드 지급 성공! 사용자: ${userkey}`);
      return;
    } else {
      console.error(`리워드 지급 실패 (상태 코드: ${response.status})`, response.data);
    }
  } catch (error) {
    console.error(` 리워드 지급 API 호출 오류 ${error}`);
  }
}

// const server = https.createServer(options, app);
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use('/assets', express.static(__dirname + '/assets'));
let game = new Map();

// app.get('/dev', (req, res) => {
//   res.sendFile(__dirname + '/index.html');
// });

app.get('/', (req, res) => {
  const { name, nyang, userkey } = req.query; // 쿼리 파라미터 추출  
  console.log(`Player Name: ${name}, Bet: ${nyang}`);
  // index.html 파일 경로
  const filePath = path.join(__dirname, 'index2.html');

  // HTML 파일 읽기
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      console.error("Error reading HTML file:", err);
      res.status(500).send("Error loading page");
      return;
    }

    // HTML 파일에 데이터를 삽입
    const updatedHtml = html.replace(
      '<script id="server-data"></script>',
      `<script id="server-data">        
        const playerName = "${name}";
        const nyang = ${nyang};  
        const userkey = "${userkey}";      
      </script>`
    );

    // 수정된 HTML 전송
    res.send(updatedHtml);
  });
  // res.sendFile(__dirname + '/index2.html');
});

io.on('connection', (socket) => {

  const referer = socket.handshake.headers.referer;
  const urlParams = new URLSearchParams(new URL(referer).search);
  const name = urlParams.get('name');
  const userkey = urlParams.get('userkey');
  const nyang = urlParams.get('nyang');
  const walletAddress = urlParams.get('to_address'); // 🔹 유저의 지갑 주소

  // 사용자 이름을 socket 객체에 저장
  socket.playerName = name;

  // 플레이어 데이터 저장
  socket.playerData = {
    name: name,
    userkey: userkey,
    money: nyang, // 게임 머니 저장
    walletAddress: walletAddress
  };

  // socket.on('reward_user', async (userId) => {
  //   try {
  //     const result = await pool.query(`
  //           SELECT * FROM ttr_rewards 
  //           WHERE user_id = $1
  //           ORDER BY reward_time DESC
  //       `, [userId]);

  //     socket.emit('reward_user_response', { rewards: result.rows });
  //   } catch (err) {
  //     console.error(" 보상 조회 실패:", err);
  //     socket.emit('reward_user_response', { error: "보상 정보를 가져올 수 없습니다." });
  //   }
  // });

  // // 🔹 하루 동안 지급된 총 보상 조회
  // socket.on('reward_status', async () => {
  //   try {
  //     const result = await pool.query(`
  //           SELECT COALESCE(SUM(reward_amount), 0) AS total_reward_paid 
  //           FROM ttr_rewards
  //           WHERE reward_time >= NOW() - INTERVAL '1 day'
  //       `);
  //     socket.emit('reward_status_response', { totalRewardPaid: result.rows[0].total_reward_paid });
  //   } catch (err) {
  //     console.error(" 보상 조회 실패:", err);
  //     socket.emit('reward_status_response', { error: "보상 정보를 가져올 수 없습니다." });
  //   }
  // });

  // // 🔹 특정 유저에게 TTR 지급
  // socket.on('reward_pay', async ({ userId, rewardAmount }) => {
  //   if (!userId || !rewardAmount) {
  //     socket.emit('reward_pay_response', { error: "userId와 rewardAmount가 필요합니다." });
  //     return;
  //   }

  //   try {
  //     //  보상 지급 내역 DB에 저장
  //     await pool.query(`
  //           INSERT INTO ttr_rewards (user_id, reward_amount) 
  //           VALUES ($1, $2)
  //       `, [userId, rewardAmount]);

  //     console.log(` ${userId}에게 ${rewardAmount} TTR 지급 완료`);

  //     //  실제 TTR 지급 로직 (외부 API 호출 가능)
  //     // 예제: axios.post('https://external-api.com/ttr/transfer', { userId, amount: rewardAmount });

  //     socket.emit('reward_pay_response', { success: true, message: "TTR 지급 완료" });
  //   } catch (err) {
  //     console.error(" TTR 지급 실패:", err);
  //     socket.emit('reward_pay_response', { error: "TTR 지급 중 오류가 발생했습니다." });
  //   }
  // });

  // 🔹 1분마다 실행하는 함수 (연결된 유저별로 실행)
  const intervalId = setInterval(async () => {

    console.log(`1분마다 RewoadToUser() 실행 (유저: ${userkey})`);
    await RewoadToUser(userkey);
  }, 60000);

  socket.on("uuid_save", (gameUuid) => {
    console.log(` 유저(${socket.id})의 gameUuid 저장: ${gameUuid}`);
    socket.gameUuid = gameUuid;
  });


  socket.on("uuid_response", (gameUuid) => {
    if (gameUuid) {
      console.log(` 서버에서 받은 gameUuid: ${gameUuid}`);
      storedGameUuid = gameUuid; // 🔹 변수에 저장
    } else {
      console.warn("서버에서 gameUuid를 찾을 수 없음.");
    }
  });

  socket.on("get_uuid", () => {
    if (socket.gameUuid) {
      console.log(`🔹 유저(${socket.id})의 gameUuid 반환: ${socket.gameUuid}`);
      socket.emit("uuid_response", socket.gameUuid);
    } else {
      console.warn(`⚠️ 유저(${socket.id})의 gameUuid 없음`);
      socket.emit("uuid_response", null);
    }
  });

  socket.emit('welcome', {
    id: socket.id,
    username: name,
    money: socket.playerData.money,
  });

  socket.on('room_join', ({ id }) => {
    socket.join(id);

    // 현재 방에 있는 모든 유저 목록 가져오기
    let users = Array.from(io.sockets.adapter.rooms.get(id) || []).map(userId => ({
      id: userId,
      name: io.sockets.sockets.get(userId)?.playerName || "알 수 없음"
    }));

    // 방장 설정 (방에서 첫 번째 유저를 방장으로 지정)
    let hostId = users.length > 0 ? users[0].id : null;

    // 클라이언트에 정확한 유저 정보 전달
    io.sockets.in(id).emit('user_info', {
      users: users,
      hostId: hostId,
      result: "success"
    });

    console.log(`방 입장: ${socket.id} (${socket.playerName}) -> ROOM ID<${id}>`);
    socket.emit('room_join', {
      result: "success"
    });
  });


  //  방을 나갈 때 정확하게 목록에서 제거
  socket.on('room_leave', ({ id }) => {
    console.log(`방 나가기 요청: ${socket.id} (${socket.playerName}) -> ROOM ID<${id}>`);

    socket.leave(id);

    let users = Array.from(io.sockets.adapter.rooms.get(id) || []).map(userId => ({
      id: userId,
      name: io.sockets.sockets.get(userId)?.playerName || "알 수 없음"
    }));

    // 방장이 나가면 새로운 방장 설정
    let hostId = users.length > 0 ? users[0].id : null;

    io.sockets.in(id).emit('user_info', {
      users: users.map(user => ({ id: user.id, name: user.name })),
      hostId: hostId,
      result: "success"
    });

    socket.emit("room_leave", {
      result: "success"
    });

    console.log(`${socket.id}가 ROOM ID<${id}>에서 나감.`);
  });



  socket.on("choice", ({ cards }) => {
    if (socket.rooms.size < 2) {
      return;
    }
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    game.get(roomId).choice(io, roomId, socket.id, cards, Array.from(users));

  });

  socket.on("game_start", ({ id }) => {
    if (socket.rooms.size < 2) {
      return;
    }
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    console.log(`GAME START, room id = ${roomId}, users len = ${users.size}`);

    if (!game.has(roomId)) {
      game.set(roomId, new Game());
    }

    game.get(roomId).init();
    game.get(roomId).start(io, Array.from(users));

    console.log(`게임 시작 요청: 방 ID = ${id}`);

    // 방에 있는 모든 플레이어에게 게임 시작 이벤트 전송
    io.sockets.in(id).emit("game_start");

    // 방장이 게임을 시작하면 모든 플레이어의 나가기 버튼을 숨김
    io.sockets.in(id).emit("disable_exit_button");
  });

  socket.on("betting", ({ userId, type }) => {
    if (socket.rooms.size < 2) {
      return;
    }
    console.log('betting ' + userId + ", type " + type)
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    game.get(roomId).betting(io, roomId, Array.from(users), userId, type);

  });

  socket.on('get_room_list', () => {
    const rooms = Array.from(io.sockets.adapter.rooms).filter(room => !room[1].has(room[0]));
    const roomList = rooms.map(([roomId, users]) => ({
      roomId,
      userCount: users.size
    }));
    socket.emit('room_list', { rooms: roomList });
  });


  socket.on("game_restart", ({ id }) => {
    console.log(`game_restart 요청 수신 - 방 ID: ${id}`);

    if (!game.has(id)) {
      console.log(`방 ${id}에 대한 기존 게임 없음, 새 게임 생성`);
      game.set(id, new Game());
    } else {
      console.log(`방 ${id}의 기존 게임을 유지하며 다시 시작`);
      let oldUserMoney = game.get(id).userMoney; //  기존 보유 금액 저장
      game.get(id).init();
      game.get(id).userMoney = oldUserMoney; //  기존 보유 금액 유지
    }

    let users = Array.from(io.sockets.adapter.rooms.get(id) || []);
    console.log(`게임 다시 시작 - 방 ID: ${id}, 참가자 수: ${users.length}`);

    if (users.length === 0) {
      console.error("ERROR: 방에 참가자가 없습니다. 게임을 다시 시작할 수 없음.");
      return;
    }

    io.sockets.in(id).emit("game_start");

    // 모든 플레이어에게 새로운 게임이 시작되었음을 알림
    game.get(id).start(io, users);
  });





  socket.on('disconnecting', () => {
    if (socket.rooms.size < 2) {
      return;
    }
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    users.delete(socket.id);
    io.sockets.in(roomId).emit('user_info', {
      users: Array.from(users),
      result: "success"
    });
  });

  socket.on('disconnect', () => {
    console.log("a user disconnected, " + socket.id);
    clearInterval(intervalId);
  });

});



server.listen(3005, () => {
  console.log('tomato poker server listening on *:3005');

});