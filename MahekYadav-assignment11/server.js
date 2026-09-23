require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { setupBoardHandlers } = require("./sockets/boardHandler");
const { setupCursorHandlers } = require("./sockets/cursorHandler");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 5000;

const boardRooms = {};

io.on("connection", (socket) => {
  setupBoardHandlers(io, socket, boardRooms);
  setupCursorHandlers(io, socket, boardRooms);
});

server.listen(PORT, () => {
  console.log(`Whiteboard server running at http://localhost:${PORT}`);
});
