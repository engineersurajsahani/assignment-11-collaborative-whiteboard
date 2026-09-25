require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const { registerBoardHandlers } = require("./sockets/boardHandler");
const { registerCursorHandlers } = require("./sockets/cursorHandler");
const { boardRooms } = require("./sockets/store");

const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Simple health check / room inspection endpoint (handy for debugging & grading).
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptimeSeconds: process.uptime() });
});

app.get("/api/boards/:boardId", (req, res) => {
  const board = boardRooms[req.params.boardId];
  if (!board) {
    return res.json({ boardId: req.params.boardId, strokes: 0, users: 0 });
  }
  res.json({
    boardId: board.boardId,
    strokeCount: board.strokes.length,
    userCount: Object.keys(board.users).length,
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerBoardHandlers(io, socket);
  registerCursorHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`🎨 Whiteboard server running at http://localhost:${PORT}`);
});
