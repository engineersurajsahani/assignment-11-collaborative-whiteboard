const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const { registerBoardHandlers } = require("./sockets/boardHandler");
const { registerCursorHandlers } = require("./sockets/cursorHandler");

const app = express();
const server = http.createServer(app);

// Enable CORS for Express
app.use(cors());

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, "public")));

// Initialize Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket connection lifecycle
io.on("connection", (socket) => {
  // Register board events (join, stroke, clear, undo, disconnect)
  registerBoardHandlers(io, socket);

  // Register cursor tracking events
  registerCursorHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `⚠️ Port ${PORT} is already in use. Note: On macOS, port 5000 is used by AirPlay Receiver. You can set PORT=5001 in your .env file or environment.`
    );
  } else {
    console.error("Server error:", err);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
