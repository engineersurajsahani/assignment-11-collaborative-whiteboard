const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

require("dotenv").config();

const connectDB = require("./config/db");
const { setupBoardSocket } = require("./sockets/boardHandler");
const { setupCursorSocket } = require("./sockets/cursorHandler");
const { flushPersistBoard, boardRooms } = require("./sockets/store");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e6,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    activeBoards: boardRooms.size,
  });
});

const gracefulShutdown = async () => {
  console.log("\nShutting down — flushing board state to MongoDB...");
  for (const board of boardRooms.values()) {
    await flushPersistBoard(board.boardId);
  }
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

const start = async () => {
  if (process.env.MONGO_URI) {
    const conn = await connectDB();
    if (!conn) {
      console.warn(
        "Warning: could not reach MongoDB — running in-memory only; strokes will be lost on restart."
      );
    }
  } else {
    console.warn("Warning: MONGO_URI is not set — strokes will be kept in memory only.");
  }

  io.on("connection", (socket) => {
    console.log(`user:connect ${socket.id}`);

    setupBoardSocket(io, socket);
    setupCursorSocket(io, socket);
  });

  const PORT = process.env.PORT || 5000;
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use (e.g. macOS AirPlay/ControlCenter). ` +
          `Set a different PORT in .env and retry.`
      );
    } else {
      console.error("Server error:", error.message);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`\nWhiteboard server running at http://localhost:${PORT}`);
    console.log(`Open two windows at http://localhost:${PORT}?board=demo to collaborate\n`);
  });
};

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});