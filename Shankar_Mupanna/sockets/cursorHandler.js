module.exports = function registerCursorHandlers(io, socket) {
  // Handle High-Frequency Mouse Pointer Synchronization
  socket.on('cursor:move', ({ boardId, x, y }) => {
    const roomId = boardId || socket.data.boardId;
    if (!roomId) return;

    // Broadcast peer cursor coordinates with user metadata
    socket.to(roomId).emit('cursor:update', {
      userId: socket.id,
      x: x,
      y: y,
      username: socket.data.username || 'Collaborator',
      color: socket.data.userColor || '#ff5722'
    });
  });
};
