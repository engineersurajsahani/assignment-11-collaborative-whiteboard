const { boardRooms } = require('./boardHandler');

function setupCursorHandlers(io, socket) {
  socket.on('cursor:move', ({ boardId, x, y }) => {
    const targetBoardId = boardId || socket.boardId;
    if (!targetBoardId || !boardRooms[targetBoardId]) return;

    // Update internal cursor store
    if (boardRooms[targetBoardId].users[socket.id]) {
      boardRooms[targetBoardId].users[socket.id].cursor = { x, y };
    }

    // Relay pointer updates to peer clients
    socket.to(targetBoardId).emit('cursor:update', {
      userId: socket.id,
      username: socket.username,
      color: socket.userColor,
      x,
      y
    });
  });
}

module.exports = { setupCursorHandlers };