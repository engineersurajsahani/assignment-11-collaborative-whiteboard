function registerCursorHandlers(io, socket, boardRooms) {
  socket.on("cursor:move", ({ boardId, x, y }) => {
    const board = boardRooms[boardId];
    if (!board) return;

    const user = board.users[socket.id];
    if (user) user.cursor = { x, y };

    socket.to(boardId).emit("cursor:update", { userId: socket.id, x, y });
  });
}

module.exports = registerCursorHandlers;
