const { getOrCreateBoard, removeUserFromAllBoards } = require("./store");

// Server-side throttle safety net (in addition to client-side throttling)
// to protect against any misbehaving / unthrottled client.
const CURSOR_MIN_INTERVAL_MS = 30;

/**
 * Registers cursor-tracking and disconnect-cleanup listeners for a socket.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerCursorHandlers(io, socket) {
  let lastCursorEmitAt = 0;

  // ---- cursor:move -------------------------------------------------------
  socket.on("cursor:move", ({ boardId, x, y }) => {
    if (!boardId) return;

    const now = Date.now();
    if (now - lastCursorEmitAt < CURSOR_MIN_INTERVAL_MS) return;
    lastCursorEmitAt = now;

    const board = getOrCreateBoard(boardId);
    if (board.users[socket.id]) {
      board.users[socket.id].cursor = { x, y };
    }

    socket.to(boardId).emit("cursor:update", {
      userId: socket.id,
      username: socket.data.username,
      color: socket.data.color,
      x,
      y,
    });
  });

  // ---- disconnect --------------------------------------------------------
  socket.on("disconnect", () => {
    const affectedBoards = removeUserFromAllBoards(socket.id);
    affectedBoards.forEach(({ boardId, username }) => {
      socket.to(boardId).emit("user:left", {
        userId: socket.id,
        username,
      });
    });
  });
}

module.exports = { registerCursorHandlers };
