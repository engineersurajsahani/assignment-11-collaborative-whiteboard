const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { setupBoardHandlers } = require('./sockets/boardHandler');
const { setupCursorHandlers } = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Root Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Collaborative Whiteboard API' });
});

// Socket.io Connection Router
io.on('connection', (socket) => {
  setupBoardHandlers(io, socket);
  setupCursorHandlers(io, socket);
});

// Render-ready server listener
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});