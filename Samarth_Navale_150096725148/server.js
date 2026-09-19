require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { setupBoardHandler } = require('./sockets/boardHandler');
const { setupCursorHandler } = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Collaborative Whiteboard Server is active',
    student: {
      name: 'Samarth Navale',
      roll_no: '150096725148',
      cohort: 'Sam Altman'
    }
  });
});

io.on('connection', (socket) => {
  setupBoardHandler(io, socket);
  setupCursorHandler(io, socket);
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Whiteboard server running on port ${PORT}`);
  });
}

app.server = server;
app.io = io;

module.exports = app;
