const { boardRooms } = require("./boardHandler");

/**
 * Registers high-frequency cursor tracking socket events.
 * @param {import('socket.io').Server} io - Socket.io Server instance
 * @param {import('socket.io').Socket} socket - Connected socket instance
 */
function registerCursorHandlers(io, socket) {
  // Ephemeral high-frequency pointer synchronization
  socket.on("cursor:move", ({ boardId, x, y }) => {
    if (!boardId || typeof x !== "number" || typeof y !== "number") return;

    // Ephemeral state update in-memory
    if (boardRooms[boardId] && boardRooms[boardId].users[socket.id]) {
      boardRooms[boardId].users[socket.id].cursor = { x, y };
    }

    // Broadcast updated position to all peer participants in the room
    socket.to(boardId).emit("cursor:update", {
      userId: socket.id,
      x,
      y,
      username: socket.username || "Collaborator",
      color: socket.userColor || "#3b82f6"
    });
  });
}

module.exports = {
  registerCursorHandlers
};
