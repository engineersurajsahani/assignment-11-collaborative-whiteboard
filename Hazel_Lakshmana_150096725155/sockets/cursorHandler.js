function setupCursorHandlers(io, socket, boardRooms) {
  socket.on("cursor:move", ({ boardId, x, y }) => {
    const board = boardRooms[boardId];
    if (!board || !board.users[socket.id]) return;

    board.users[socket.id].cursor = { x, y };

    socket.to(boardId).emit("cursor:update", {
      userId: socket.id,
      x,
      y
    });
  });
}

module.exports = { setupCursorHandlers };
