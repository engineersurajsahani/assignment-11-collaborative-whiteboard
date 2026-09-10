require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const boardHandler = require('./sockets/boardHandler');
const cursorHandler = require('./sockets/cursorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.get('/api/health', (_, res) => res.json({ status:'ok', service:'collaborative-whiteboard' }));

const boardRooms = new Map();
io.on('connection', socket => {
  boardHandler(io, socket, boardRooms);
  cursorHandler(io, socket, boardRooms);
});

server.listen(PORT, () => console.log(`Whiteboard running at http://localhost:${PORT}`));
