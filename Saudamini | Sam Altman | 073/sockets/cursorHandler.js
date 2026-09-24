// sockets/cursorHandler.js

module.exports = (io, socket) => {
  // Mouse pointer movement sync
  socket.on('cursor:move', ({ boardId, x, y }) => {
    const roomKey = boardId || socket.currentBoardId;
    if (!roomKey) return;

    // Relays peer cursor positions on screen to everyone else in the room
    socket.to(roomKey).emit('cursor:update', {
      userId: socket.id,
      x,
      y
    });
  });
};
