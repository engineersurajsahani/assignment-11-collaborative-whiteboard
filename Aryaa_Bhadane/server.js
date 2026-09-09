/**
 * server.js
 * Express & Socket.io Server Bootstrap for Real-Time Collaborative Whiteboard
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const { registerBoardHandlers } = require('./sockets/boardHandler');
const { registerCursorHandlers } = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

// CORS configuration for REST API & Socket.io
const CORS_ORIGIN = process.env.CLIENT_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Serve static frontend assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io initialization attached to raw HTTP server
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  },
  // Optimize for low-latency WebSocket communication
  transports: ['websocket', 'polling']
});

// Central in-memory whiteboard store
// Schema: { [boardId: string]: { boardId: string, strokes: Array, users: { [socketId: string]: Object } } }
const boardRooms = {};

// Socket.io connection lifecycle
io.on('connection', (socket) => {
  console.log(`[connection] New client connected: ${socket.id}`);

  // Register modular socket handlers
  registerBoardHandlers(io, socket, boardRooms);
  registerCursorHandlers(io, socket, boardRooms);
});

// Health check endpoint for uptime monitoring & Render deployment checks
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    activeRooms: Object.keys(boardRooms).length,
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for SPA/query param routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const net = require('net');

// Helper to check port availability before binding
function getAvailablePort(startingPort) {
  return new Promise((resolve) => {
    // If PORT is explicitly set in env (e.g. Render), honor it directly
    if (process.env.PORT) {
      return resolve(parseInt(process.env.PORT, 10));
    }

    const testServer = net.createServer();
    testServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Port Check] Port ${startingPort} is occupied. Trying port ${startingPort + 1}...`);
        resolve(getAvailablePort(startingPort + 1));
      } else {
        resolve(startingPort);
      }
    });
    testServer.once('listening', () => {
      testServer.close(() => resolve(startingPort));
    });
    testServer.listen(startingPort);
  });
}

const DEFAULT_PORT = 5000;

getAvailablePort(DEFAULT_PORT).then((port) => {
  server.listen(port, () => {
    console.log(`=================================================`);
    console.log(` Collaborative Whiteboard Server Running `);
    console.log(` Local URL: http://localhost:${port}`);
    console.log(` Port: ${port}`);
    console.log(`=================================================`);
  });
});

module.exports = { app, server, boardRooms, io };
