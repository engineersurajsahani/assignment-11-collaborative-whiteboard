/**
 * server.js
 * Express + Socket.io Server Bootstrap for Collaborative Whiteboard
 */

require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { registerBoardHandlers } = require('./sockets/boardHandler');
const { registerCursorHandlers } = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

// Enable CORS for Express
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

// Configure Socket.io with permissive CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket connection pipeline
io.on('connection', (socket) => {
  // Register modular event handlers
  registerBoardHandlers(io, socket);
  registerCursorHandlers(io, socket);
});

// Dynamic Port Configuration
// Dynamic Port Configuration
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;

function listenOnAvailablePort(port) {
  server.removeAllListeners('error');
  server.removeAllListeners('listening');

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`⚠️  Port ${port} is in use. Trying port ${nextPort}...`);
      listenOnAvailablePort(nextPort);
    } else {
      console.error('Server failed to start:', err);
    }
  });

  server.once('listening', () => {
    const actualPort = server.address().port;
    console.log(`🚀 Server listening on port ${actualPort}`);
    console.log(`👉 Open in browser: http://localhost:${actualPort}`);
  });

  server.listen(port);
}

listenOnAvailablePort(DEFAULT_PORT);


