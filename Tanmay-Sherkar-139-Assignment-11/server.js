require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const registerBoardHandlers = require('./sockets/boardHandler');
const registerCursorHandlers = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
const boardRooms = {};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    roomsCount: Object.keys(boardRooms).length
  });
});

io.on('connection', (socket) => {
  registerBoardHandlers(io, socket, boardRooms);
  registerCursorHandlers(io, socket, boardRooms);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = {
  app,
  server,
  io,
  boardRooms
};
