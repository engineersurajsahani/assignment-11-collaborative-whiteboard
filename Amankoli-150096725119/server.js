require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const boardHandler = require('./sockets/boardHandler');
const cursorHandler = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Connection Router
io.on('connection', (socket) => {
  console.log(`🔌 Whiteboard Peer connected: ${socket.id}`);

  boardHandler(io, socket);
  cursorHandler(io, socket);

  socket.on('disconnect', () => {
    console.log(`❌ Peer disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🎨 Real-Time Whiteboard Server running at http://localhost:${PORT}`);
});
