function registerCursorHandlers(io, socket, boardRooms) {
  socket.on("cursor:move", ({ boardId, x, y }) => {
    if (!boardId || socket.data.boardId !== boardId || !boardRooms[boardId]) return;

    const user = boardRooms[boardId].users[socket.id];
    if (!user) return;

    const cursor = {
      x: Number(x),
      y: Number(y)
    };

    if (!Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return;

    user.cursor = cursor;

    socket.to(boardId).emit("cursor:update", {
      userId: socket.id,
      x: cursor.x,
      y: cursor.y
    });
  });
}

module.exports = registerCursorHandlers;
