require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const registerBoardHandlers = require('./sockets/boardHandler');
const registerCursorHandlers = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Collaborative Whiteboard server is running' });
});

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Shared per-connection state so board and cursor handlers both know
  // which room this socket has joined, without duplicating join logic.
  const socketState = { boardId: null };

  registerBoardHandlers(io, socket, socketState);
  registerCursorHandlers(io, socket, socketState);

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };
