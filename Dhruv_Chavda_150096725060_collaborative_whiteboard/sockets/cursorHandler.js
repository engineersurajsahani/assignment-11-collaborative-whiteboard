module.exports = function registerCursorHandlers(io, socket) {
  // High-frequency mouse pointer sync
  socket.on('cursor:move', ({ boardId, x, y }) => {
    if (!boardId || x === undefined || y === undefined) return;

    // Relay peer cursor position to other room collaborators
    socket.to(boardId).emit('cursor:update', {
      userId: socket.id,
      username: socket.username || 'Collaborator',
      color: socket.userColor || '#3B82F6',
      x,
      y
    });
  });
};
