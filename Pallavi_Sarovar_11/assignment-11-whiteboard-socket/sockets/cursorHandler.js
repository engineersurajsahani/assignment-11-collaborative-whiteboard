/**
 * Cursor Socket Handlers
 * Broadcasts real-time cursor positions to collaborators in the same board.
 * Includes username and color so new clients can render labels immediately.
 */

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
      y: cursor.y,
      username: user.username,
      color: user.color
    });
  });
}

module.exports = registerCursorHandlers;
