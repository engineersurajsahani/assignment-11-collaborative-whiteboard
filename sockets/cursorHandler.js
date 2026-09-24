const { boardRooms } = require('./boardHandler');

const registerCursorHandlers = (io, socket) => {

  socket.on('cursor:move', ({ boardId, x, y }) => {
    if (!boardId || !boardRooms[boardId]) {
      return;
    }

    const user = boardRooms[boardId].users[socket.id];

    if (!user) {
      return;
    }

    user.cursor = {
      x,
      y
    };

    socket.to(boardId).emit('cursor:update', {
      userId: socket.id,
      x,
      y
    });
  });

};

module.exports = registerCursorHandlers;