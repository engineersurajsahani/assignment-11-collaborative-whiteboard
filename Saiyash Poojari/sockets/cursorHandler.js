const { boardRooms } = require('./boardHandler');

function registerCursorHandlers(io, socket) {
  socket.on('cursor:move', (data) => {
    const { boardId, x, y } = data || {};
    if (!boardId) return;

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
}

module.exports = {
  registerCursorHandlers
};
