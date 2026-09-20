const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Whiteboard Store
const boardRooms = {};

const registerBoardHandlers = require('./sockets/boardHandler');
const registerCursorHandlers = require('./sockets/cursorHandler');

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    registerBoardHandlers(io, socket, boardRooms);
    registerCursorHandlers(io, socket, boardRooms);

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const boardId in boardRooms) {
            const room = boardRooms[boardId];
            if (room.users[socket.id]) {
                const username = room.users[socket.id].username;
                delete room.users[socket.id];
                io.to(boardId).emit('user:left', { userId: socket.id, username });
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
