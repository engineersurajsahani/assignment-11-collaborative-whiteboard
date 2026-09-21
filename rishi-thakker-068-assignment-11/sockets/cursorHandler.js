const { boardRooms } = require("./boardHandler");

const registerCursorHandlers = (io, socket) => {
  socket.on("cursor:move", ({ boardId, x, y }) => {
    if (!boardId) return;

    const board = boardRooms[boardId];
    if (board && board.users[socket.id]) {
      board.users[socket.id].cursor = { x, y };
    }

    socket.to(boardId).emit("cursor:update", { userId: socket.id, x, y });
  });
};

module.exports = { registerCursorHandlers };
