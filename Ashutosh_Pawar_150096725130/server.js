require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const registerBoardHandlers = require("./sockets/boardHandler");
const registerCursorHandlers = require("./sockets/cursorHandler");

const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const boardRooms = {};

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);
  registerBoardHandlers(io, socket, boardRooms);
  registerCursorHandlers(io, socket, boardRooms);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`whiteboard server is running on port ${PORT}!!`);
});
