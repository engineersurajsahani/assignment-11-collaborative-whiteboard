/**
 * server.js
 * Express.js & Socket.io server bootstrap for Real-Time Collaborative Whiteboard
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const registerBoardHandlers = require("./sockets/boardHandler");
const registerCursorHandlers = require("./sockets/cursorHandler");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Server-side Board State (in-memory, keyed by boardId)
const boardRooms = {
  "DESIGN_101": {
    boardId: "DESIGN_101",
    strokes: [],
    users: {}
  }
};

// Socket Connection Listener
io.on("connection", (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Register modular socket handlers
  registerBoardHandlers(io, socket, boardRooms);
  registerCursorHandlers(io, socket, boardRooms);

  // Handle peer disconnect
  socket.on("disconnect", () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    const { boardId, username } = socket;

    if (boardId && boardRooms[boardId] && boardRooms[boardId].users[socket.id]) {
      // Delete user entry from room memory
      delete boardRooms[boardId].users[socket.id];

      // Broadcast user departure to remaining room members
      io.to(boardId).emit("user:left", {
        userId: socket.id,
        username: username || "Guest"
      });
    }
  });
});

// Port configuration (reads process.env.PORT from environment, default 5000)
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎨 Collaborative Whiteboard Server Running on Port ${PORT}`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});


