const setupCursorHandler = (io, socket) => {
  socket.on('cursor:move', ({ boardId, x, y }) => {
    const bId = boardId || socket.currentBoard;
    if (!bId) return;

    socket.to(bId).emit('cursor:update', {
      userId: socket.id,
      x,
      y,
      username: socket.username || 'Anonymous',
      color: socket.userColor || '#000000'
    });
  });
};

module.exports = { setupCursorHandler };
