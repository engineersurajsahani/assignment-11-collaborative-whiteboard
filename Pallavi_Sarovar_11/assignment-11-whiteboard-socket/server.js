const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const registerBoardHandlers = require("./sockets/boardHandler");
const registerCursorHandlers = require("./sockets/cursorHandler");

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory whiteboard state, partitioned by boardId.
const boardRooms = {};

io.on("connection", (socket) => {
  registerBoardHandlers(io, socket, boardRooms);
  registerCursorHandlers(io, socket, boardRooms);

  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    if (!boardId || !boardRooms[boardId]) return;

    const board = boardRooms[boardId];
    const user = board.users[socket.id];

    if (user) {
      socket.to(boardId).emit("user:left", {
        userId: socket.id,
        username: user.username
      });
      delete board.users[socket.id];
    }

    // Remove empty rooms to keep memory usage bounded.
    if (Object.keys(board.users).length === 0) {
      delete boardRooms[boardId];
    }
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Collaborative whiteboard running on http://localhost:${PORT}`);
});
