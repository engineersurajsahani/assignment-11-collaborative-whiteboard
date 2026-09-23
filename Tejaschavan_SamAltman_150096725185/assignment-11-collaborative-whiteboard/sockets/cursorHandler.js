const { boardRooms } = require('./boardStore');

// Tunable throttle window in milliseconds (e.g., 40ms => ~25 cursor updates/sec per user)
const CURSOR_THROTTLE_MS = 40;

/**
 * Registers throttled cursor movement event handlers for a socket connection.
 * @param {import('socket.io').Server} io - Socket.io server instance
 * @param {import('socket.io').Socket} socket - Socket instance for connected client
 */
function registerCursorHandlers(io, socket) {
  // Initialize throttle timestamp on socket state
  socket.data.lastCursorEmit = 0;

  socket.on('cursor:move', ({ boardId, x, y }) => {
    const targetBoardId = boardId || socket.data.boardId;
    if (!targetBoardId || typeof x !== 'number' || typeof y !== 'number') return;

    // Update in-memory user cursor position if user is tracked
    if (
      boardRooms[targetBoardId] &&
      boardRooms[targetBoardId].users &&
      boardRooms[targetBoardId].users[socket.id]
    ) {
      boardRooms[targetBoardId].users[socket.id].cursor = { x, y };
    }

    const now = Date.now();
    // Server-side throttle: only emit if enough time elapsed since last emit
    if (now - socket.data.lastCursorEmit >= CURSOR_THROTTLE_MS) {
      socket.data.lastCursorEmit = now;

      // Broadcast cursor update to other users in the same room
      socket.to(targetBoardId).emit('cursor:update', {
        userId: socket.id,
        x,
        y
      });
    }
  });
}

module.exports = {
  CURSOR_THROTTLE_MS,
  registerCursorHandlers
};
