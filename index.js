const express = require('express');
const app = express();
const http = require('http');
const { SocketAddress } = require('net');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const Game = require('./game');

app.use('/assets',express.static(__dirname + '/assets'));

let game = new Map();


app.get('/dev', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index2.html');
});

io.on('connection', (socket) => {
  console.log('a user connected ' + socket.id);

  socket.emit('welcome', {
    id : socket.id
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



server.listen(3000, () => {
  console.log('tomato poker server listening on *:3000');

});