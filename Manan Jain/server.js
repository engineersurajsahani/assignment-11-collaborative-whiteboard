require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const boardHandler = require('./sockets/boardHandler');
const cursorHandler = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Attach Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory board state storage
// Structure:
// {
//   [boardId]: {
//     boardId: string,
//     strokes: Array<stroke>,
//     users: { [socketId]: { socketId, username, color, cursor: { x, y } } }
//   }
// }
const boardRooms = {};

// Socket connection handler
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register socket sub-handlers
  boardHandler(io, socket, boardRooms);
  cursorHandler(io, socket, boardRooms);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Whiteboard Server running on http://localhost:${PORT}`);
});
