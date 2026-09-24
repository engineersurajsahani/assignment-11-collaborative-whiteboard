require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const boardHandler = require("./sockets/boardHandler");
const cursorHandler = require("./sockets/cursorHandler");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS settings
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// In-Memory Board Store
const boardRooms = {};

// Socket.io Connection Event
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Register socket event handlers
  boardHandler(io, socket, boardRooms);
  cursorHandler(io, socket, boardRooms);

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    activeRooms: Object.keys(boardRooms).length,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Whiteboard server running on http://localhost:${PORT}`);
});

