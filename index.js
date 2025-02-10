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

app.use('/assets',express.static(__dirname + '/assets'));
let game = new Map();

// app.get('/dev', (req, res) => {
//   res.sendFile(__dirname + '/index.html');
// });

app.get('/', (req, res) => {
  const { name, nyang } = req.query; // 쿼리 파라미터 추출  
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
  const intervalId = setInterval(async () => {
    try {
      const response = await axios.post('https://svr.sotong.com/api/v1/rewards/game', {
      // const response = await axios.post('http://localhost:8080/api/v1/rewards/game', {
      });
      console.log(`API Response for ${socket.id}:`, response.data);
      // 소켓에 API 응답 보내기 (옵션)
      // socket.emit('api_data', response.data);
    } catch (error) {
      console.error(`API request failed for ${socket.id}:`, error.message);
    }
  }, 60000); // 60,000ms = 1분

  // 사용자 이름을 socket 객체에 저장
  socket.playerName = name;

  socket.emit('welcome', {
    id: socket.id,
    username: name
  });

  socket.on('room_join', ({id})=> {
    let room = io.sockets.adapter.rooms.get(id);
    if(room != null) {
        let roomSize =  room.size; 
        console.log(`room<${id}> user length = ${roomSize}`);
        if(roomSize >= 5) {
            socket.emit('room_join', {
                result: "fail",
                error: "full"
            });        
            return;
        }
    }
    
    socket.join(id);
    let users = io.sockets.adapter.rooms.get(id);    
    console.log(users);
    if(users == null) {
        users = [];
    }
    io.sockets.in(id).emit('user_info', {
        users: Array.from(users),
        result:"success"
    });
    
    console.log(`${socket.id} is joined ROOM ID<${id}>.`);
    socket.emit('room_join', {
        result: "success"
    });
  });

  socket.on('room_leave', ({id}) => {
    socket.leave(id);
    let users = io.sockets.adapter.rooms.get(id);    
    console.log(users);
    if(users == null) {
        users = [];
    }
    socket.emit('user_info', {
        users: Array.from(users),
        result:"success"
    });
    io.sockets.in(id).emit('user_info', {
        users: Array.from(users),
        result:"success"
    });
    socket.emit("room_leave", {
        result:"success"
    });
  });

  socket.on("choice", ({cards}) =>  {
    if(socket.rooms.size < 2) {
        return;
    }
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    game.get(roomId).choice(io, roomId, socket.id, cards, Array.from(users));   

  });

  socket.on("game_start", ()=> {
    if(socket.rooms.size < 2) {
        return;
    }
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    console.log(`GAME START, room id = ${roomId}, users len = ${users.size}`);

    if(!game.has(roomId)) {
        game.set(roomId, new Game());   
    }

    game.get(roomId).init();
    game.get(roomId).start(io, Array.from(users));


  });

  socket.on("betting", ({userId, type}) => {
    if(socket.rooms.size < 2) {
        return;
    }
    console.log('betting ' + userId + ", type " + type)
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    game.get(roomId).betting(io, roomId, Array.from(users), userId, type);

  });



  socket.on('disconnecting', ()=>{
    if(socket.rooms.size < 2) {
        return;
    }
    let roomId = Array.from(socket.rooms)[1];
    let users = io.sockets.adapter.rooms.get(roomId);
    users.delete(socket.id);
    io.sockets.in(roomId).emit('user_info', {
        users: Array.from(users),
        result:"success"
    });
  });

  socket.on('disconnect', ()=>{
        console.log("a user disconnected, " + socket.id);
  });

});



server.listen(3005, () => {
  console.log('tomato poker server listening on *:3005');

});