module.exports = (io, socket, boardRooms) => {
    socket.on('cursor:move', ({ boardId, x, y }) => {
        if (boardRooms[boardId] && boardRooms[boardId].users[socket.id]) {
            boardRooms[boardId].users[socket.id].cursor = { x, y };
            socket.broadcast.to(boardId).emit('cursor:update', {
                userId: socket.id,
                x,
                y
            });
        }
    });
};
