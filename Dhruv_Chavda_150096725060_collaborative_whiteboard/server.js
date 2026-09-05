const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

const registerBoardHandlers = require('./sockets/boardHandler');
const registerCursorHandlers = require('./sockets/cursorHandler');

// Load environment configuration
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static frontend whiteboard assets
app.use(express.static(path.join(__dirname, 'public')));

// API Health / Status Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🎨 Real-Time Collaborative Whiteboard Socket Server is operational',
    version: '1.0.0'
  });
});

// Socket.io Connection Pipeline
io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  // Register socket event domain handlers
  registerBoardHandlers(io, socket);
  registerCursorHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Collaborative Whiteboard Server running at http://localhost:${PORT}`);
});

module.exports = { app, server, io };
