require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const { registerBoardHandlers } = require("./sockets/boardHandler");
const { registerCursorHandlers } = require("./sockets/cursorHandler");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerBoardHandlers(io, socket);
  registerCursorHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Collaborative whiteboard server running at http://localhost:${PORT}`);
});
