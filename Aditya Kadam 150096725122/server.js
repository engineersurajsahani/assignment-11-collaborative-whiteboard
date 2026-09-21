require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const {
  handleBoardJoin,
  handleDrawStroke,
  handleBoardClear,
  handleDrawUndo,
  handleDisconnect
} = require('./sockets/boardHandler');

const { handleCursorMove } = require('./sockets/cursorHandler');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const boardRooms = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('board:join', handleBoardJoin(io, socket, boardRooms));
  socket.on('draw:stroke', handleDrawStroke(io, socket, boardRooms));
  socket.on('cursor:move', handleCursorMove(io, socket, boardRooms));
  socket.on('board:clear', handleBoardClear(io, socket, boardRooms));
  socket.on('draw:undo', handleDrawUndo(io, socket, boardRooms));
  socket.on('disconnect', handleDisconnect(io, socket, boardRooms));
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
