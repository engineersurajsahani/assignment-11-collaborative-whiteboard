require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const registerBoardHandlers = require('./sockets/boardHandler');
const registerCursorHandlers = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

// Middleware Configuration
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket Connection Lifecycle
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Register Handlers
  registerBoardHandlers(io, socket);
  registerCursorHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Serve index.html for root path
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Initialization
const PORT = process.env.PORT || 5000;

function startServer(port) {
  const onListening = () => {
    console.log(`🚀 Real-Time Whiteboard Server running at http://localhost:${port}`);
    server.off('error', onError);
  };

  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && Number(port) === 5000) {
      console.log(`⚠️ Port 5000 is occupied (e.g. macOS AirPlay/Control Center). Switching to port 5001...`);
      server.off('listening', onListening);
      startServer(5001);
    } else {
      console.error('Server error:', err);
    }
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port);
}

startServer(PORT);



