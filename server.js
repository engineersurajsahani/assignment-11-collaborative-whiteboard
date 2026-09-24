require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const registerBoardHandlers = require('./sockets/boardHandler');
const registerCursorHandlers = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  registerBoardHandlers(io, socket);
  registerCursorHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5050;

server.listen(PORT, () => {
  console.log(`Whiteboard server running on http://localhost:${PORT}`);
});