/**
 * cursorHandler.js
 * Handles real-time cursor tracking and coordinate broadcasting across peers.
 */

const { boardRooms } = require('./boardHandler');

function registerCursorHandlers(io, socket) {
  socket.on('cursor:move', ({ boardId, x, y }) => {
    if (!boardId || !boardRooms[boardId]) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    // Update user cursor position in in-memory state
    if (boardRooms[boardId].users[socket.id]) {
      boardRooms[boardId].users[socket.id].cursor = { x, y };
    }

    // Relay cursor update to all other room participants
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
