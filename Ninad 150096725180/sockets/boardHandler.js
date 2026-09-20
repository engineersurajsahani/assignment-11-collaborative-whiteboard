module.exports = (io, socket, boardRooms) => {
    socket.on('board:join', ({ boardId, username, userColor }) => {
        socket.join(boardId);
        
        if (!boardRooms[boardId]) {
            boardRooms[boardId] = {
                boardId: boardId,
                strokes: [],
                users: {}
            };
        }
        
        const room = boardRooms[boardId];
        room.users[socket.id] = { username, color: userColor, cursor: { x: 0, y: 0 } };
        
        socket.emit('board:init', {
            strokes: room.strokes,
            activeUsers: Object.values(room.users)
        });
        
        socket.broadcast.to(boardId).emit('user:joined', {
            userId: socket.id,
            username,
            color: userColor
        });
    });

    socket.on('draw:stroke', ({ boardId, stroke }) => {
        if (boardRooms[boardId]) {
            boardRooms[boardId].strokes.push(stroke);
            socket.broadcast.to(boardId).emit('draw:broadcast', { stroke });
        }
    });

    socket.on('board:clear', ({ boardId }) => {
        if (boardRooms[boardId]) {
            boardRooms[boardId].strokes = [];
            const username = boardRooms[boardId].users[socket.id]?.username || 'Someone';
            io.to(boardId).emit('board:cleared', { clearedBy: username });
        }
    });

    socket.on('draw:undo', ({ boardId }) => {
        if (boardRooms[boardId]) {
            const strokes = boardRooms[boardId].strokes;
            if (strokes.length > 0) {
                const lastStroke = strokes[strokes.length - 1];
                if (lastStroke.pathId) {
                    boardRooms[boardId].strokes = strokes.filter(s => s.pathId !== lastStroke.pathId);
                } else {
                    strokes.pop();
                }
                io.to(boardId).emit('board:sync', { strokes: boardRooms[boardId].strokes });
            }
        }
    });
};
