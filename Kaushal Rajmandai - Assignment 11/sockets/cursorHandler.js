const registerCursorHandlers = (io, socket) => {
  socket.on('cursor:move', ({ boardId, x, y }) => {
    socket.to(boardId).emit('cursor:update', {
      userId: socket.id,
      x,
      y
    });
  });
};

module.exports = { registerCursorHandlers };