/**
 * cursorHandler.js
 * Handles streaming live user pointer/cursor coordinates across peers in a room.
 */

module.exports = function registerCursorHandlers(io, socket, boardRooms) {
  // Event: cursor:move
  // Payload: { boardId, x, y }
  socket.on("cursor:move", ({ boardId, x, y }) => {
    if (!boardId) return;

    const room = boardRooms[boardId];
    if (room && room.users[socket.id]) {
      // Update cursor position in room state
      room.users[socket.id].cursor = { x, y };

      // Broadcast cursor coordinate updates to all other participants in room
      socket.to(boardId).emit("cursor:update", {
        userId: socket.id,
        x,
        y
      });
    }
  });
};
