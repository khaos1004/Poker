const express = require('express');
const app = express();
const http = require('http');
// const { SocketAddress } = require('net');
const Game = require('./game');
const fs = require('fs');
const axios = require('axios'); // axios 추가
const path = require('path');

// 🔹 SSL 인증서 파일 로드
const options = {
  // key: fs.readFileSync('/opt/game/black/porker/assets/ssl/KeyFile_Wildcard.sotong.com_pem.key'),
  // cert: fs.readFileSync('/opt/game/black/porker/assets/ssl/Wildcard.sotong.com_pem.pem'),
  // ca: fs.readFileSync('/opt/game/black/Blackjack/assets/ssl/intermediate.pem') 
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

  // 1분마다 API 요청 보내기
  // const intervalId = setInterval(async () => {
  //   try {
  //     const response = await axios.post('https://svr.sotong.com/api/v1/rewards/game', {
  //     // const response = await axios.post('http://localhost:8080/api/v1/rewards/game', {
  //     });
  //     console.log(`API Response for ${socket.id}:`, response.data);
  //     // 소켓에 API 응답 보내기 (옵션)
  //     // socket.emit('api_data', response.data);
  //   } catch (error) {
  //     console.error(`API request failed for ${socket.id}:`, error.message);
  //   }
  // }, 60000); // 60,000ms = 1분

  // 사용자 이름을 socket 객체에 저장
  socket.playerName = name;

  // 플레이어 데이터 저장
  socket.playerData = {
    name: name,
    userkey: userkey,
    money: nyang // 게임 머니 저장
  };

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


  // ✅ 방을 나갈 때 정확하게 목록에서 제거
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
      let oldUserMoney = game.get(id).userMoney; // ✅ 기존 보유 금액 저장
      game.get(id).init();
      game.get(id).userMoney = oldUserMoney; // ✅ 기존 보유 금액 유지
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
  });

});



server.listen(3005, () => {
  console.log('tomato poker server listening on *:3005');

});