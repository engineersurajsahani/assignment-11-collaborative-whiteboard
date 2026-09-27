const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.static('public'));

const handleBoardEvents = require('./sockets/boardHandler');
const handleCursorEvents = require('./sockets/cursorHandler');

io.on('connection', (socket) => {
  handleBoardEvents(io, socket);
  handleCursorEvents(io, socket);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
