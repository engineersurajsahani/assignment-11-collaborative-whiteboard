require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { registerBoardHandlers } = require('./sockets/boardHandler');
const { registerCursorHandlers } = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT, 10) || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Socket.io Server Setup
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

// Socket Connection Lifecycle
io.on('connection', (socket) => {
  registerBoardHandlers(io, socket);
  registerCursorHandlers(io, socket);
});

// Robust Server Starter with Port Fallback
function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`===========================================`);
    console.log(` Real-Time Collaborative Whiteboard Server `);
    console.log(` Listening on: http://localhost:${portToTry}     `);
    console.log(` Demo URL:     http://localhost:${portToTry}?board=demo `);
    console.log(`===========================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[WARN] Port ${portToTry} is in use (e.g. macOS AirPlay). Retrying on port ${portToTry + 1}...`);
      server.removeAllListeners('error');
      startServer(portToTry + 1);
    } else {
      console.error('[ERROR] Server startup error:', err);
    }
  });
}

startServer(PORT);

module.exports = { app, server, io };
