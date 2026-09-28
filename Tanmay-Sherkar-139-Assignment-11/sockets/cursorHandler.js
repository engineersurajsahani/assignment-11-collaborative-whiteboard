const registerCursorHandlers = (io, socket, boardRooms) => {
  socket.on('cursor:move', (payload) => {
    if (!payload || !payload.boardId) return;

    const { boardId, x, y } = payload;
    const room = boardRooms[boardId];

    if (room && room.users[socket.id]) {
      room.users[socket.id].cursor = { x, y };
    }

    socket.to(boardId).emit('cursor:update', {
      userId: socket.id,
      x,
      y
    });
  });
};

module.exports = registerCursorHandlers;
